import { progressRingPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const progressRingComponent: ComponentDefinition = {
  props: progressRingPropsSchema,
  slots: [],
  description:
    "Circular progress indicator / gauge. A full track ring plus a partial arc filled to `value / max` (clamped 0–100%). Renders correctly at 0% (track only), 50%, and 100% (a complete ring). Track/fill colors are token-driven; an optional centered `label` (or `showValue`) and `sublabel` read the value.",
  example: {
    value: 72,
    max: 100,
    size: 160,
    label: "72%",
    sublabel: "Uptime",
    trackColor: { $theme: "color.surfaceMuted" },
    fillColor: { $theme: "color.accent.bg" },
    labelColor: { $theme: "color.foreground" },
    sublabelColor: { $theme: "color.mutedForeground" },
  },
};
