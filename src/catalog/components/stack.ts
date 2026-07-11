import { stackPropsSchema } from "../schema";
import type { ComponentDefinition } from "../types";

export const stackComponent: ComponentDefinition = {
  props: stackPropsSchema,
  slots: ["default"],
  description: "Vertical flex layout. Use for stacking elements top to bottom.",
  example: { gap: 8, padding: 10 },
};
