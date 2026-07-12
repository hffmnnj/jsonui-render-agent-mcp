import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { validateSpec } from "../../validate";
import { resolveTheme } from "../../../render/resolve-theme";
import { renderToPng, renderToSvg } from "../../../render/index";
import type { ThemeName } from "../../../tokens/palettes";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const themes: ThemeName[] = ["light", "dark"];

interface SpecInput {
  root: string;
  elements: Record<string, unknown>;
}

/** Wrap a single element in a Frame so it forms a renderable spec. */
function frameWith(child: string, extra: Record<string, unknown>): SpecInput {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 360, height: 220, padding: 24, backgroundColor: { $theme: "color.background" } },
        children: [child],
      },
      ...extra,
    },
  };
}

/**
 * Satori embeds a nested chart `<svg>` as a `data:image/svg+xml;utf8,…`
 * `<image>` href rather than inlining its children. Decode every embedded SVG
 * so a Metric test can confirm the inline sparkline geometry was actually
 * emitted (a real `<path>`/`<polyline>`), not just that the card rendered.
 */
function decodeChartSvg(outerSvg: string): string {
  const hrefs = [...outerSvg.matchAll(/href="(data:image\/svg\+xml;utf8,[^"]*)"/g)];
  return hrefs
    .map((m) => {
      const value = m[1];
      const body = value.slice(value.indexOf(",") + 1);
      return decodeURIComponent(body);
    })
    .join("\n");
}

/** Validate → resolve (asserting no $theme survives) → render to PNG + SVG. */
async function renderMetric(
  spec: SpecInput,
  theme: ThemeName
): Promise<{ png: Buffer; svg: string; chartSvg: string }> {
  const validated = validateSpec(spec);
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(`${validated.error.path}: ${validated.error.message}`);

  const resolved = resolveTheme(validated.tree, theme);
  expect(JSON.stringify(resolved)).not.toContain("$theme");

  const svg = await renderToSvg(resolved);
  const png = await renderToPng(resolved, { scale: 2 });
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.byteLength).toBeGreaterThan(1_000);
  return { png, svg, chartSvg: decodeChartSvg(svg) };
}

/* ================================================================== *
 * Metric / stat card                                                  *
 * ================================================================== */

describe("Metric", () => {
  const metricSpec = (props: Record<string, unknown>): SpecInput =>
    frameWith("metric", {
      metric: { type: "Metric", props, children: [] },
    });

  for (const theme of themes) {
    it(`renders value + label + delta + sparkline to a valid PNG in ${theme}`, async () => {
      const { svg, chartSvg } = await renderMetric(
        metricSpec({
          label: "Monthly Revenue",
          value: "$48.2k",
          caption: "vs. last month",
          delta: { value: "12.4%", direction: "up" },
          sparkline: {
            data: [18, 22, 20, 27, 25, 31, 34, 42],
            smooth: true,
            color: { $theme: "color.success.bg" },
          },
          positiveColor: { $theme: "color.success.bg" },
          backgroundColor: { $theme: "color.surface" },
          borderColor: { $theme: "color.border" },
          labelColor: { $theme: "color.mutedForeground" },
        }),
        theme
      );
      // The inline sparkline must actually plot a trend line, not be a stub.
      expect(/<path|<polyline/.test(chartSvg)).toBe(true);
      // No SVG <text> anywhere (Satori would have thrown) — labels are divs.
      expect(svg).not.toContain("<text");
      expect(chartSvg).not.toContain("<text");
    });
  }

  it("renders with NO delta and NO sparkline (bare stat) without throwing", async () => {
    const { png } = await renderMetric(
      metricSpec({
        label: "Open Tickets",
        value: 128,
        backgroundColor: { $theme: "color.surface" },
        borderColor: { $theme: "color.border" },
      }),
      "light"
    );
    expect(png.byteLength).toBeGreaterThan(1_000);
  });

  it("renders with a delta but no sparkline", async () => {
    const { chartSvg } = await renderMetric(
      metricSpec({
        label: "Churn",
        value: "2.1%",
        delta: { value: "0.4pp", direction: "down", intent: "positive" },
      }),
      "dark"
    );
    // No sparkline → no embedded chart svg with trend geometry.
    expect(chartSvg).not.toContain("<polyline");
  });

  it("renders with a sparkline but no delta", async () => {
    const { chartSvg } = await renderMetric(
      metricSpec({
        label: "Signups",
        value: "1,204",
        sparkline: { data: [4, 6, 5, 9, 8, 12], color: { $theme: "color.accent.bg" } },
      }),
      "light"
    );
    expect(/<path|<polyline/.test(chartSvg)).toBe(true);
  });

  it("supports a right-positioned sparkline and `plain` (surface-less) mode", async () => {
    const { png } = await renderMetric(
      metricSpec({
        label: "Throughput",
        value: "3.2k/s",
        plain: true,
        sparklinePosition: "right",
        delta: { value: "5%", direction: "up" },
        sparkline: { data: [1, 2, 1.5, 3, 2.8, 3.2], color: { $theme: "color.accent.bg" } },
      }),
      "dark"
    );
    expect(png.byteLength).toBeGreaterThan(1_000);
  });

  it("renders visibly different bytes across themes (MH5)", async () => {
    const spec = metricSpec({
      label: "Revenue",
      value: "$48.2k",
      delta: { value: "12.4%", direction: "up" },
      backgroundColor: { $theme: "color.surface" },
      borderColor: { $theme: "color.border" },
      labelColor: { $theme: "color.mutedForeground" },
      valueColor: { $theme: "color.foreground" },
    });
    const validated = validateSpec(spec);
    if (!validated.ok) throw new Error(validated.error.message);
    const light = await renderToPng(resolveTheme(validated.tree, "light"), { scale: 2 });
    const dark = await renderToPng(resolveTheme(validated.tree, "dark"), { scale: 2 });
    expect(light.equals(dark)).toBe(false);
  });

  it("requires a `label` and a `value`", () => {
    const missingValue = validateSpec(
      frameWith("m", { m: { type: "Metric", props: { label: "X" }, children: [] } })
    );
    expect(missingValue.ok).toBe(false);

    const missingLabel = validateSpec(
      frameWith("m", { m: { type: "Metric", props: { value: 10 }, children: [] } })
    );
    expect(missingLabel.ok).toBe(false);
  });
});

/* ================================================================== *
 * Dashboard exemplar — the flagship "beautiful by default" spec.      *
 * Renders examples/dashboard.json in BOTH themes; writes PNGs to      *
 * /tmp/opencode for visual sanity-checking.                           *
 * ================================================================== */

describe("dashboard exemplar (examples/dashboard.json)", () => {
  const OUT_DIR = "/tmp/opencode";

  async function loadDashboard(): Promise<SpecInput> {
    const url = new URL("../../../../examples/dashboard.json", import.meta.url);
    const raw = await readFile(url, "utf8");
    return JSON.parse(raw) as SpecInput;
  }

  for (const theme of themes) {
    it(`renders the full dashboard in ${theme} to a large, complex PNG`, async () => {
      const spec = await loadDashboard();
      const validated = validateSpec(spec);
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error(`${validated.error.path}: ${validated.error.message}`);

      const resolved = resolveTheme(validated.tree, theme);
      expect(JSON.stringify(resolved)).not.toContain("$theme");

      const png = await renderToPng(resolved, { scale: 2 });
      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      // Flagship exemplar: a real, content-rich render — not a near-blank canvas.
      // A 1200×900 @2x dashboard with charts/tables/text rasterizes well past
      // 50 KB; a near-empty frame would be a few KB. This floor guards against a
      // silently-degraded render.
      expect(png.byteLength).toBeGreaterThan(50_000);

      // Best-effort: drop the PNGs somewhere out-of-repo for a human to eyeball.
      try {
        await mkdir(OUT_DIR, { recursive: true });
        await writeFile(`${OUT_DIR}/dashboard-${theme}.png`, png);
      } catch {
        // Non-fatal — the assertions above are the real contract.
      }
    });
  }

  it("renders light and dark to visibly different bytes (theme-aware)", async () => {
    const spec = await loadDashboard();
    const validated = validateSpec(spec);
    if (!validated.ok) throw new Error(validated.error.message);
    const light = await renderToPng(resolveTheme(validated.tree, "light"), { scale: 2 });
    const dark = await renderToPng(resolveTheme(validated.tree, "dark"), { scale: 2 });
    expect(light.equals(dark)).toBe(false);
  });
});
