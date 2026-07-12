import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Chat-gateway defaults: 1200x630 logical pixels at 2x scale. */
export const DEFAULT_RENDER_WIDTH = 1200;
export const DEFAULT_RENDER_HEIGHT = 630;
export const DEFAULT_RENDER_SCALE = 2;

/** Caller-facing render options; all fields are optional overrides. */
export interface RenderOutputOptions {
  width?: number;
  height?: number;
  /** Compute height from the Frame's natural Satori/Yoga layout. */
  autoSize?: boolean;
  scale?: number;
}

function resolveDimension(
  value: number | undefined,
  defaultValue: number,
  name: string
): number {
  if (value === undefined) return defaultValue;
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Render ${name} must be a finite number greater than zero.`);
  }
  return value;
}

/** Resolve a complete set of render dimensions and scale from optional overrides. */
export function resolveRenderOptions(
  options: RenderOutputOptions = {}
): Required<Omit<RenderOutputOptions, "autoSize">> {
  return {
    width: resolveDimension(options.width, DEFAULT_RENDER_WIDTH, "width"),
    height: resolveDimension(options.height, DEFAULT_RENDER_HEIGHT, "height"),
    scale: resolveDimension(options.scale, DEFAULT_RENDER_SCALE, "scale"),
  };
}

/** Environment override for the directory used to stash generated PNGs. */
export const TEMP_DIR_ENV = "JSONUI_RENDER_TEMP_DIR";

/** Default temp directory for generated PNG files. */
export const DEFAULT_TEMP_DIR = join(tmpdir(), "jsonui-render-mcp");

/** Resolve the directory used for generated PNGs. */
export function getTempDirectory(): string {
  return process.env[TEMP_DIR_ENV] ?? DEFAULT_TEMP_DIR;
}

/** Write PNG bytes to a deterministic temp path and return the absolute path. */
export async function writeTempPng(buffer: Buffer): Promise<{ path: string }> {
  const dir = getTempDirectory();
  await mkdir(dir, { recursive: true });

  const timestamp = process.hrtime.bigint().toString();
  const fileName = `jsonui-render-${timestamp}.png`;
  const filePath = join(dir, fileName);

  await writeFile(filePath, buffer);
  return { path: filePath };
}

/** The MCP content-block shape returned by `render_ui`. */
export interface RenderContent {
  [key: string]: unknown;
  content: Array<
    | { type: "image"; data: string; mimeType: "image/png" }
    | { type: "text"; text: string }
  >;
}

/** Build an MCP tool response containing the PNG plus an adjacent text block. */
export function buildImageContent(buffer: Buffer, path: string): RenderContent {
  return {
    content: [
      {
        type: "image" as const,
        data: buffer.toString("base64"),
        mimeType: "image/png" as const,
      },
      {
        type: "text" as const,
        text: `PNG written to: ${path}`,
      },
    ],
  };
}
