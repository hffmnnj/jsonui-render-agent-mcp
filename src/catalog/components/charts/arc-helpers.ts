/**
 * Arc / radial geometry helpers for the radial chart family (PieChart/Donut,
 * ProgressRing/Gauge). Pure math — no rendering, no React — so it is trivially
 * unit-testable and shared by every radial component's Satori render case.
 *
 * SVG ANGLE CONVENTION (the one thing everyone gets wrong): SVG's coordinate
 * system has +y pointing DOWN, and we adopt the common data-viz convention of
 * measuring angles CLOCKWISE from 12 o'clock (the top). So an angle of 0° is the
 * top of the circle, 90° is the 3 o'clock position, 180° is the bottom, 270° is
 * 9 o'clock. `polarToCartesian` bakes that convention in; every other helper is
 * expressed in these "clock degrees" so callers never touch raw trig.
 *
 * THE DEGENERATE-ARC GOTCHA (the highest-risk part of radial SVG): an SVG arc
 * `A` command draws the arc BETWEEN two distinct endpoints. If the start and end
 * points coincide — which is exactly what a full 360° sweep produces, since
 * 0° and 360° map to the same cartesian point — the renderer sees a zero-length
 * arc and draws NOTHING (or an undefined result). A 100% pie slice or a 100%
 * progress ring hits this. The fix, implemented in `arcPath`, is to split any
 * near-full sweep into two sub-arcs (each < 360°) so both endpoints are always
 * distinct. `ringPath`/`slicePath` build on `arcPath` and inherit the fix.
 */

/** A point in the SVG coordinate space. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One input datum for a pie/donut chart. */
export interface SliceDatum {
  readonly label?: string;
  readonly value: number;
}

/** A computed slice: its geometry plus the source datum and its share of total. */
export interface SliceGeometry {
  readonly label?: string;
  readonly value: number;
  /** Fraction of the total (0–1). Zero-value slices report 0 and are skipped. */
  readonly fraction: number;
  /** Sweep start angle in clock degrees (clockwise from top). */
  readonly startAngle: number;
  /** Sweep end angle in clock degrees. */
  readonly endAngle: number;
  /** Midpoint angle, handy for placing a label or a callout. */
  readonly midAngle: number;
  /** Index into the source data array (stable for palette cycling). */
  readonly index: number;
}

/**
 * A sweep at or above this many degrees is treated as "full" and split into two
 * sub-arcs to dodge the coincident-endpoint gotcha. 359.999° avoids float noise
 * while staying visually indistinguishable from a complete circle.
 */
const FULL_CIRCLE_THRESHOLD = 359.999;

/** Clamp helper — keeps ratios in range without pulling in a dependency. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert a clock-degree angle (clockwise from 12 o'clock) into an SVG cartesian
 * point on the circle of the given `radius` around `center`.
 *
 * Derivation: standard math angles run counter-clockwise from the +x axis
 * (3 o'clock). To rotate our origin to the top and reverse the direction to
 * clockwise, we use θ = (angle − 90)° in radians, then x = cx + r·cos θ and
 * y = cy + r·sin θ. Because SVG's +y is down, this sin term already produces the
 * clockwise sweep we want.
 */
export function polarToCartesian(
  center: Point,
  radius: number,
  angleDeg: number
): Point {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(angleRad),
    y: center.y + radius * Math.sin(angleRad),
  };
}

/**
 * Build the `d` attribute for a single stroked arc (an open curve, no fill)
 * along the circle of `radius` around `center`, sweeping CLOCKWISE from
 * `startAngle` to `endAngle` (both in clock degrees).
 *
 * Handles the degenerate cases explicitly:
 *   - A sweep of ~0° yields an empty path (nothing to draw) rather than a
 *     malformed command.
 *   - A sweep of ~360° (start == end point) is split into two half-sweeps so
 *     each `A` command has distinct endpoints and the full circle actually
 *     renders. This is the ProgressRing "100%" / PieChart "single 100% slice"
 *     fix.
 */
export function arcPath(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;

  // Nothing to draw for a zero (or negative) sweep.
  if (sweep <= 0.0001) return "";

  // Full circle: split into two arcs so neither has coincident endpoints.
  if (sweep >= FULL_CIRCLE_THRESHOLD) {
    const mid = startAngle + sweep / 2;
    return `${arcPath(center, radius, startAngle, mid)} ${arcPath(center, radius, mid, endAngle)}`.trim();
  }

  const start = polarToCartesian(center, radius, startAngle);
  const end = polarToCartesian(center, radius, endAngle);
  // large-arc-flag is 1 when the sweep exceeds a semicircle. sweep-flag is 1
  // for the clockwise direction (which matches our clock-degree convention).
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

/**
 * Build the `d` attribute for a FILLED pie/donut slice wedge sweeping from
 * `startAngle` to `endAngle`. With `innerRadius` of 0 it is a full pie wedge
 * (arc out to the rim, two straight edges back to the center). With a positive
 * `innerRadius` it is a donut segment (outer arc, radial edge in, inner arc
 * back, radial edge out) — a closed ring band.
 *
 * The full-circle case is handled without splitting the path here: a 360° pie
 * slice is emitted as a full outer circle (and, for a donut, an inner circle
 * subtracted via an even-odd sub-path) using two half-arcs, because a wedge with
 * coincident straight edges collapses. Callers that only ever pass a single
 * 100% slice therefore still get a solid disc/ring.
 */
export function slicePath(
  center: Point,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.0001) return "";

  const isDonut = innerRadius > 0;

  // Full circle wedge → draw as a ring/disc built from two half-arcs so there
  // are no coincident straight edges to collapse.
  if (sweep >= FULL_CIRCLE_THRESHOLD) {
    const outer = fullCircleSubPath(center, outerRadius);
    if (!isDonut) return outer;
    // Donut: outer circle then inner circle wound the opposite way so an
    // even-odd / nonzero fill punches the hole out.
    const inner = fullCircleSubPath(center, innerRadius, true);
    return `${outer} ${inner}`;
  }

  const outerStart = polarToCartesian(center, outerRadius, startAngle);
  const outerEnd = polarToCartesian(center, outerRadius, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  if (!isDonut) {
    // Pie wedge: center → rim start → arc to rim end → back to center.
    return [
      `M ${round(center.x)} ${round(center.y)}`,
      `L ${round(outerStart.x)} ${round(outerStart.y)}`,
      `A ${round(outerRadius)} ${round(outerRadius)} 0 ${largeArc} 1 ${round(outerEnd.x)} ${round(outerEnd.y)}`,
      "Z",
    ].join(" ");
  }

  // Donut band: outer arc (CW), radial edge inward, inner arc (CCW), close.
  const innerStart = polarToCartesian(center, innerRadius, endAngle);
  const innerEnd = polarToCartesian(center, innerRadius, startAngle);
  return [
    `M ${round(outerStart.x)} ${round(outerStart.y)}`,
    `A ${round(outerRadius)} ${round(outerRadius)} 0 ${largeArc} 1 ${round(outerEnd.x)} ${round(outerEnd.y)}`,
    `L ${round(innerStart.x)} ${round(innerStart.y)}`,
    `A ${round(innerRadius)} ${round(innerRadius)} 0 ${largeArc} 0 ${round(innerEnd.x)} ${round(innerEnd.y)}`,
    "Z",
  ].join(" ");
}

/**
 * A closed full-circle sub-path built from two 180° arcs (top→bottom→top), so
 * it never relies on coincident endpoints. `reverse` winds it counter-clockwise
 * for use as a donut hole under an even-odd fill.
 */
function fullCircleSubPath(center: Point, radius: number, reverse = false): string {
  const top = polarToCartesian(center, radius, 0);
  const bottom = polarToCartesian(center, radius, 180);
  const sweepFlag = reverse ? 0 : 1;
  return [
    `M ${round(top.x)} ${round(top.y)}`,
    `A ${round(radius)} ${round(radius)} 0 1 ${sweepFlag} ${round(bottom.x)} ${round(bottom.y)}`,
    `A ${round(radius)} ${round(radius)} 0 1 ${sweepFlag} ${round(top.x)} ${round(top.y)}`,
    "Z",
  ].join(" ");
}

/**
 * Compute slice boundaries for a pie/donut from a data series. Slices sweep
 * clockwise from the top (`startOffset`, default 0°), each proportional to its
 * value / total. Zero-value (and negative) data points are given a 0 fraction
 * and a zero-length sweep so they neither occupy space nor crash the arc math;
 * consumers should skip emitting a path for any slice whose `fraction` is 0.
 *
 * If the total is 0 (all values zero/empty), every slice reports fraction 0 and
 * the caller renders an empty ring — again, no crash.
 */
export function computeSlices(
  data: readonly SliceDatum[],
  startOffset = 0
): SliceGeometry[] {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const slices: SliceGeometry[] = [];

  let cursor = startOffset;
  data.forEach((datum, index) => {
    const safeValue = Math.max(0, datum.value);
    const fraction = total > 0 ? safeValue / total : 0;
    const sweep = fraction * 360;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    slices.push({
      label: datum.label,
      value: datum.value,
      fraction,
      startAngle,
      endAngle,
      midAngle: startAngle + sweep / 2,
      index,
    });
    cursor = endAngle;
  });

  return slices;
}

/** Round to 3 decimals to keep `d` strings compact and deterministic. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export { FULL_CIRCLE_THRESHOLD };
