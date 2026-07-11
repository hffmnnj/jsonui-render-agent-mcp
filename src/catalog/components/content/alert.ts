import { alertPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const alertComponent: ComponentDefinition = {
  props: alertPropsSchema,
  slots: [],
  description:
    "Bordered, tinted callout with an optional title and required body text. Set `variant` (info/success/warning/danger/neutral) and supply matching `$theme` refs, e.g. backgroundColor { $theme: \"color.warning.subtle\" }, borderColor { $theme: \"color.warning.border\" }.",
  example: {
    title: "Heads up",
    text: "Your storage is almost full.",
    variant: "warning",
    backgroundColor: { $theme: "color.warning.subtle" },
    borderColor: { $theme: "color.warning.border" },
    titleColor: { $theme: "color.warning.bg" },
  },
};
