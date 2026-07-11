import { rowPropsSchema } from "../schema";
import type { ComponentDefinition } from "@json-render/shadcn-svelte";

export const rowComponent: ComponentDefinition = {
  props: rowPropsSchema,
  slots: ["default"],
  description: "Horizontal flex layout. Use for placing elements side by side.",
  example: { gap: 10, alignItems: "center" },
};
