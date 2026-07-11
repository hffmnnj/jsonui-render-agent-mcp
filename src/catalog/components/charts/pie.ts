import { pieChartPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const pieChartComponent: ComponentDefinition = {
  props: pieChartPropsSchema,
  slots: [],
  description:
    "Proportional pie or donut chart from a `data` series of `{ label, value }` points; each slice's angle is its share of the total. Set `donut: true` (or an `innerRadius`) for a ring. Slice fills cycle the categorical ramp — pass `colors: { $theme: \"color.chart\" }`. A single 100% slice renders as a solid disc/ring. Donut center can show `centerLabel`/`centerValue`.",
  example: {
    data: [
      { label: "Compute", value: 45 },
      { label: "Storage", value: 30 },
      { label: "Network", value: 25 },
    ],
    donut: true,
    size: 220,
    colors: { $theme: "color.chart" },
    backgroundColor: { $theme: "color.surface" },
    centerLabel: "100",
    centerValue: "units",
    centerLabelColor: { $theme: "color.foreground" },
    centerValueColor: { $theme: "color.mutedForeground" },
  },
};
