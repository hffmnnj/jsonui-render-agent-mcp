import { describe, expect, it } from "bun:test";
import { validateSpec } from "../../validate";
import { resolveTheme } from "../../../render/resolve-theme";
import { renderToPng, renderToSvg } from "../../../render/index";
import type { ThemeName } from "../../../tokens/palettes";
import {
  areaPath,
  axisTicks,
  barRects,
  domainFromValues,
  linearScale,
  niceTicks,
  plotBox,
  seriesPoints,
  smoothPath,
} from "./svg-helpers";

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
        props: { width: 520, height: 320, padding: 24, backgroundColor: { $theme: "color.background" } },
        children: [child],
      },
      ...extra,
    },
  };
}

/**
 * Satori embeds a nested chart `<svg>` as a `data:image/svg+xml;utf8,…`
 * `<image>` href rather than inlining its children. To meaningfully assert that
 * the chart geometry (bars/lines/points) was actually emitted — not just that
 * "it rendered" — we decode every embedded SVG and concatenate their markup so
 * tests can look for real `<rect>/<polyline>/<path>/<circle>` shapes.
 */
function decodeChartSvg(outerSvg: string): string {
  const hrefs = [...outerSvg.matchAll(/href="(data:image\/svg\+xml;utf8,[^"]*)"/g)];
  return hrefs
    .map((m) => {
      const value = m[1];
      // Split on the FIRST comma only — the encoded SVG body itself contains
      // commas (e.g. polyline `points="4,32 …"`), so a naive split truncates it.
      const body = value.slice(value.indexOf(",") + 1);
      return decodeURIComponent(body);
    })
    .join("\n");
}

/**
 * Validate → resolve (asserting no $theme survives) → render to PNG + SVG.
 * Returns the raw outer SVG plus the decoded inner chart SVG markup.
 */
async function renderChart(
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
 * Pure geometry helpers                                               *
 * ================================================================== */

describe("svg-helpers scale + axis math", () => {
  it("linearScale maps domain endpoints onto range endpoints", () => {
    const scale = linearScale({ min: 0, max: 100 }, { start: 0, end: 200 });
    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(200);
    expect(scale(50)).toBe(100);
  });

  it("linearScale inverts for a top-origin Y axis", () => {
    const yScale = linearScale({ min: 0, max: 10 }, { start: 100, end: 0 });
    expect(yScale(0)).toBe(100); // min → bottom
    expect(yScale(10)).toBe(0); // max → top
  });

  it("linearScale collapses a zero-width domain to the range start (no NaN)", () => {
    const scale = linearScale({ min: 5, max: 5 }, { start: 0, end: 200 });
    expect(scale(5)).toBe(0);
    expect(Number.isNaN(scale(5))).toBe(false);
  });

  it("domainFromValues anchors at zero by default and fits when asked", () => {
    expect(domainFromValues([10, 40, 25])).toEqual({ min: 0, max: 40 });
    expect(domainFromValues([10, 40, 25], { zeroBaseline: false })).toEqual({ min: 10, max: 40 });
  });

  it("domainFromValues pads a flat series instead of collapsing", () => {
    const d = domainFromValues([7, 7, 7], { zeroBaseline: false });
    expect(d.min).toBeLessThan(7);
    expect(d.max).toBeGreaterThan(7);
  });

  it("niceTicks produces human-friendly steps covering the domain", () => {
    const ticks = niceTicks({ min: 0, max: 100 }, 4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    // Steps land on round 1/2/5·10ⁿ values (here 20), not raw fractions.
    const step = ticks[1] - ticks[0];
    expect([10, 20, 25, 50].includes(step)).toBe(true);
  });

  it("axisTicks positions ticks within the plot box (inverted Y)", () => {
    const plot = plotBox(200, 100, { top: 0, right: 0, bottom: 0, left: 0 });
    const ticks = axisTicks({ min: 0, max: 100 }, plot, 4);
    // The min tick sits at the bottom, the max near the top.
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    expect(min.position).toBeGreaterThan(max.position);
  });

  it("barRects yields zero-anchored bars with a positive height", () => {
    const plot = plotBox(300, 100, { top: 0, right: 0, bottom: 0, left: 0 });
    const rects = barRects([10, 20, 30], domainFromValues([10, 20, 30]), plot);
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.height).toBeGreaterThan(0);
      expect(r.width).toBeGreaterThan(0);
    }
    // Taller value → taller bar.
    expect(rects[2].height).toBeGreaterThan(rects[0].height);
  });

  it("seriesPoints spreads points across the plot and drops non-finite ones", () => {
    const plot = plotBox(100, 50, { top: 0, right: 0, bottom: 0, left: 0 });
    const pts = seriesPoints([0, 5, 10], { min: 0, max: 10 }, plot);
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[2].x).toBeCloseTo(100);

    const withGap = seriesPoints([0, Number.NaN, 10], { min: 0, max: 10 }, plot);
    expect(withGap).toHaveLength(2);
  });

  it("smoothPath and areaPath emit valid SVG path data", () => {
    const pts = seriesPoints([1, 3, 2, 5], { min: 0, max: 5 }, plotBox(120, 40, { top: 0, right: 0, bottom: 0, left: 0 }));
    const d = smoothPath(pts);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("C"); // cubic Béziers for ≥3 points
    const area = areaPath(pts, 40);
    expect(area.trim().endsWith("Z")).toBe(true);
  });
});

/* ================================================================== *
 * BarChart                                                            *
 * ================================================================== */

describe("BarChart", () => {
  const barSpec = (): SpecInput =>
    frameWith("bar", {
      bar: {
        type: "BarChart",
        props: {
          data: [
            { label: "Mon", value: 42 },
            { label: "Tue", value: 58 },
            { label: "Wed", value: 35 },
            { label: "Thu", value: 71 },
            { label: "Fri", value: 64 },
          ],
          width: 400,
          height: 220,
          colors: { $theme: "color.chart" },
          showGrid: true,
          gridColor: { $theme: "color.border" },
          labelColor: { $theme: "color.mutedForeground" },
        },
        children: [],
      },
    });

  for (const theme of themes) {
    it(`renders bars + gridlines to a valid PNG in ${theme}`, async () => {
      const { chartSvg } = await renderChart(barSpec(), theme);
      // The plotting SVG must contain actual <rect> bars — not just a container.
      const rectCount = (chartSvg.match(/<rect/g) ?? []).length;
      expect(rectCount).toBeGreaterThanOrEqual(5);
      // And it must never emit an SVG <text> node (Satori would have thrown).
      expect(chartSvg).not.toContain("<text");
    });
  }

  it("cycles the resolved chart ramp across bars (multiple distinct fills)", async () => {
    const { chartSvg } = await renderChart(barSpec(), "light");
    const fills = new Set([...chartSvg.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1]));
    // 5 bars over a 6-color ramp → at least a few different colors.
    expect(fills.size).toBeGreaterThanOrEqual(3);
  });

  it("renders bare numeric data (no labels, no gutter) without throwing", async () => {
    await renderChart(
      frameWith("bar", {
        bar: { type: "BarChart", props: { data: [3, 7, 5, 9], showValueLabels: false }, children: [] },
      }),
      "dark"
    );
  });

  it("rejects an empty data series with a structured error", () => {
    const result = validateSpec(
      frameWith("bar", { bar: { type: "BarChart", props: { data: [] }, children: [] } })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.bar.props.data");
  });
});

/* ================================================================== *
 * LineChart                                                           *
 * ================================================================== */

describe("LineChart", () => {
  const multiSeriesSpec = (): SpecInput =>
    frameWith("line", {
      line: {
        type: "LineChart",
        props: {
          series: [
            { name: "This week", data: [12, 19, 15, 27, 24, 33, 30] },
            { name: "Last week", data: [10, 14, 13, 18, 20, 22, 21] },
          ],
          axisLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          width: 440,
          height: 240,
          smooth: true,
          showPoints: true,
          colors: { $theme: "color.chart" },
          gridColor: { $theme: "color.border" },
          labelColor: { $theme: "color.mutedForeground" },
        },
        children: [],
      },
    });

  for (const theme of themes) {
    it(`renders smooth multi-series lines to a valid PNG in ${theme}`, async () => {
      const { chartSvg } = await renderChart(multiSeriesSpec(), theme);
      // Smooth lines are <path>s; points are <circle>s. Two series → ≥2 paths.
      const pathCount = (chartSvg.match(/<path/g) ?? []).length;
      expect(pathCount).toBeGreaterThanOrEqual(2);
      expect(chartSvg).toContain("<circle");
      expect(chartSvg).not.toContain("<text");
    });
  }

  it("accepts the single-series `data` shorthand and a straight polyline", async () => {
    const { chartSvg } = await renderChart(
      frameWith("line", {
        line: {
          type: "LineChart",
          props: {
            data: [5, 8, 6, 11, 9, 14],
            showArea: true,
            color: { $theme: "color.accent.bg" },
            colors: { $theme: "color.chart" },
          },
          children: [],
        },
      }),
      "light"
    );
    // Straight line (smooth off) → a <polyline>; area fill → a <path>.
    expect(chartSvg).toContain("<polyline");
    expect(chartSvg).toContain("<path");
  });

  it("rejects a LineChart with neither series nor data", () => {
    const result = validateSpec(
      frameWith("line", { line: { type: "LineChart", props: {}, children: [] } })
    );
    expect(result.ok).toBe(false);
  });
});

/* ================================================================== *
 * Sparkline                                                           *
 * ================================================================== */

describe("Sparkline", () => {
  const sparkSpec = (extra: Record<string, unknown> = {}): SpecInput =>
    frameWith("spark", {
      spark: {
        type: "Sparkline",
        props: {
          data: [4, 6, 5, 8, 7, 11, 9, 13],
          width: 140,
          height: 36,
          color: { $theme: "color.accent.bg" },
          ...extra,
        },
        children: [],
      },
    });

  for (const theme of themes) {
    it(`renders a compact axis-less trend line in ${theme}`, async () => {
      const { chartSvg } = await renderChart(sparkSpec({ smooth: true }), theme);
      // Sparkline is just the trend geometry: a path/polyline (+ area + end dot).
      expect(/<path|<polyline/.test(chartSvg)).toBe(true);
      // Axis-less: no labels/text ever.
      expect(chartSvg).not.toContain("<text");
    });
  }

  it("draws a straight polyline with an end dot by default", async () => {
    const { chartSvg } = await renderChart(sparkSpec(), "dark");
    expect(chartSvg).toContain("<polyline");
    expect(chartSvg).toContain("<circle"); // end dot on by default
  });

  it("rejects a sparkline with fewer than two points", () => {
    const result = validateSpec(
      frameWith("spark", { spark: { type: "Sparkline", props: { data: [1] }, children: [] } })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.spark.props.data");
  });
});

/* ================================================================== *
 * Cross-theme differentiation (MH5)                                   *
 * ================================================================== */

describe("axis charts honor light/dark theming", () => {
  it("renders visibly different bytes for the same chart across themes", async () => {
    const spec = frameWith("bar", {
      bar: {
        type: "BarChart",
        props: {
          data: [{ label: "A", value: 30 }, { label: "B", value: 70 }, { label: "C", value: 45 }],
          colors: { $theme: "color.chart" },
          gridColor: { $theme: "color.border" },
          labelColor: { $theme: "color.mutedForeground" },
        },
        children: [],
      },
    });
    const validated = validateOk(spec);
    const light = await renderToPng(resolveTheme(validated, "light"), { scale: 2 });
    const dark = await renderToPng(resolveTheme(validated, "dark"), { scale: 2 });
    expect(light.equals(dark)).toBe(false);
  });
});

/** Validate a spec and return the tree, throwing on the (unexpected) error. */
function validateOk(spec: SpecInput) {
  const result = validateSpec(spec);
  if (!result.ok) throw new Error(`${result.error.path}: ${result.error.message}`);
  return result.tree;
}
