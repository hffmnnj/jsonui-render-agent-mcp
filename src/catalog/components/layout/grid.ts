import { gridPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const gridComponent: ComponentDefinition = {
  props: gridPropsSchema,
  slots: ["default"],
  description:
    "Equal-column grid layout (flex-wrap based, since Satori has no CSS grid). Children flow into `columns` equal-width cells per row, wrapping to new rows, separated by `gap`.",
  example: { columns: 3, gap: 16 },
};
