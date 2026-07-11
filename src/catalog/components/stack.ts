import { stackPropsSchema } from "../schema";
import type { ComponentDefinition } from "@json-render/shadcn-svelte";

export const stackComponent: ComponentDefinition = {
  props: stackPropsSchema,
  slots: ["default"],
  description: "Vertical flex layout. Use for stacking elements top to bottom.",
  example: { gap: 8, padding: 10 },
};
