import { avatarPropsSchema } from "../../schema";
import type { ComponentDefinition } from "../../types";

export const avatarComponent: ComponentDefinition = {
  props: avatarPropsSchema,
  slots: [],
  description:
    "Circular identity marker. `mode: \"initials\"` (default) renders initials on a tinted disc. `mode: \"image\"` requires a base64 data: URI in `src` — remote URLs are not fetched at render time and fall back to initials.",
  example: {
    mode: "initials",
    initials: "JH",
    size: 48,
    backgroundColor: { $theme: "color.accent.bg" },
    color: { $theme: "color.accent.fg" },
  },
};
