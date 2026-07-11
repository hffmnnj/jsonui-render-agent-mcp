import { badgePropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const badgeComponent: ComponentDefinition = {
  props: badgePropsSchema,
  slots: [],
  description:
    "Small inline pill label for statuses and tags. Set `variant` (default/accent/danger/success/warning/info) and supply matching `$theme` color refs, e.g. backgroundColor { $theme: \"color.success.bg\" }, color { $theme: \"color.success.fg\" }.",
  example: {
    text: "Active",
    variant: "success",
    backgroundColor: { $theme: "color.success.bg" },
    color: { $theme: "color.success.fg" },
  },
};
