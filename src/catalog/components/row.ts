import { rowPropsSchema } from "../schema";
import type { ComponentDefinition } from "../types";

export const rowComponent: ComponentDefinition = {
  props: rowPropsSchema,
  slots: ["default"],
  description: "Horizontal flex layout. Use for placing elements side by side.",
  example: { gap: 10, alignItems: "center" },
};
