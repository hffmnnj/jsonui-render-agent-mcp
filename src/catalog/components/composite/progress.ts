import { progressPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const progressComponent: ComponentDefinition = {
  props: progressPropsSchema,
  slots: [],
  description:
    "Linear progress bar. Fill width is `value / max` (default max 100) clamped to 0–100%. Track and fill colors, `height`, and `radius` are token-driven. Optional `label` (with `showValue` for the percentage) sits above the bar.",
  example: {
    value: 72,
    max: 100,
    label: "Storage used",
    showValue: true,
    trackColor: { $theme: "color.surfaceMuted" },
    fillColor: { $theme: "color.accent.bg" },
    labelColor: { $theme: "color.mutedForeground" },
  },
};
