import { cardPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const cardComponent: ComponentDefinition = {
  props: cardPropsSchema,
  slots: ["default"],
  description:
    "Surface container with optional `header`/`footer` regions and a required body. `header`/`footer` are arrays of child-element keys; the body is the standard children slot. Background/border/radius/elevation are token-driven; a bare Card auto-themes via defaults.",
  example: {
    header: ["cardTitle"],
    footer: ["cardMeta"],
    elevation: { $theme: "elevation.md" },
    backgroundColor: { $theme: "color.surface" },
    borderColor: { $theme: "color.border" },
    borderRadius: { $theme: "radius.lg" },
  },
};
