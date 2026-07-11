import { Resvg } from "@resvg/resvg-js";

/** Physical-pixel scaling for a logical Satori SVG canvas. */
export interface RasterizeOptions {
  /** PNG density multiplier. Defaults to 2 for crisp chat-gateway previews. */
  scale?: number;
}

const DEFAULT_SCALE = 2;

function resolveScale(scale: number | undefined): number {
  const resolved = scale ?? DEFAULT_SCALE;
  if (!Number.isFinite(resolved) || resolved < 1) {
    throw new RangeError("Render scale must be a finite number greater than or equal to 1.");
  }
  return resolved;
}

/**
 * Rasterize an SVG string fully in-process. System-font discovery is disabled:
 * Satori has already embedded the bundled local fonts into the SVG.
 */
export function rasterizeSvg(svg: string, options: RasterizeOptions = {}): Buffer {
  const scale = resolveScale(options.scale);
  const image = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: { loadSystemFonts: false },
    shapeRendering: 2,
    textRendering: 2,
  }).render();

  return image.asPng();
}

export { DEFAULT_SCALE };
