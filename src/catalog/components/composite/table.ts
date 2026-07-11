import { tablePropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const tableComponent: ComponentDefinition = {
  props: tablePropsSchema,
  slots: [],
  description:
    "Header row plus data rows. `header` is an array of column cells styled distinctly (semibold, muted surface); `rows` is an array of cell arrays or { cells } objects. `striped` zebra-stripes body rows. Cells are strings or { text, align, color }. Colors take `$theme` refs.",
  example: {
    header: ["Service", "Status", "Uptime"],
    rows: [
      ["API", "Operational", "99.98%"],
      ["Database", "Operational", "99.95%"],
      ["Cache", "Degraded", "97.10%"],
    ],
    striped: true,
    headerBackgroundColor: { $theme: "color.surfaceMuted" },
    headerColor: { $theme: "color.foreground" },
    color: { $theme: "color.mutedForeground" },
    borderColor: { $theme: "color.border" },
    stripeColor: { $theme: "color.surface" },
  },
};
