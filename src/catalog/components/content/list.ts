import { listPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const listComponent: ComponentDefinition = {
  props: listPropsSchema,
  slots: [],
  description:
    "Vertical list of items. Each item is a plain string or a { text, secondary } row. `marker` selects the bullet style (none/disc/dash/check/number); `gap` sets the space between rows.",
  example: {
    marker: "check",
    gap: 8,
    items: [
      "Automated backups enabled",
      { text: "Two-factor auth", secondary: "Recommended" },
    ],
  },
};
