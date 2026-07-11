import { metricPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const metricComponent: ComponentDefinition = {
  props: metricPropsSchema,
  slots: [],
  description:
    "Compact stat / KPI card: a large hero `value`, a `label`, an optional signed `delta` chip (arrow glyph + success/danger tint from the sign or `direction`, `intent` to invert when down-is-good), and an optional inline `sparkline` (same props as the Sparkline component — its exact rendering is reused, not reimplemented). Surface/border/radius/elevation are token-driven so a bare Metric is theme-correct; pass `plain: true` to render just the stat inside another Card. All text is Satori div leaves (no SVG text).",
  example: {
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
    negativeColor: { $theme: "color.danger.bg" },
    backgroundColor: { $theme: "color.surface" },
    borderColor: { $theme: "color.border" },
    labelColor: { $theme: "color.mutedForeground" },
    elevation: { $theme: "elevation.sm" },
  },
};
