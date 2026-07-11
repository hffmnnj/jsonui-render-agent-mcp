/** Public browserless PNG rendering API. */
import type { ResolvedSpec } from "./resolve-theme";
import { rasterizeSvg, type RasterizeOptions } from "./rasterize";
import { renderToSvg, type RenderOptions } from "./satori";

export interface RenderToPngOptions extends RenderOptions, RasterizeOptions {}

/**
 * Render a theme-resolved JSON UI spec to PNG bytes without a browser or any
 * runtime network dependency. The dimensions select the logical Satori canvas;
 * `scale` selects the physical PNG density and defaults to 2 for chat clients.
 */
export async function renderToPng(
  resolvedSpec: ResolvedSpec,
  options: RenderToPngOptions = {}
): Promise<Buffer> {
  const svg = await renderToSvg(resolvedSpec, options);
  return rasterizeSvg(svg, { scale: options.scale });
}

export { rasterizeSvg } from "./rasterize";
export { renderToSvg } from "./satori";
export type { ResolvedSpec } from "./resolve-theme";
