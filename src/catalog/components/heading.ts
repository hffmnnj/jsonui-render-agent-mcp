import { headingPropsSchema } from "../schema";
import type { ComponentDefinition } from "../types";

export const headingComponent: ComponentDefinition = {
  props: headingPropsSchema,
  slots: [],
  description: "Heading text at various levels. h1 is largest, h4 is smallest.",
  example: { text: "Hello World", level: "h1", color: "#000000" },
};
