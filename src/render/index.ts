/** Public browserless PNG rendering API. */
import type { ResolvedSpec } from "./resolve-theme";
import { rasterizeSvg } from "./rasterize";
import { renderToSvg, type RenderOptions } from "./satori";
import {
  DEFAULT_RENDER_HEIGHT,
  DEFAULT_RENDER_SCALE,
  DEFAULT_RENDER_WIDTH,
  resolveRenderOptions,
  type RenderOutputOptions,
} from "./output";

export interface RenderToPngOptions extends RenderOutputOptions {}

/**
 * Render a theme-resolved JSON UI spec to PNG bytes without a browser or any
 * runtime network dependency. Dimensions default to 1200x630 logical pixels
 * (a chat-gateway-friendly 1.9:1 aspect ratio) and scale defaults to 2 for
 * crisp mobile previews. Override via `width`, `height`, or `scale` options;
 * explicit Frame root dimensions take precedence when no option is supplied.
 */
export async function renderToPng(
  resolvedSpec: ResolvedSpec,
  options: RenderToPngOptions = {}
): Promise<Buffer> {
  const resolved = resolveRenderOptions(options);

  // Only forward dimensions that the caller explicitly provided. If they were
  // omitted, `renderToSvg` falls back to the Frame root dimensions (if present)
  // and then to the documented defaults.
  const renderOptions: RenderOptions = {};
  if (options.width !== undefined) renderOptions.width = resolved.width;
  if (options.height !== undefined) renderOptions.height = resolved.height;

  const svg = await renderToSvg(resolvedSpec, renderOptions);
  return rasterizeSvg(svg, { scale: resolved.scale });
}

export { rasterizeSvg } from "./rasterize";
export { renderToSvg } from "./satori";
export type { ResolvedSpec } from "./resolve-theme";
export {
  DEFAULT_RENDER_HEIGHT,
  DEFAULT_RENDER_SCALE,
  DEFAULT_RENDER_WIDTH,
  resolveRenderOptions,
} from "./output";
