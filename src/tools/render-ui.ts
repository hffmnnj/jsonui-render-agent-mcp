import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateSpec, type ValidationError } from "../catalog/validate.js";
import { resolveTheme } from "../render/resolve-theme.js";
import type { ThemeName } from "../tokens/palettes.js";
import { renderToPng } from "../render/index.js";
import { buildImageContent, writeTempPng } from "../render/output.js";

const renderInputSchema = z.object({
  spec: z.unknown().describe("JSON UI spec describing the layout and content to render."),
  theme: z
    .enum(["light", "dark"])
    .optional()
    .default("light")
    .describe('Visual theme for the render. Either "light" or "dark"; defaults to "light".'),
  width: z
    .number()
    .positive()
    .finite()
    .optional()
    .describe("Override the render width in logical pixels. Defaults to the Frame root width or 1200."),
  height: z
    .number()
    .positive()
    .finite()
    .optional()
    .describe("Override the render height in logical pixels. Defaults to the Frame root height or 630."),
  scale: z
    .number()
    .min(1)
    .finite()
    .optional()
    .describe("PNG density multiplier for crisp output. Defaults to 2."),
});

const THEME_NAMES: readonly ThemeName[] = ["light", "dark"];

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value);
}

function validationErrorToContent(error: ValidationError["error"]) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Validation error at ${error.path}: ${error.message}`,
      },
    ],
    isError: true as const,
  };
}

function renderErrorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: `Render error: ${message}` }],
    isError: true as const,
  };
}

function invalidArgsContent(error: z.ZodError<unknown>) {
  const firstIssue = error.issues[0];
  return {
    content: [
      {
        type: "text" as const,
        text: `Invalid tool arguments at .${firstIssue?.path.join(".") ?? ""}: ${firstIssue?.message ?? "Unknown error"}`,
      },
    ],
    isError: true as const,
  };
}

/**
 * Register the `render_ui` MCP tool.
 *
 * Any validation or render failure is caught and returned as a structured text
 * response; the server process stays alive and never throws an uncaught error.
 */
export function registerRenderUi(server: McpServer): void {
  server.registerTool(
    "render_ui",
    {
      description:
        "Render a JSON UI spec to a PNG image. " +
        "Accepts a structured `spec` and an optional `theme` (\"light\" or \"dark\"). " +
        "Returns a base64 PNG image content block plus a text block with the on-disk temp path. " +
        "Discover the full component catalog and prop schemas by calling `list_components`. " +
        "Representative components include Frame, Box, Stack, Row, Text, Heading, " +
        "Card, Table, Badge, Alert, BarChart, LineChart, PieChart, Sparkline, Metric, and Progress.",
      inputSchema: {
        spec: z.unknown(),
        theme: z.enum(["light", "dark"]).optional().default("light"),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        scale: z.number().min(1).optional(),
      },
    },
    async (args: unknown) => {
      const parsed = renderInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidArgsContent(parsed.error);
      }

      const { spec, theme: themeValue, width, height, scale } = parsed.data;
      const theme = isThemeName(themeValue) ? themeValue : "light";

      const validation = validateSpec(spec);
      if (!validation.ok) {
        return validationErrorToContent(validation.error);
      }

      try {
        const resolved = resolveTheme(validation.tree, theme);
        const pngBuffer = await renderToPng(resolved, { width, height, scale });
        const { path } = await writeTempPng(pngBuffer);
        return buildImageContent(pngBuffer, path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return renderErrorContent(message);
      }
    },
  );
}
