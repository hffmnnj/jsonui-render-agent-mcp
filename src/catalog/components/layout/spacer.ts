import { spacerPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const spacerComponent: ComponentDefinition = {
  props: spacerPropsSchema,
  slots: [],
  description:
    "Empty sizing element. Use a fixed `size` (px) to hold a gap in a Row/Stack, or `grow: true` (flex: 1) to absorb remaining space and push siblings apart.",
  example: { size: 24 },
};
