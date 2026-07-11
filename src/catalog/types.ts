import type { z } from "zod";

/**
 * A component definition in a json-render catalog.
 *
 * Defines the props schema, slots, events, and metadata for a single
 * component that the AI can generate.
 */
export type ComponentDefinition = {
  props: z.ZodType;
  slots?: string[];
  events?: string[];
  description: string;
  example?: Record<string, unknown>;
};
