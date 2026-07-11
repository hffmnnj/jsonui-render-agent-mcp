import { schema as imageSchema } from "@json-render/image";
import { defineCatalog } from "@json-render/core";
import { z } from "zod";
import {
  alertPropsSchema,
  avatarPropsSchema,
  badgePropsSchema,
  barChartPropsSchema,
  boxPropsSchema,
  cardPropsSchema,
  dividerPropsSchema,
  framePropsSchema,
  gridPropsSchema,
  headingPropsSchema,
  lineChartPropsSchema,
  listPropsSchema,
  pieChartPropsSchema,
  progressPropsSchema,
  progressRingPropsSchema,
  rowPropsSchema,
  spacerPropsSchema,
  sparklinePropsSchema,
  stackPropsSchema,
  tablePropsSchema,
  textPropsSchema,
} from "./schema";

/**
 * The image schema requires a `visible` field on every element, but the
 * standard json-render image catalog treats visibility as optional in
 * practice. We mark the field optional here so specs omitting it validate.
 */
const specDefinition = imageSchema.definition as {
  spec: {
    inner: {
      elements: {
        inner: {
          inner: { visible?: { optional?: boolean } };
        };
      };
    };
  };
};
specDefinition.spec.inner.elements.inner.inner.visible = { optional: true };

export const schema = imageSchema;

export const catalog = defineCatalog(schema, {
  components: {
    Frame: {
      props: framePropsSchema,
      slots: ["default"],
      description:
        "Root image container. Defines the output image dimensions and background. Must be the root element.",
      example: { width: 1200, height: 630, backgroundColor: "#ffffff" },
    },
    Box: {
      props: boxPropsSchema,
      slots: ["default"],
      description:
        "Generic container with padding, margin, background, border, and flex alignment. Supports absolute positioning.",
      example: {
        padding: 20,
        backgroundColor: "#f9f9f9",
        borderRadius: 8,
        alignItems: "center",
      },
    },
    Stack: {
      props: stackPropsSchema,
      slots: ["default"],
      description: "Vertical flex layout. Use for stacking elements top to bottom.",
      example: { gap: 8, padding: 10 },
    },
    Row: {
      props: rowPropsSchema,
      slots: ["default"],
      description: "Horizontal flex layout. Use for placing elements side by side.",
      example: { gap: 10, alignItems: "center" },
    },
    Text: {
      props: textPropsSchema,
      slots: [],
      description: "Body text with configurable size, color, weight, and alignment.",
      example: { text: "Some content here.", fontSize: 16, color: "#333333" },
    },
    Heading: {
      props: headingPropsSchema,
      slots: [],
      description: "Heading text at various levels. h1 is largest, h4 is smallest.",
      example: { text: "Hello World", level: "h1", color: "#000000" },
    },
    Badge: {
      props: badgePropsSchema,
      slots: [],
      description:
        "Small inline pill label for statuses and tags. Set `variant` and supply matching `$theme` color refs (e.g. color.success.bg / .fg).",
      example: {
        text: "Active",
        variant: "success",
        backgroundColor: { $theme: "color.success.bg" },
        color: { $theme: "color.success.fg" },
      },
    },
    Avatar: {
      props: avatarPropsSchema,
      slots: [],
      description:
        "Circular identity marker. `mode: \"initials\"` (default) draws initials on a tinted disc; `mode: \"image\"` needs a base64 data: URI in `src` (remote URLs are not fetched).",
      example: {
        mode: "initials",
        initials: "JH",
        size: 48,
        backgroundColor: { $theme: "color.accent.bg" },
        color: { $theme: "color.accent.fg" },
      },
    },
    Alert: {
      props: alertPropsSchema,
      slots: [],
      description:
        "Bordered, tinted callout with optional title and required body text. Set `variant` and supply matching `$theme` refs (color.<status>.subtle / .border / .bg).",
      example: {
        title: "Heads up",
        text: "Your storage is almost full.",
        variant: "warning",
        backgroundColor: { $theme: "color.warning.subtle" },
        borderColor: { $theme: "color.warning.border" },
        titleColor: { $theme: "color.warning.bg" },
      },
    },
    List: {
      props: listPropsSchema,
      slots: [],
      description:
        "Vertical list of string or { text, secondary } items with a selectable marker (none/disc/dash/check/number).",
      example: {
        marker: "check",
        gap: 8,
        items: ["Backups enabled", { text: "2FA", secondary: "Recommended" }],
      },
    },
    Grid: {
      props: gridPropsSchema,
      slots: ["default"],
      description:
        "Equal-column grid layout (flex-wrap based). Children flow into `columns` equal-width cells per row, wrapping to new rows, separated by `gap`.",
      example: { columns: 3, gap: 16 },
    },
    Spacer: {
      props: spacerPropsSchema,
      slots: [],
      description:
        "Empty sizing element. Fixed `size` (px) holds a gap; `grow: true` (flex: 1) absorbs remaining space.",
      example: { size: 24 },
    },
    Divider: {
      props: dividerPropsSchema,
      slots: [],
      description:
        "Thin separator line. `orientation` picks the axis; pass a `$theme.color.*` color to track the theme.",
      example: { orientation: "horizontal", color: { $theme: "color.border" } },
    },
    Card: {
      props: cardPropsSchema,
      slots: ["default"],
      description:
        "Surface container with optional `header`/`footer` regions (arrays of child-element keys) and a required body (children slot). Background/border/radius/elevation are token-driven; a bare Card auto-themes.",
      example: {
        header: ["cardTitle"],
        footer: ["cardMeta"],
        elevation: { $theme: "elevation.md" },
        backgroundColor: { $theme: "color.surface" },
        borderColor: { $theme: "color.border" },
        borderRadius: { $theme: "radius.lg" },
      },
    },
    Table: {
      props: tablePropsSchema,
      slots: [],
      description:
        "Header row + data rows. `header` styles a distinct column row; `rows` is an array of cell arrays or { cells }. `striped` zebra-stripes body rows. Colors take `$theme` refs.",
      example: {
        header: ["Service", "Status", "Uptime"],
        rows: [
          ["API", "Operational", "99.98%"],
          ["Database", "Operational", "99.95%"],
        ],
        striped: true,
        headerBackgroundColor: { $theme: "color.surfaceMuted" },
        borderColor: { $theme: "color.border" },
      },
    },
    Progress: {
      props: progressPropsSchema,
      slots: [],
      description:
        "Linear progress bar. Fill width is `value / max` (default 100) clamped 0–100%. Track/fill colors and `height`/`radius` are token-driven; optional `label` with `showValue`.",
      example: {
        value: 72,
        label: "Storage used",
        showValue: true,
        trackColor: { $theme: "color.surfaceMuted" },
        fillColor: { $theme: "color.accent.bg" },
      },
    },
    PieChart: {
      props: pieChartPropsSchema,
      slots: [],
      description:
        "Proportional pie/donut chart from a `data` series of `{ label, value }`. Each slice's angle is its share of the total; `donut: true` (or `innerRadius`) cuts a center hole. Slice fills cycle the categorical ramp — pass `colors: { $theme: \"color.chart\" }`. A single 100% slice renders as a solid disc/ring.",
      example: {
        data: [
          { label: "Compute", value: 45 },
          { label: "Storage", value: 30 },
          { label: "Network", value: 25 },
        ],
        donut: true,
        colors: { $theme: "color.chart" },
        backgroundColor: { $theme: "color.surface" },
      },
    },
    ProgressRing: {
      props: progressRingPropsSchema,
      slots: [],
      description:
        "Circular progress indicator / gauge. A track ring plus an arc filled to `value / max` (clamped 0–100%); renders correctly at 0%, 50%, and 100%. Track/fill colors are token-driven; optional centered `label`/`showValue` and `sublabel`.",
      example: {
        value: 72,
        label: "72%",
        sublabel: "Uptime",
        trackColor: { $theme: "color.surfaceMuted" },
        fillColor: { $theme: "color.accent.bg" },
      },
    },
    BarChart: {
      props: barChartPropsSchema,
      slots: [],
      description:
        "Vertical bar chart for a single categorical series of `{ label, value }` (or bare numbers). Zero-anchored bars whose fills cycle the categorical ramp — pass `colors: { $theme: \"color.chart\" }` — or a single `barColor`. Optional gridlines, x-axis labels, and Y tick labels are token-driven div overlays.",
      example: {
        data: [
          { label: "Mon", value: 42 },
          { label: "Tue", value: 58 },
          { label: "Wed", value: 35 },
          { label: "Thu", value: 71 },
          { label: "Fri", value: 64 },
        ],
        colors: { $theme: "color.chart" },
        gridColor: { $theme: "color.border" },
        labelColor: { $theme: "color.mutedForeground" },
      },
    },
    LineChart: {
      props: lineChartPropsSchema,
      slots: [],
      description:
        "One or more line series over a shared axis. Provide `series` (`[{ name?, data }]`) or the single-series `data` shorthand. Lines cycle the ramp per series, optionally `smooth`, with `showPoints` and single-series `showArea`. Gridlines and labels are token-driven div overlays.",
      example: {
        series: [
          { name: "This week", data: [12, 19, 15, 27, 24, 33, 30] },
          { name: "Last week", data: [10, 14, 13, 18, 20, 22, 21] },
        ],
        axisLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        smooth: true,
        showPoints: true,
        colors: { $theme: "color.chart" },
        gridColor: { $theme: "color.border" },
        labelColor: { $theme: "color.mutedForeground" },
      },
    },
    Sparkline: {
      props: sparklinePropsSchema,
      slots: [],
      description:
        "Compact, axis-less mini line chart for inline use (e.g. beside a Metric value). Just the trend line with optional `smooth`, translucent `showArea`, and an end `showEndDot`. Tightly fits its data so the trend shape reads small. `color` takes a `$theme.color.*` ref.",
      example: {
        data: [4, 6, 5, 8, 7, 11, 9, 13],
        width: 120,
        height: 32,
        color: { $theme: "color.accent.bg" },
        smooth: true,
      },
    },
  },
});

export type Catalog = typeof catalog;

export type FrameProps = z.infer<typeof framePropsSchema>;
export type BoxProps = z.infer<typeof boxPropsSchema>;
export type StackProps = z.infer<typeof stackPropsSchema>;
export type RowProps = z.infer<typeof rowPropsSchema>;
export type TextProps = z.infer<typeof textPropsSchema>;
export type HeadingProps = z.infer<typeof headingPropsSchema>;
export type BadgeProps = z.infer<typeof badgePropsSchema>;
export type AvatarProps = z.infer<typeof avatarPropsSchema>;
export type AlertProps = z.infer<typeof alertPropsSchema>;
export type ListProps = z.infer<typeof listPropsSchema>;
export type GridProps = z.infer<typeof gridPropsSchema>;
export type SpacerProps = z.infer<typeof spacerPropsSchema>;
export type DividerProps = z.infer<typeof dividerPropsSchema>;
export type CardProps = z.infer<typeof cardPropsSchema>;
export type TableProps = z.infer<typeof tablePropsSchema>;
export type ProgressProps = z.infer<typeof progressPropsSchema>;
export type PieChartProps = z.infer<typeof pieChartPropsSchema>;
export type ProgressRingProps = z.infer<typeof progressRingPropsSchema>;
export type BarChartProps = z.infer<typeof barChartPropsSchema>;
export type LineChartProps = z.infer<typeof lineChartPropsSchema>;
export type SparklineProps = z.infer<typeof sparklinePropsSchema>;
