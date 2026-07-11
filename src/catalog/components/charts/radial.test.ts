import { describe, expect, it } from "bun:test";
import { validateSpec } from "../../validate";
import { resolveTheme } from "../../../render/resolve-theme";
import { renderToPng } from "../../../render/index";
import type { ThemeName } from "../../../tokens/palettes";
import {
  arcPath,
  computeSlices,
  polarToCartesian,
  slicePath,
} from "./arc-helpers";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const themes: ThemeName[] = ["light", "dark"];

interface SpecInput {
  root: string;
  elements: Record<string, unknown>;
}

/** Wrap a single chart element in a Frame so it forms a renderable spec. */
function frameWith(child: string, extra: Record<string, unknown>): SpecInput {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: {
          width: 360,
          height: 360,
          padding: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: { $theme: "color.background" },
        },
        children: [child],
      },
      ...extra,
    },
  };
}

/** Validate → resolve → render, asserting a valid non-trivial PNG for a theme. */
async function expectRenders(spec: SpecInput, theme: ThemeName): Promise<Buffer> {
  const validated = validateSpec(spec);
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(`${validated.error.path}: ${validated.error.message}`);

  const resolved = resolveTheme(validated.tree, theme);
  expect(JSON.stringify(resolved)).not.toContain("$theme");

  const png = await renderToPng(resolved, { scale: 2 });
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.byteLength).toBeGreaterThan(1_000);
  return png;
}

/* ------------------------------------------------------------------ *
 * Arc math (pure) — the degenerate-arc handling is the highest-risk   *
 * part of this task, so it is proven directly, not just via render.   *
 * ------------------------------------------------------------------ */

describe("arc-helpers geometry", () => {
  const center = { x: 100, y: 100 };

  it("maps clock-degree angles to the expected cardinal points", () => {
    const top = polarToCartesian(center, 80, 0);
    const right = polarToCartesian(center, 80, 90);
    const bottom = polarToCartesian(center, 80, 180);
    const left = polarToCartesian(center, 80, 270);
    expect(top.x).toBeCloseTo(100, 3);
    expect(top.y).toBeCloseTo(20, 3);
    expect(right.x).toBeCloseTo(180, 3);
    expect(right.y).toBeCloseTo(100, 3);
    expect(bottom.x).toBeCloseTo(100, 3);
    expect(bottom.y).toBeCloseTo(180, 3);
    expect(left.x).toBeCloseTo(20, 3);
    expect(left.y).toBeCloseTo(100, 3);
  });

  it("returns an empty arc path for a 0-degree sweep (no NaN, no crash)", () => {
    expect(arcPath(center, 80, 0, 0)).toBe("");
  });

  it("sets the large-arc flag correctly for < and > 180 degree sweeps", () => {
    expect(arcPath(center, 80, 0, 90)).toContain(" 0 1 "); // small arc, cw
    expect(arcPath(center, 80, 0, 270)).toContain(" 1 1 "); // large arc, cw
  });

  it("splits a full 360-degree arc into two sub-arcs (the 100% gotcha)", () => {
    const full = arcPath(center, 80, 0, 360);
    // Two `A` commands => two distinct-endpoint sub-arcs, not one degenerate one.
    const arcCount = (full.match(/A /g) ?? []).length;
    expect(arcCount).toBe(2);
    expect(full).not.toContain("NaN");
  });

  it("emits a solid two-arc disc for a single full-circle pie slice", () => {
    const d = slicePath(center, 80, 0, 0, 360);
    expect((d.match(/A /g) ?? []).length).toBe(2);
    expect(d).not.toContain("NaN");
  });

  it("emits outer+inner sub-paths for a full-circle donut slice", () => {
    const d = slicePath(center, 80, 48, 0, 360);
    // Two full circles (outer + hole) => four half-arcs total.
    expect((d.match(/A /g) ?? []).length).toBe(4);
  });

  it("computes proportional slice fractions and skips zero/negative values", () => {
    const slices = computeSlices([
      { label: "a", value: 50 },
      { label: "b", value: 30 },
      { label: "c", value: 20 },
      { label: "zero", value: 0 },
      { label: "neg", value: -10 },
    ]);
    expect(slices[0]?.fraction).toBeCloseTo(0.5, 5);
    expect(slices[1]?.fraction).toBeCloseTo(0.3, 5);
    expect(slices[2]?.fraction).toBeCloseTo(0.2, 5);
    expect(slices[3]?.fraction).toBe(0);
    expect(slices[4]?.fraction).toBe(0);
    // Non-zero slices cover the full circle.
    expect(slices[2]?.endAngle).toBeCloseTo(360, 3);
  });

  it("does not divide by zero when every value is zero", () => {
    const slices = computeSlices([
      { value: 0 },
      { value: 0 },
    ]);
    expect(slices.every((s) => s.fraction === 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * PieChart / Donut render coverage.                                   *
 * ------------------------------------------------------------------ */

describe("PieChart radial chart", () => {
  for (const theme of themes) {
    it(`renders a multi-slice pie in ${theme}`, async () => {
      await expectRenders(
        frameWith("pie", {
          pie: {
            type: "PieChart",
            props: {
              data: [
                { label: "Compute", value: 45 },
                { label: "Storage", value: 30 },
                { label: "Network", value: 25 },
              ],
              size: 240,
              colors: { $theme: "color.chart" },
              backgroundColor: { $theme: "color.background" },
              padAngle: 2,
            },
            children: [],
          },
        }),
        theme
      );
    });

    it(`renders a donut with a center label in ${theme}`, async () => {
      await expectRenders(
        frameWith("pie", {
          pie: {
            type: "PieChart",
            props: {
              data: [
                { label: "Used", value: 68 },
                { label: "Free", value: 32 },
              ],
              donut: true,
              size: 240,
              colors: { $theme: "color.chart" },
              backgroundColor: { $theme: "color.surface" },
              centerLabel: "68%",
              centerValue: "used",
              centerLabelColor: { $theme: "color.foreground" },
              centerValueColor: { $theme: "color.mutedForeground" },
            },
            children: [],
          },
        }),
        theme
      );
    });
  }

  // EDGE CASE — a single 100% slice must render as a solid disc (the
  // degenerate full-circle arc gotcha), not crash or vanish.
  it("renders a single 100% slice as a solid disc in both themes", async () => {
    for (const theme of themes) {
      const png = await expectRenders(
        frameWith("pie", {
          pie: {
            type: "PieChart",
            props: {
              data: [{ label: "All", value: 100 }],
              size: 240,
              colors: { $theme: "color.chart" },
            },
            children: [],
          },
        }),
        theme
      );
      // Non-trivial output proves the disc actually drew.
      expect(png.byteLength).toBeGreaterThan(2_000);
    }
  });

  // EDGE CASE — a single 100% DONUT slice (full ring) must also render.
  it("renders a single 100% donut slice as a solid ring", async () => {
    await expectRenders(
      frameWith("pie", {
        pie: {
          type: "PieChart",
          props: {
            data: [{ label: "All", value: 100 }],
            donut: true,
            size: 240,
            colors: { $theme: "color.chart" },
          },
          children: [],
        },
      }),
      "dark"
    );
  });

  // EDGE CASE — zero-value slices are skipped, not rendered as broken wedges.
  it("renders a series containing zero-value slices without crashing", async () => {
    await expectRenders(
      frameWith("pie", {
        pie: {
          type: "PieChart",
          props: {
            data: [
              { label: "a", value: 60 },
              { label: "b", value: 0 },
              { label: "c", value: 40 },
            ],
            size: 240,
            colors: { $theme: "color.chart" },
          },
          children: [],
        },
      }),
      "light"
    );
  });

  it("rejects a PieChart with an empty data series", () => {
    const result = validateSpec(
      frameWith("pie", {
        pie: { type: "PieChart", props: { data: [] }, children: [] },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.pie.props.data");
  });
});

/* ------------------------------------------------------------------ *
 * ProgressRing / Gauge render coverage — the 0% / 50% / 100% matrix.  *
 * ------------------------------------------------------------------ */

describe("ProgressRing radial chart", () => {
  for (const theme of themes) {
    it(`renders a labelled gauge in ${theme}`, async () => {
      await expectRenders(
        frameWith("ring", {
          ring: {
            type: "ProgressRing",
            props: {
              value: 72,
              max: 100,
              size: 180,
              label: "72%",
              sublabel: "Uptime",
              trackColor: { $theme: "color.surfaceMuted" },
              fillColor: { $theme: "color.accent.bg" },
              labelColor: { $theme: "color.foreground" },
              sublabelColor: { $theme: "color.mutedForeground" },
            },
            children: [],
          },
        }),
        theme
      );
    });
  }

  // EDGE CASES — the critical 0% / 50% / 100% matrix in both themes. 0% must
  // draw the track only (no degenerate arc); 100% must draw a full ring (the
  // split full-circle arc); none may crash or produce an invisible arc.
  const edgeValues = [0, 50, 100] as const;
  for (const theme of themes) {
    for (const value of edgeValues) {
      it(`renders correctly at ${value}% in ${theme}`, async () => {
        const png = await expectRenders(
          frameWith("ring", {
            ring: {
              type: "ProgressRing",
              props: {
                value,
                max: 100,
                size: 180,
                showValue: true,
                trackColor: { $theme: "color.surfaceMuted" },
                fillColor: { $theme: "color.accent.bg" },
                labelColor: { $theme: "color.foreground" },
              },
              children: [],
            },
          }),
          theme
        );
        // All three must be real, non-trivial PNGs (proves the ring drew).
        expect(png.byteLength).toBeGreaterThan(2_000);
      });
    }
  }

  it("clamps out-of-range values instead of crashing", async () => {
    for (const value of [-25, 250]) {
      await expectRenders(
        frameWith("ring", {
          ring: {
            type: "ProgressRing",
            props: { value, size: 160, showValue: true },
            children: [],
          },
        }),
        "light"
      );
    }
  });

  it("rejects a ProgressRing missing its required value", () => {
    const result = validateSpec(
      frameWith("ring", {
        ring: { type: "ProgressRing", props: { size: 160 }, children: [] },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.ring.props.value");
  });
});
