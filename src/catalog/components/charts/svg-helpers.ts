/**
 * Shared scale / axis / geometry helpers for the axis-series chart family
 * (BarChart, LineChart, Sparkline).
 *
 * These are pure functions over plain numbers — no React, no Satori — so the
 * chart render cases in `src/render/satori.ts` can turn a data series into
 * pixel coordinates, gridline positions, and axis ticks, and the components
 * here can advertise schemas/examples. Keeping the math in one place means a
 * bar's baseline and a line's points sit on the SAME scale and plot box.
 *
 * IMPORTANT Satori constraint (verified against satori@0.26.0): Satori renders
 * `rect`/`polyline`/`path`/`line`/`circle` as inline `<svg>` children, but it
 * THROWS on `<text>` nodes ("please convert them to <path>"). So the geometry
 * here only ever produces shape coordinates; every textual label (axis ticks,
 * value labels) is drawn by the render case as a flexbox `<div>` positioned
 * around/over the plot, never as an SVG `<text>` node.
 */

export interface Domain {
  readonly min: number;
  readonly max: number;
}

/** Pixel output range. For the Y axis it is inverted (SVG y grows downward):
 *  `{ start: plotHeight, end: 0 }` maps domain min → bottom, max → top. */
export interface Range {
  readonly start: number;
  readonly end: number;
}

export interface PlotInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PlotBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface AxisTick {
  readonly value: number;
  readonly position: number;
}

/**
 * Build a linear scale: a function mapping a data value in `domain` to a pixel
 * position in `range`. Values outside the domain extrapolate linearly (callers
 * that need clamping do it explicitly). A zero-width domain collapses to the
 * range start so a flat series still renders on the baseline rather than NaN.
 */
export function linearScale(domain: Domain, range: Range): (value: number) => number {
  const span = domain.max - domain.min;
  const pixelSpan = range.end - range.start;
  if (span === 0) {
    return () => range.start;
  }
  return (value: number) => range.start + ((value - domain.min) / span) * pixelSpan;
}

/**
 * Derive a display domain from a raw numeric series. By default the domain is
 * `[min(0, seriesMin), seriesMax]` so bar/area charts anchor at zero (the
 * honest baseline) unless the data goes negative. Pass `zeroBaseline: false`
 * to tightly fit the data (useful for sparklines and delta lines where the
 * shape matters more than the absolute magnitude). A flat series is nudged to
 * a unit span so it renders as a centered line rather than a degenerate one.
 */
export function domainFromValues(
  values: readonly number[],
  options: { zeroBaseline?: boolean } = {}
): Domain {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) {
    return { min: 0, max: 1 };
  }
  const zeroBaseline = options.zeroBaseline ?? true;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (zeroBaseline) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    // A flat series: pad symmetrically so it lands mid-plot with headroom.
    const pad = min === 0 ? 1 : Math.abs(min) * 0.5;
    return { min: min - pad, max: max + pad };
  }
  return { min, max };
}

export function plotBox(width: number, height: number, insets: PlotInsets): PlotBox {
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
}

/**
 * Compute "nice" evenly-spaced tick VALUES across a domain. Uses a 1/2/5·10ⁿ
 * step so ticks land on human-friendly numbers (10, 25, 50, …) rather than raw
 * fractions of the data range. Returns between ~`targetCount`±1 ticks covering
 * the domain. Callers map these to pixels with a scale (see `axisTicks`).
 */
export function niceTicks(domain: Domain, targetCount = 4): number[] {
  const span = domain.max - domain.min;
  if (span <= 0 || !Number.isFinite(span)) return [domain.min];

  const rawStep = span / Math.max(1, targetCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceUnit = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  const step = niceUnit * magnitude;

  const start = Math.ceil(domain.min / step) * step;
  const ticks: number[] = [];
  // Guard against float drift adding a spurious trailing tick.
  for (let v = start; v <= domain.max + step * 1e-6; v += step) {
    // Snap tiny float residue (e.g. 0.30000000000000004) back to the grid.
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(10)));
  }
  return ticks.length > 0 ? ticks : [domain.min, domain.max];
}

/**
 * Produce Y-axis ticks as `{ value, position }` pairs, where `position` is the
 * pixel Y (top-origin) within the plot box. Combines `niceTicks` with a scale
 * mapping the domain onto `[plot.y + plot.height, plot.y]` (inverted, since SVG
 * y grows downward). Handy for both the gridline rects and the div labels.
 */
export function axisTicks(domain: Domain, plot: PlotBox, targetCount = 4): AxisTick[] {
  const scale = linearScale(domain, { start: plot.y + plot.height, end: plot.y });
  return niceTicks(domain, targetCount).map((value) => ({
    value,
    position: scale(value),
  }));
}

/**
 * Map a numeric series to evenly-spaced plotted points across the plot box.
 * X is distributed by index; when `bandCenter` is true each point sits at the
 * center of its band (used to align a line/sparkline with bar centers), and
 * when false points span edge-to-edge (the default for a pure line). Y is
 * scaled by `domain` (inverted for SVG). Non-finite values are dropped, so a
 * series with gaps still yields a valid polyline through its real points.
 */
export function seriesPoints(
  values: readonly number[],
  domain: Domain,
  plot: PlotBox,
  options: { bandCenter?: boolean } = {}
): Point[] {
  const n = values.length;
  if (n === 0) return [];
  const yScale = linearScale(domain, { start: plot.y + plot.height, end: plot.y });
  const bandCenter = options.bandCenter ?? false;

  const xAt = (index: number): number => {
    if (bandCenter) {
      const band = plot.width / n;
      return plot.x + band * index + band / 2;
    }
    if (n === 1) return plot.x + plot.width / 2;
    return plot.x + (plot.width * index) / (n - 1);
  };

  const points: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    points.push({ x: round(xAt(i)), y: round(yScale(value as number)) });
  }
  return points;
}

/**
 * Compute bar rectangles for a series. Each band is `plot.width / n` wide; the
 * bar occupies `barRatio` of it (centered), and its height runs from the value
 * down to the domain's zero baseline (or the domain floor when all-positive
 * data has no zero). Returns SVG `rect` geometry ready to spread onto a `rect`.
 */
export function barRects(
  values: readonly number[],
  domain: Domain,
  plot: PlotBox,
  options: { barRatio?: number } = {}
): Array<{ x: number; y: number; width: number; height: number; index: number }> {
  const n = values.length;
  if (n === 0) return [];
  const barRatio = clamp(options.barRatio ?? 0.62, 0.05, 1);
  const yScale = linearScale(domain, { start: plot.y + plot.height, end: plot.y });
  const baselineValue = domain.min <= 0 && domain.max >= 0 ? 0 : domain.min;
  const baselineY = yScale(baselineValue);
  const band = plot.width / n;
  const barWidth = band * barRatio;
  const offset = (band - barWidth) / 2;

  return values.map((value, index) => {
    const safeValue = Number.isFinite(value) ? value : baselineValue;
    const valueY = yScale(safeValue);
    const top = Math.min(valueY, baselineY);
    const height = Math.max(0, Math.abs(valueY - baselineY));
    return {
      x: round(plot.x + band * index + offset),
      y: round(top),
      width: round(barWidth),
      height: round(height),
      index,
    };
  });
}

export function pointsToAttr(points: readonly Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Build a smooth SVG `path` `d` string through points using a monotone-ish
 * Catmull-Rom → cubic Bézier conversion. `tension` 0 gives a straight polyline;
 * higher values round the corners. Used by LineChart/Sparkline when `smooth` is
 * on; the straight variant just reuses `pointsToAttr` on a polyline.
 */
export function smoothPath(points: readonly Point[], tension = 0.5): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  }
  const t = clamp(tension, 0, 1) / 6;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Close a line path into a filled area by dropping to the baseline under the
 * first and last points. Given the line's `d` (or polyline points) and the
 * baseline Y, returns a `path` `d` that fills between the line and the axis —
 * used for the subtle area gradient under a LineChart/Sparkline.
 */
export function areaPath(points: readonly Point[], baselineY: number, smooth = false, tension = 0.5): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const top = smooth ? smoothPath(points, tension) : `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  return `${top} L ${last.x} ${round(baselineY)} L ${first.x} ${round(baselineY)} Z`;
}

/** Cycle a categorical color ramp, wrapping at the end (matches palette.chart). */
export function rampColor(ramp: readonly string[], index: number, fallback = "#4f46e5"): string {
  if (ramp.length === 0) return fallback;
  return ramp[((index % ramp.length) + ramp.length) % ramp.length];
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerce a `{ label?, value }` | number series entry to its numeric value. */
export function entryValue(entry: unknown): number {
  if (typeof entry === "number") return entry;
  if (entry && typeof entry === "object" && "value" in entry) {
    const v = (entry as { value: unknown }).value;
    return typeof v === "number" ? v : Number.NaN;
  }
  return Number.NaN;
}

/** Coerce a `{ label?, value }` | number series entry to its optional label. */
export function entryLabel(entry: unknown): string | undefined {
  if (entry && typeof entry === "object" && "label" in entry) {
    const l = (entry as { label: unknown }).label;
    return typeof l === "string" ? l : undefined;
  }
  return undefined;
}

/**
 * Format an axis tick value compactly: integers stay integer, thousands get a
 * `k` suffix, and fractional values keep one decimal. Keeps Y-axis labels from
 * sprawling (e.g. `1.2k` instead of `1200`).
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
