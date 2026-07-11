import { z } from "zod";

const colorValue = z.union([z.string(), z.object({ $theme: z.string() })]);
/** A string prop that may instead be supplied as a `$theme` ref (e.g. an
 * `elevation.*` box-shadow token that resolves to a literal shadow string). */
const themeableString = z.union([z.string(), z.object({ $theme: z.string() })]);
/** A numeric prop that may instead be supplied as a `$theme` ref (e.g. a
 * `radius.*` / `spacing.*` token that resolves to a literal px number). */
const themeableNumber = z.union([z.number(), z.object({ $theme: z.string() })]);
const alignItems = z.enum(["flex-start", "center", "flex-end", "stretch"]);
const justifyContent = z.enum([
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
]);
const flexDirection = z.enum(["row", "column"]);

export const framePropsSchema = z.object({
  width: z.number(),
  height: z.number(),
  backgroundColor: colorValue.nullable().optional(),
  padding: z.number().nullable().optional(),
  display: z.enum(["flex", "none"]).nullable().optional(),
  flexDirection: flexDirection.nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
});
export type FrameProps = z.infer<typeof framePropsSchema>;

export const boxPropsSchema = z.object({
  padding: z.number().nullable().optional(),
  paddingTop: z.number().nullable().optional(),
  paddingBottom: z.number().nullable().optional(),
  paddingLeft: z.number().nullable().optional(),
  paddingRight: z.number().nullable().optional(),
  margin: z.number().nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
  width: z.union([z.number(), z.string()]).nullable().optional(),
  height: z.union([z.number(), z.string()]).nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  flexDirection: flexDirection.nullable().optional(),
  position: z.enum(["relative", "absolute"]).nullable().optional(),
  top: z.number().nullable().optional(),
  left: z.number().nullable().optional(),
  right: z.number().nullable().optional(),
  bottom: z.number().nullable().optional(),
  overflow: z.enum(["visible", "hidden"]).nullable().optional(),
});
export type BoxProps = z.infer<typeof boxPropsSchema>;

export const stackPropsSchema = z.object({
  gap: z.number().nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type StackProps = z.infer<typeof stackPropsSchema>;

export const rowPropsSchema = z.object({
  gap: z.number().nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
  wrap: z.boolean().nullable().optional(),
});
export type RowProps = z.infer<typeof rowPropsSchema>;

export const textPropsSchema = z.object({
  text: z.string(),
  fontSize: z.number().nullable().optional(),
  color: colorValue.nullable().optional(),
  align: z.enum(["left", "center", "right"]).nullable().optional(),
  fontWeight: z.enum(["normal", "bold"]).nullable().optional(),
  fontStyle: z.enum(["normal", "italic"]).nullable().optional(),
  lineHeight: z.number().nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  textDecoration: z.enum(["none", "underline", "line-through"]).nullable().optional(),
});
export type TextProps = z.infer<typeof textPropsSchema>;

export const headingPropsSchema = z.object({
  text: z.string(),
  level: z.enum(["h1", "h2", "h3", "h4"]).nullable().optional(),
  color: colorValue.nullable().optional(),
  align: z.enum(["left", "center", "right"]).nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  lineHeight: z.number().nullable().optional(),
});
export type HeadingProps = z.infer<typeof headingPropsSchema>;

/* ------------------------------------------------------------------ *
 * Content primitives (Wave 3, Task 3.2): Badge, Avatar, Alert, List. *
 *                                                                     *
 * Variant enums are ergonomic hints; the concrete per-variant colors *
 * are supplied by the spec author as `$theme` refs on the explicit   *
 * color props below (e.g. `{ $theme: "color.danger.subtle" }`), so   *
 * they resolve to literals through the SAME theme-resolution pass as  *
 * every other component before ever reaching Satori.                 *
 * ------------------------------------------------------------------ */

/** Shared status/intent variants mapped to the palette's semantic slots. */
const statusVariant = z.enum([
  "default",
  "accent",
  "danger",
  "success",
  "warning",
  "info",
]);

/**
 * Badge — a small inline pill label. `backgroundColor`/`color`/`borderColor`
 * accept `$theme` refs pointing at a status slot (e.g. `color.success.bg` /
 * `color.success.fg`); `variant` records the author's intent for discovery.
 */
export const badgePropsSchema = z.object({
  text: z.string(),
  variant: statusVariant.nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).nullable().optional(),
  paddingX: z.number().nullable().optional(),
  paddingY: z.number().nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  uppercase: z.boolean().nullable().optional(),
});
export type BadgeProps = z.infer<typeof badgePropsSchema>;

/**
 * Avatar — a circular identity marker. `mode: "initials"` renders text on a
 * tinted disc (primary, always-supported mode); `mode: "image"` renders an
 * `<img>` and REQUIRES a base64 `data:` URI in `src` — remote URLs are not
 * fetched at render time (network access is a banned anti-pattern), so an
 * `image` avatar without a data URI falls back to the initials disc.
 */
export const avatarPropsSchema = z.object({
  mode: z.enum(["initials", "image"]).nullable().optional(),
  initials: z.string().nullable().optional(),
  src: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  shape: z.enum(["circle", "rounded", "square"]).nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).nullable().optional(),
});
export type AvatarProps = z.infer<typeof avatarPropsSchema>;

/**
 * Alert — a bordered, tinted callout. `variant` records intent; the author
 * supplies the tint/border/foreground via `$theme` status-slot refs
 * (`color.<status>.subtle` / `.border` / `.bg`). `title` is optional; the body
 * `text` is required.
 */
export const alertPropsSchema = z.object({
  text: z.string(),
  title: z.string().nullable().optional(),
  variant: z.enum(["info", "success", "warning", "danger", "neutral"]).nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  titleColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  accentColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  padding: z.number().nullable().optional(),
  gap: z.number().nullable().optional(),
  showAccentBar: z.boolean().nullable().optional(),
});
export type AlertProps = z.infer<typeof alertPropsSchema>;

/**
 * List — a vertical list of items. Each item is either a plain string or a
 * structured `{ text, secondary? }` row. `marker` selects the bullet style;
 * `gap` controls the space between rows. Colors accept `$theme` refs.
 */
const listItem = z.union([
  z.string(),
  z.object({
    text: z.string(),
    secondary: z.string().nullable().optional(),
  }),
]);

export const listPropsSchema = z.object({
  items: z.array(listItem).min(1),
  marker: z.enum(["none", "disc", "dash", "check", "number"]).nullable().optional(),
  gap: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  color: colorValue.nullable().optional(),
  secondaryColor: colorValue.nullable().optional(),
  markerColor: colorValue.nullable().optional(),
  lineHeight: z.number().nullable().optional(),
});
export type ListProps = z.infer<typeof listPropsSchema>;

// --- Layout primitives (Wave 3, Task 3.1): Grid, Spacer, Divider ---

/**
 * Grid — an equal-column layout. Satori/Yoga has no CSS-grid support, so this
 * is a flex-wrap grid: `columns` equal-width cells per row, wrapping to new
 * rows as children overflow, separated by a token-driven `gap`. Prefer this
 * over a hand-rolled Row+wrap when you want uniform column widths.
 */
export const gridPropsSchema = z.object({
  /** Number of equal-width columns per row. Defaults to 2. */
  columns: z.number().int().positive().nullable().optional(),
  /** Spacing between cells (both row and column axes), in px. */
  gap: z.number().nullable().optional(),
  /** Cross-axis alignment of cells within a row. */
  alignItems: alignItems.nullable().optional(),
  /** Main-axis distribution of cells within a row. */
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type GridProps = z.infer<typeof gridPropsSchema>;

/**
 * Spacer — an empty sizing element. Either fixed (`size` px on both axes, holds
 * a gap in a Row or Stack) or flexible (`grow: true` => `flex: 1`, absorbs the
 * remaining main-axis space to push siblings apart). No children.
 */
export const spacerPropsSchema = z.object({
  /** Fixed size in px applied to both width and height. Ignored when grow. */
  size: z.number().nonnegative().nullable().optional(),
  /** When true, expands to fill remaining main-axis space (`flex: 1`). */
  grow: z.boolean().nullable().optional(),
});
export type SpacerProps = z.infer<typeof spacerPropsSchema>;

/**
 * Divider — a thin separator line. `orientation` picks the axis: a horizontal
 * divider is a full-width hairline (height = `thickness`); a vertical divider is
 * a full-height hairline (width = `thickness`). Color is token-driven; pass
 * `{ $theme: "color.border" }` to track the theme's border color.
 */
export const dividerPropsSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]).nullable().optional(),
  /** Line color. Use a `$theme.color.*` ref (e.g. color.border) for theming. */
  color: colorValue.nullable().optional(),
  /** Line thickness in px. Defaults to 1 (a crisp hairline). */
  thickness: z.number().positive().nullable().optional(),
  /**
   * Optional length along the main axis. A number is px; a string (e.g.
   * "50%") is passed through. Defaults to the full cross length ("100%").
   */
  length: z.union([z.number(), z.string()]).nullable().optional(),
  /** Optional margin around the line, in px. */
  margin: z.number().nullable().optional(),
});
export type DividerProps = z.infer<typeof dividerPropsSchema>;

/* ------------------------------------------------------------------ *
 * Composite primitives (Wave 3, Task 3.3): Card, Table, Progress.     *
 *                                                                     *
 * Card is REGION-BEARING: because the spec tree is a flat keyed map   *
 * whose `children` are element KEYS, Card's optional `header`/`footer`*
 * regions are likewise arrays of element keys (resolved through the   *
 * same renderer), while the required `body` uses the standard         *
 * `children` slot. Table and Progress are self-contained leaf-data    *
 * components — they carry their data in props and emit no child keys. *
 *                                                                     *
 * Every visual color is supplied as a `$theme` ref (or filled by      *
 * `componentDefaults`) so it resolves to a literal through the SAME   *
 * theme pass as every other component — no hardcoded colors survive   *
 * into Satori.                                                        *
 * ------------------------------------------------------------------ */

/**
 * Card — a surface container with optional `header` and `footer` regions and a
 * required `body`. `header`/`footer` are arrays of child-element keys (rendered
 * in their own padded regions, separated from the body by a hairline);  the
 * body is supplied via the standard `children` slot. Surface background, border,
 * radius, padding, and elevation are token-driven (filled by `componentDefaults`
 * when omitted, so a bare Card is still theme-correct).
 */
export const cardPropsSchema = z.object({
  /** Child-element keys rendered in the header region (above the body). */
  header: z.array(z.string()).nullable().optional(),
  /** Child-element keys rendered in the footer region (below the body). */
  footer: z.array(z.string()).nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderRadius: themeableNumber.nullable().optional(),
  /** Uniform inner padding for every region, in px. */
  padding: themeableNumber.nullable().optional(),
  /** Spacing between stacked body children, in px. */
  gap: themeableNumber.nullable().optional(),
  /** Box-shadow string (usually a `$theme: "elevation.*"` ref). */
  elevation: themeableString.nullable().optional(),
  /** Hairline color drawn between header/body/footer regions. */
  dividerColor: colorValue.nullable().optional(),
  width: z.union([z.number(), z.string()]).nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type CardProps = z.infer<typeof cardPropsSchema>;

/**
 * A single table cell — a plain string, or a `{ text, align?, color? }` object
 * for per-cell alignment/emphasis. Colors accept `$theme` refs.
 */
const tableCell = z.union([
  z.string(),
  z.object({
    text: z.string(),
    align: z.enum(["left", "center", "right"]).nullable().optional(),
    color: colorValue.nullable().optional(),
  }),
]);

/** A table row — either a bare array of cells or a `{ cells }` wrapper. */
const tableRow = z.union([
  z.array(tableCell),
  z.object({ cells: z.array(tableCell) }),
]);

/**
 * Table — a header row plus data rows. `header` is an optional array of column
 * cells styled distinctly (semibold on a muted surface); `rows` is the required
 * body (each row an array of cells or a `{ cells }` object). Alternating-row
 * striping (`striped`, default on) and cell padding are token-driven. All colors
 * accept `$theme` refs and fall back to theme-correct defaults.
 */
export const tablePropsSchema = z.object({
  header: z.array(tableCell).nullable().optional(),
  rows: z.array(tableRow).min(1),
  /** Zebra-stripe alternate body rows. Defaults to true. */
  striped: z.boolean().nullable().optional(),
  /** Draw a hairline under each row. Defaults to true. */
  rowBorders: z.boolean().nullable().optional(),
  cellPaddingX: z.number().nullable().optional(),
  cellPaddingY: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  headerBackgroundColor: colorValue.nullable().optional(),
  headerColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  stripeColor: colorValue.nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  borderWidth: z.number().nullable().optional(),
});
export type TableProps = z.infer<typeof tablePropsSchema>;

/**
 * Progress — a linear progress bar. The fill width is `value / max` clamped to
 * 0–100%. Track and fill colors, `height`, and `radius` are token-driven. An
 * optional `label` / percentage readout can sit above the bar.
 */
export const progressPropsSchema = z.object({
  value: z.number(),
  /** Denominator for the fill ratio. Defaults to 100. */
  max: z.number().positive().nullable().optional(),
  /** Track (background) color. Use a `$theme.color.*` ref. */
  trackColor: colorValue.nullable().optional(),
  /** Fill (accent) color. Use a `$theme.color.*` ref. */
  fillColor: colorValue.nullable().optional(),
  /** Bar height in px. Defaults to 8. */
  height: z.number().positive().nullable().optional(),
  /** Corner radius in px. Defaults to a pill (height / 2). */
  radius: z.number().nonnegative().nullable().optional(),
  /** Optional caption shown above the bar. */
  label: z.string().nullable().optional(),
  /** Show the computed percentage next to the label. Defaults to false. */
  showValue: z.boolean().nullable().optional(),
  labelColor: colorValue.nullable().optional(),
  fontSize: z.number().nullable().optional(),
  width: z.union([z.number(), z.string()]).nullable().optional(),
});
export type ProgressProps = z.infer<typeof progressPropsSchema>;

/* ------------------------------------------------------------------ *
 * Radial charts (Wave 4, Task 4.2): PieChart/Donut, ProgressRing.     *
 *                                                                     *
 * These are hand-authored inline-SVG components (arc `path` + `circle`)*
 * rendered inside Satori's flexbox layout — no canvas charting lib.   *
 * Slice/segment colors cycle the palette's categorical `color.chart`  *
 * ramp: an author passes `colors: { $theme: "color.chart" }`, which   *
 * the theme pass resolves to the literal string[] ramp for the theme. *
 * Any label text is drawn as a normal Satori <div> overlay, never an  *
 * SVG <text> node (Satori rejects those in this version).             *
 * ------------------------------------------------------------------ */

/**
 * A palette ramp prop — an ordered array of literal color strings a chart cycles
 * through and wraps. Supplied either inline or, preferably, as a single `$theme`
 * ref to `color.chart` (which resolves to the whole ramp array).
 */
const colorRamp = z.union([z.array(z.string()), z.object({ $theme: z.string() })]);

/** One pie/donut data point: a numeric `value` with an optional `label`. */
const pieSlice = z.object({
  label: z.string().nullable().optional(),
  value: z.number(),
  /** Optional explicit color override for this slice (else the ramp is used). */
  color: colorValue.nullable().optional(),
});

/**
 * PieChart — a proportional pie or donut. `data` is the required series; each
 * slice's angle is its `value` share of the total. `innerRadius` > 0 (or the
 * `donut` shorthand) cuts a center hole to make a donut. Slice fills cycle the
 * `colors` ramp (pass `{ $theme: "color.chart" }`). A single 100% slice renders
 * as a solid disc/ring (the full-circle arc case is handled, not degenerate).
 * `centerLabel`/`centerValue` place text in a donut's hole.
 */
export const pieChartPropsSchema = z.object({
  data: z.array(pieSlice).min(1),
  /** Overall square size of the chart in px. Defaults to 200. */
  size: z.number().positive().nullable().optional(),
  /** Inner hole radius in px. 0 = full pie; > 0 = donut. */
  innerRadius: z.number().nonnegative().nullable().optional(),
  /** Shorthand: `true` makes a donut with a sensible default hole. */
  donut: z.boolean().nullable().optional(),
  /** Categorical fill ramp; cycles + wraps across slices. */
  colors: colorRamp.nullable().optional(),
  /** Gap (px) drawn between slices as a stroke in the background color. */
  padAngle: z.number().nonnegative().nullable().optional(),
  /** Background color painted behind slice gaps (usually the surface token). */
  backgroundColor: colorValue.nullable().optional(),
  /** Big value shown centered inside a donut hole. */
  centerLabel: z.string().nullable().optional(),
  /** Small caption under `centerLabel`. */
  centerValue: z.string().nullable().optional(),
  centerLabelColor: colorValue.nullable().optional(),
  centerValueColor: colorValue.nullable().optional(),
});
export type PieChartProps = z.infer<typeof pieChartPropsSchema>;

/**
 * ProgressRing — a circular progress indicator (a.k.a. gauge). A full track
 * `circle` plus a partial arc `path` filled to `value / max` (clamped 0–100%).
 * Renders correctly at the extremes: 0% draws only the track (no degenerate
 * zero-length arc), 100% draws a complete ring (the full-circle case is split
 * into two arcs, not a broken single arc). An optional centered `label` /
 * `sublabel` reads the value.
 */
export const progressRingPropsSchema = z.object({
  value: z.number(),
  /** Denominator for the fill ratio. Defaults to 100. */
  max: z.number().positive().nullable().optional(),
  /** Overall square size in px. Defaults to 160. */
  size: z.number().positive().nullable().optional(),
  /** Ring stroke thickness in px. Defaults to a proportion of `size`. */
  thickness: z.number().positive().nullable().optional(),
  /** Track (unfilled) ring color. Use a `$theme.color.*` ref. */
  trackColor: colorValue.nullable().optional(),
  /** Progress arc color. Use a `$theme.color.*` ref. */
  fillColor: colorValue.nullable().optional(),
  /** Round the ends of the progress arc. Defaults to true. */
  rounded: z.boolean().nullable().optional(),
  /** Clock-degree angle the fill starts at (0 = top). Defaults to 0. */
  startAngle: z.number().nullable().optional(),
  /** Big centered readout (e.g. the percentage). */
  label: z.string().nullable().optional(),
  /** When true and no `label` given, auto-shows the computed percentage. */
  showValue: z.boolean().nullable().optional(),
  /** Small caption under the label. */
  sublabel: z.string().nullable().optional(),
  labelColor: colorValue.nullable().optional(),
  sublabelColor: colorValue.nullable().optional(),
});
export type ProgressRingProps = z.infer<typeof progressRingPropsSchema>;

/* ------------------------------------------------------------------ *
 * Axis / series charts (Wave 4, Task 4.1): BarChart, LineChart,       *
 * Sparkline.                                                          *
 *                                                                     *
 * Hand-authored inline-SVG charts (rect / polyline / path / line /    *
 * circle) rendered inside Satori's flexbox layout — no canvas lib.    *
 * Series/bar colors cycle the palette's categorical `color.chart`     *
 * ramp: pass `colors: { $theme: "color.chart" }` (shared `colorRamp`  *
 * above) and the theme pass resolves it to the literal ramp array.    *
 * Satori rejects SVG <text>, so axis/value LABELS are drawn as Satori *
 * <div> overlays around the plot, never as SVG text nodes.            *
 * ------------------------------------------------------------------ */

/**
 * One data point on an axis chart. Either a bare number, or a
 * `{ label?, value }` object so bars/points can carry an x-axis label. Mixed
 * arrays are allowed (a labelled point next to a bare number).
 */
const seriesPoint = z.union([
  z.number(),
  z.object({
    value: z.number(),
    label: z.string().nullable().optional(),
  }),
]);

/**
 * BarChart — a vertical bar chart for a single categorical series. `data` is
 * the required array of `{ label, value }` (or bare numbers); each bar's height
 * encodes its value against a zero-anchored axis. Bar fills cycle the `colors`
 * ramp (pass `{ $theme: "color.chart" }`) unless a single `barColor` is given.
 * `showGrid`/`showAxisLabels`/`showValueLabels` toggle the gridlines, the
 * per-bar x labels, and the Y-axis tick labels — all drawn as div overlays.
 */
export const barChartPropsSchema = z.object({
  data: z.array(seriesPoint).min(1),
  /** Overall chart width in px. Defaults to 360. */
  width: z.number().positive().nullable().optional(),
  /** Overall chart height in px. Defaults to 200. */
  height: z.number().positive().nullable().optional(),
  /** Categorical bar-fill ramp; cycles + wraps across bars. */
  colors: colorRamp.nullable().optional(),
  /** Single fill for every bar (overrides the ramp when set). */
  barColor: colorValue.nullable().optional(),
  /** Fraction of each band the bar occupies (0–1). Defaults to 0.62. */
  barRatio: z.number().positive().max(1).nullable().optional(),
  /** Bar corner radius in px. Defaults to a small crisp round. */
  barRadius: z.number().nonnegative().nullable().optional(),
  /** Draw horizontal gridlines at the Y ticks. Defaults to true. */
  showGrid: z.boolean().nullable().optional(),
  /** Draw the per-bar x-axis labels (needs `{ label }` data). Defaults to true. */
  showAxisLabels: z.boolean().nullable().optional(),
  /** Draw the Y-axis tick labels. Defaults to true. */
  showValueLabels: z.boolean().nullable().optional(),
  gridColor: colorValue.nullable().optional(),
  axisColor: colorValue.nullable().optional(),
  labelColor: colorValue.nullable().optional(),
});
export type BarChartProps = z.infer<typeof barChartPropsSchema>;

/**
 * LineChart — one or more line series over a shared axis. `series` is an array
 * of `{ name?, data }` (each `data` a numeric/`{value}` series); a single-series
 * shorthand `data` is also accepted. Lines cycle the `colors` ramp per series,
 * optionally rendered `smooth` (Bézier) with points and a subtle filled `area`.
 * Gridlines, Y-tick labels, and x labels are div overlays (Satori-safe).
 */
export const lineSeries = z.object({
  name: z.string().nullable().optional(),
  data: z.array(seriesPoint).min(1),
  /** Optional explicit color for this series (else the ramp is used). */
  color: colorValue.nullable().optional(),
});

export const lineChartPropsSchema = z
  .object({
    /** Multi-series input. Provide this OR the single-series `data` shorthand. */
    series: z.array(lineSeries).min(1).nullable().optional(),
    /** Single-series shorthand (wrapped into one unnamed series). */
    data: z.array(seriesPoint).min(1).nullable().optional(),
    width: z.number().positive().nullable().optional(),
    height: z.number().positive().nullable().optional(),
    colors: colorRamp.nullable().optional(),
    /** Line stroke width in px. Defaults to 2. */
    strokeWidth: z.number().positive().nullable().optional(),
    /** Curve the lines with a Bézier smoothing. Defaults to false. */
    smooth: z.boolean().nullable().optional(),
    /** Draw a dot at each data point. Defaults to false. */
    showPoints: z.boolean().nullable().optional(),
    /** Fill a subtle area under a single line. Ignored for multi-series. */
    showArea: z.boolean().nullable().optional(),
    /** X labels taken from the first series' `{ label }` values. */
    axisLabels: z.array(z.string()).nullable().optional(),
    showGrid: z.boolean().nullable().optional(),
    showAxisLabels: z.boolean().nullable().optional(),
    showValueLabels: z.boolean().nullable().optional(),
    gridColor: colorValue.nullable().optional(),
    axisColor: colorValue.nullable().optional(),
    labelColor: colorValue.nullable().optional(),
  })
  .refine((v) => (v.series && v.series.length > 0) || (v.data && v.data.length > 0), {
    message: "LineChart requires either `series` or `data`.",
    path: ["series"],
  });
export type LineChartProps = z.infer<typeof lineChartPropsSchema>;

/**
 * Sparkline — a compact, axis-less mini line for inline use (e.g. beside a
 * Metric value). Just the trend line (optional `smooth`, `area`, end `dot`);
 * no gridlines, axes, or labels. Tightly fits its data (no forced zero baseline)
 * so the SHAPE of the trend reads at small sizes.
 */
export const sparklinePropsSchema = z.object({
  data: z.array(seriesPoint).min(2),
  /** Width in px. Defaults to 120. */
  width: z.number().positive().nullable().optional(),
  /** Height in px. Defaults to 32. */
  height: z.number().positive().nullable().optional(),
  /** Line color. Use a `$theme.color.*` ref. Defaults to the accent. */
  color: colorValue.nullable().optional(),
  strokeWidth: z.number().positive().nullable().optional(),
  smooth: z.boolean().nullable().optional(),
  /** Fill a translucent area under the line. Defaults to true. */
  showArea: z.boolean().nullable().optional(),
  /** Fill color for the area (else a faded form of the line color). */
  areaColor: colorValue.nullable().optional(),
  /** Draw a dot at the final point. Defaults to true. */
  showEndDot: z.boolean().nullable().optional(),
  endDotColor: colorValue.nullable().optional(),
});
export type SparklineProps = z.infer<typeof sparklinePropsSchema>;

/* ------------------------------------------------------------------ *
 * Metric / stat card (Wave 4, Task 4.3): the flagship "beautiful by   *
 * default" compact KPI tile.                                          *
 *                                                                     *
 * A Metric packs a big `value`, a `label`, an optional signed `delta` *
 * indicator, and an optional inline Sparkline. Text is rendered as    *
 * Satori flexbox <div> leaves (never SVG <text>); the Sparkline is    *
 * reused directly by composing its resolved props into the SAME       *
 * Sparkline render case — no trend-line logic is reimplemented. Every *
 * color is a `$theme` ref that resolves to a literal before Satori.   *
 * ------------------------------------------------------------------ */

/**
 * A Metric's delta / change indicator. `value` is the display string (already
 * formatted by the author, e.g. "12.4%" or "1.2k") — a metric that reports its
 * OWN units shouldn't guess them. `direction` drives the arrow glyph and the
 * success/danger tint; when omitted it is inferred from a leading sign in
 * `value`. `intent` lets the author invert the color mapping for metrics where
 * "down is good" (e.g. error rate, latency): `positive` is always the success
 * hue and `negative` the danger hue, regardless of the arrow direction.
 */
const metricDelta = z.object({
  value: z.string(),
  direction: z.enum(["up", "down", "flat"]).nullable().optional(),
  /** Force the color semantics independent of the arrow. */
  intent: z.enum(["positive", "negative", "neutral"]).nullable().optional(),
  /** Explicit color override (else success/danger/muted by intent/direction). */
  color: colorValue.nullable().optional(),
  /** Draw the up/down/flat arrow glyph before the value. Defaults to true. */
  showArrow: z.boolean().nullable().optional(),
});

/**
 * Metric — a compact stat / KPI card. `value` is the hero readout (large, bold);
 * `label` is the metric name/title; optional `caption` adds a secondary line
 * (e.g. a comparison period). `delta` renders a signed, tinted change chip with
 * an arrow glyph. `sparkline` embeds an inline trend by reusing the Sparkline
 * component's exact rendering (pass the same props a standalone Sparkline takes).
 * Surface, border, radius, padding, and elevation are token-driven, so a bare
 * Metric is already theme-correct and good-looking; pass `plain: true` to drop
 * the card surface and render just the stat (for placing inside another Card).
 */
export const metricPropsSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  /** Optional secondary line under the label (e.g. "vs. last month"). */
  caption: z.string().nullable().optional(),
  delta: metricDelta.nullable().optional(),
  /** Inline trend chart — takes the same props as the Sparkline component. */
  sparkline: sparklinePropsSchema.nullable().optional(),
  /** Where the sparkline sits relative to the value block. Defaults to "below". */
  sparklinePosition: z.enum(["below", "right"]).nullable().optional(),
  /** Drop the card surface (border/background/padding) — render bare. */
  plain: z.boolean().nullable().optional(),
  /** Optional small icon/emoji glyph shown beside the label. */
  icon: z.string().nullable().optional(),

  // --- token-driven styling (all accept `$theme` refs) ---
  backgroundColor: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderRadius: themeableNumber.nullable().optional(),
  padding: themeableNumber.nullable().optional(),
  elevation: themeableString.nullable().optional(),
  valueColor: colorValue.nullable().optional(),
  labelColor: colorValue.nullable().optional(),
  captionColor: colorValue.nullable().optional(),
  /** Success tint for a positive delta. Pass `{ $theme: "color.success.bg" }`. */
  positiveColor: colorValue.nullable().optional(),
  /** Danger tint for a negative delta. Pass `{ $theme: "color.danger.bg" }`. */
  negativeColor: colorValue.nullable().optional(),
  neutralColor: colorValue.nullable().optional(),
  /** Hero value font size in px. Defaults to the `display`/h1 scale. */
  valueFontSize: z.number().positive().nullable().optional(),
  labelFontSize: z.number().positive().nullable().optional(),
  width: z.union([z.number(), z.string()]).nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type MetricProps = z.infer<typeof metricPropsSchema>;
