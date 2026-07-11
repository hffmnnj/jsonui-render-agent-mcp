import { sparklinePropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const sparklineComponent: ComponentDefinition = {
  props: sparklinePropsSchema,
  slots: [],
  description:
    "Compact, axis-less mini line chart for inline use (e.g. beside a Metric value). Just the trend line — no gridlines, axes, or labels — with optional `smooth` curve, translucent `showArea` fill, and an end `showEndDot`. Tightly fits its data so the trend SHAPE reads at small sizes. `color` takes a `$theme.color.*` ref.",
  example: {
    data: [4, 6, 5, 8, 7, 11, 9, 13],
    width: 120,
    height: 32,
    color: { $theme: "color.accent.bg" },
    smooth: true,
    showArea: true,
    showEndDot: true,
  },
};
