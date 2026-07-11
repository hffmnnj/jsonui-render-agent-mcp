import { dividerPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const dividerComponent: ComponentDefinition = {
  props: dividerPropsSchema,
  slots: [],
  description:
    "Thin separator line. `orientation` picks the axis (horizontal hairline or vertical rule). Pass `color: { $theme: \"color.border\" }` to track the theme border color.",
  example: { orientation: "horizontal", color: { $theme: "color.border" } },
};
