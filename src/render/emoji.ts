import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * `twemoji-emojis` installs the complete Twemoji SVG collection locally.
 * Source: https://github.com/jakejarvis/twemoji-emojis
 * License: CC-BY 4.0, https://creativecommons.org/licenses/by/4.0/
 */
const require = createRequire(import.meta.url);
const TWEMOJI_DIRECTORY = new URL(
  "./vendor/svg/",
  pathToFileURL(require.resolve("twemoji-emojis/package.json"))
);
const dataUriCache = new Map<string, Promise<string>>();

/**
 * Satori passes an emoji grapheme cluster (not necessarily a single Unicode
 * scalar) to `loadAdditionalAsset`. Twemoji names its SVGs after the cluster's
 * code points, omitting presentation variation selectors.
 */
export function twemojiAssetName(grapheme: string): string {
  return Array.from(grapheme)
    .map((character) => character.codePointAt(0)?.toString(16))
    .filter((codePoint): codePoint is string => codePoint !== undefined && codePoint !== "fe0f")
    .join("-");
}

/** Return an installed local Twemoji SVG as a data URI, never a network URL. */
export function loadTwemojiAsset(grapheme: string): Promise<string> {
  const assetName = twemojiAssetName(grapheme);
  const cached = dataUriCache.get(assetName);
  if (cached) return cached;

  const dataUri = readFile(new URL(`${assetName}.svg`, TWEMOJI_DIRECTORY)).then(
    (svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`
  );
  dataUriCache.set(assetName, dataUri);
  return dataUri;
}

/** Satori's documented hook: replace detected emoji graphemes with local SVGs. */
export async function loadAdditionalEmojiAsset(
  code: string,
  grapheme: string
): Promise<string> {
  if (code !== "emoji") return code;

  try {
    return await loadTwemojiAsset(grapheme);
  } catch (error) {
    // Satori keeps its normal text/font processing for non-emoji codes. An
    // unrecognised emoji must not make a render fail just because its asset is
    // absent from a future package release.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return code;
    throw error;
  }
}
