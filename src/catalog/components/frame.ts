import { framePropsSchema } from "../schema";
import type { ComponentDefinition } from "@json-render/shadcn-svelte";

export const frameComponent: ComponentDefinition = {
  props: framePropsSchema,
  slots: ["default"],
  description:
    "Root image container. Defines the output image dimensions and background. Must be the root element.",
  example: { width: 1200, height: 630, backgroundColor: "#ffffff" },
};
