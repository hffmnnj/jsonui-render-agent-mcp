import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { catalog } from "../catalog/index.js";
import type { z } from "zod";

/**
 * A JSON-serializable description of one catalog component.
 */
export interface CatalogEntryDescription {
  name: string;
  description: string;
  props: object;
}

interface ComponentDefinition {
  props: z.ZodType;
  slots: string[];
  description: string;
  example?: object;
}

function catalogEntries(): CatalogEntryDescription[] {
  const components = catalog.data.components as Record<string, ComponentDefinition>;
  return Object.entries(components).map(([name, definition]) => {
    return {
      name,
      description: definition.description,
      props: definition.props.toJSONSchema(),
    };
  });
}

/**
 * Register the `list_components` MCP tool.
 *
 * Returns the full v1 component catalog: every registered component's name,
 * description, and prop schema (as a JSON Schema document). Call this before
 * building a `render_ui` spec to discover which components and props are
 * available.
 */
export function registerListComponents(server: McpServer): void {
  server.registerTool(
    "list_components",
    {
      description:
        "List every component in the render catalog with its name, description, and JSON Schema props. " +
        "Use this to discover what you can render before calling render_ui.",
    },
    () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ components: catalogEntries() }, null, 2),
          },
        ],
      };
    },
  );
}
