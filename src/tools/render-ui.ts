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
    .describe("Override the render height in logical pixels. Cannot be combined with autoSize."),
  autoSize: z
    .boolean()
    .optional()
    .describe("Compute height from the resolved Satori/Yoga layout. Overrides a Frame height; cannot be combined with height."),
  scale: z
    .number()
    .min(1)
    .finite()
    .optional()
    .describe("PNG density multiplier for crisp output. Defaults to 2."),
}).refine((value) => !(value.autoSize === true && value.height !== undefined), {
  path: ["autoSize"],
  message: "autoSize cannot be combined with an explicit height.",
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
        text: JSON.stringify(error),
      },
    ],
    isError: true as const,
  };
}

function renderErrorContent() {
  // Do not expose renderer internals. Validation handles determinable failures
  // before rendering; this preserves the same machine-readable error contract
  // for unexpected render and output failures.
  const structuredError = {
    code: "RENDER_ERROR",
    path: ".",
    message: "Rendering failed.",
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredError) }],
    isError: true as const,
  };
}

function invalidArgsContent(error: z.ZodError<unknown>) {
  const firstIssue = error.issues[0];
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          code: "VALIDATION_ERROR",
          path: `.${firstIssue?.path.join(".") ?? ""}`,
          message: firstIssue?.message ?? "Invalid tool arguments.",
        }),
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
         "Omit Frame.height or pass `autoSize: true` to fit the canvas height to content. " +
        "Returns a base64 PNG image content block plus a text block with the on-disk temp path. " +
        "Discover the full component catalog and prop schemas by calling `list_components`. " +
        "Representative components include Frame, Box, Stack, Row, Text, Heading, " +
        "Card, Table, Badge, Alert, BarChart, LineChart, PieChart, Sparkline, Metric, and Progress.",
      inputSchema: {
        spec: z.unknown(),
        theme: z.enum(["light", "dark"]).optional().default("light"),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        autoSize: z.boolean().optional(),
        scale: z.number().min(1).optional(),
      },
    },
    async (args: unknown) => {
      const parsed = renderInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidArgsContent(parsed.error);
      }

      const { spec, theme: themeValue, width, height, autoSize, scale } = parsed.data;
      const theme = isThemeName(themeValue) ? themeValue : "light";

      const validation = validateSpec(spec);
      if (!validation.ok) {
        return validationErrorToContent(validation.error);
      }

      try {
        const resolved = resolveTheme(validation.tree, theme);
        const pngBuffer = await renderToPng(resolved, { width, height, autoSize, scale });
        const { path } = await writeTempPng(pngBuffer);
        return buildImageContent(pngBuffer, path);
      } catch {
        return renderErrorContent();
      }
    },
  );
}
