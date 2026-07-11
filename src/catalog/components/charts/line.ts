import { lineChartPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const lineChartComponent: ComponentDefinition = {
  props: lineChartPropsSchema,
  slots: [],
  description:
    "One or more line series over a shared axis. Provide `series` (`[{ name?, data }]`) or the single-series `data` shorthand. Lines cycle the `colors` ramp per series, optionally `smooth` (Bézier), with `showPoints` dots and a subtle `showArea` fill for a single line. Gridlines, Y ticks, and x labels are token-driven div overlays (no SVG text).",
  example: {
    series: [
      { name: "This week", data: [12, 19, 15, 27, 24, 33, 30] },
      { name: "Last week", data: [10, 14, 13, 18, 20, 22, 21] },
    ],
    axisLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    width: 420,
    height: 220,
    smooth: true,
    showPoints: true,
    colors: { $theme: "color.chart" },
    gridColor: { $theme: "color.border" },
    labelColor: { $theme: "color.mutedForeground" },
  },
};
