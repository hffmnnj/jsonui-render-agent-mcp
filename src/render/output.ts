import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Environment override for the directory used to stash generated PNGs. */
export const TEMP_DIR_ENV = "JSONUI_RENDER_TEMP_DIR";

/** Default temp directory for generated PNG files. */
export const DEFAULT_TEMP_DIR = join(tmpdir(), "jsonui-render-mcp");

/**
 * Resolve the directory used for generated PNGs. Uses the `JSONUI_RENDER_TEMP_DIR`
 * environment variable when set, otherwise falls back to `os.tmpdir()/jsonui-render-mcp`.
 */
export function getTempDirectory(): string {
  return process.env[TEMP_DIR_ENV] ?? DEFAULT_TEMP_DIR;
}

/**
 * Write PNG bytes to a deterministic temp path and return the absolute path.
 *
 * Files are named with a short prefix + nanosecond timestamp so repeated renders
 * in the same process do not collide, and the directory is created on demand.
 */
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

/**
 * Build an MCP tool response containing the PNG as a base64 image content block
 * plus an adjacent text block with the temp file path.
 */
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
