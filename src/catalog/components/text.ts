import { textPropsSchema } from "../schema";
import type { ComponentDefinition } from "@json-render/shadcn-svelte";

export const textComponent: ComponentDefinition = {
  props: textPropsSchema,
  slots: [],
  description: "Body text with configurable size, color, weight, and alignment.",
  example: { text: "Some content here.", fontSize: 16, color: "#333333" },
};
