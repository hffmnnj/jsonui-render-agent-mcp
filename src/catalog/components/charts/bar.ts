import { barChartPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const barChartComponent: ComponentDefinition = {
  props: barChartPropsSchema,
  slots: [],
  description:
    "Vertical bar chart for a single categorical series. `data` is an array of `{ label, value }` (or bare numbers); bars are zero-anchored. Bar fills cycle the `colors` ramp (pass `{ $theme: \"color.chart\" }`) unless a single `barColor` is set. Toggle gridlines, x-axis labels, and Y tick labels — all token-driven div overlays (Satori-safe, no SVG text).",
  example: {
    data: [
      { label: "Mon", value: 42 },
      { label: "Tue", value: 58 },
      { label: "Wed", value: 35 },
      { label: "Thu", value: 71 },
      { label: "Fri", value: 64 },
    ],
    width: 360,
    height: 200,
    colors: { $theme: "color.chart" },
    showGrid: true,
    gridColor: { $theme: "color.border" },
    labelColor: { $theme: "color.mutedForeground" },
  },
};
