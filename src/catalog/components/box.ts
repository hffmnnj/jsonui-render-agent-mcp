import { boxPropsSchema } from "../schema";
import type { ComponentDefinition } from "../types";

export const boxComponent: ComponentDefinition = {
  props: boxPropsSchema,
  slots: ["default"],
  description:
    "Generic container with padding, margin, background, border, and flex alignment. Supports absolute positioning.",
  example: {
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    alignItems: "center",
  },
};
