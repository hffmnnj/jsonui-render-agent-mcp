/**
 * Design tokens — the single, hand-authored source of truth for every non-color
 * design value in the render pipeline (spacing, type, radii, elevation), plus a
 * re-export of the color palettes. Owned entirely by this project; shadcn/ui
 * informs the *aesthetic* (spacing rhythm, radius feel, restrained elevation)
 * but every value here is authored locally — no external shadcn dependency
 * (SPEC Amendment 1, MH6).
 *
 * WHY LITERALS: Satori (the layout engine behind the renderer) supports inline
 * styles only. Tokens are therefore plain literals — px numbers and CSS-string
 * values — so `resolveTheme()` can inline them directly with no runtime var()
 * indirection.
 *
 * TOKEN PATHS: components reference tokens with dotted paths under a `$theme`
 * ref, e.g. `{ $theme: "spacing.4" }` or `{ $theme: "color.accent.bg" }`.
 * `resolveTheme()` resolves those paths against `getTokens(theme)`.
 */

import { palettes, type Palette, type ThemeName } from "./palettes";

export { lightPalette, darkPalette, palettes } from "./palettes";
export type { Palette, ColorPair, ThemeName } from "./palettes";

/**
 * SPACING — 4px base unit on a hand-tuned scale. Keys are step multipliers so a
 * spec reading `spacing.4` gets 16px; the scale densifies at the low end (where
 * UI padding/gap decisions live) and coarsens higher up. Values are raw px
 * numbers because Satori wants numeric lengths for flexbox props.
 */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;
export type SpacingToken = keyof typeof spacing;

/**
 * TYPE SCALE — a 1.25 (major third) modular scale anchored on a 16px body.
 * Heading sizes are the scale rounded to whole px for crisp rasterization:
 * body 16 -> h4 20 -> h3 25 -> h2 31 -> h1 39. `xs`/`sm` sit below body for
 * captions and metadata; `display` sits above h1 for hero metrics.
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  h4: 20,
  h3: 25,
  h2: 31,
  h1: 39,
  display: 48,
} as const;
export type FontSizeToken = keyof typeof fontSize;

/** Font weights — numeric so Satori maps them straight onto the loaded font. */
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
export type FontWeightToken = keyof typeof fontWeight;

/**
 * LINE HEIGHTS — unitless ratios. Headings are tight for a dense, deliberate
 * feel; body/relaxed give running text room to breathe.
 */
export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.65,
} as const;
export type LineHeightToken = keyof typeof lineHeight;

/**
 * LETTER SPACING — CSS-string values (Satori accepts em/px strings). Large
 * headings get slight negative tracking; small caps-y labels get positive.
 */
export const letterSpacing = {
  tight: "-0.02em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
} as const;
export type LetterSpacingToken = keyof typeof letterSpacing;

/**
 * RADII — px corner radii. `md` (6) is the default container radius (shadcn's
 * resting radius); `full` is the pill/circle sentinel.
 */
export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  full: 9999,
} as const;
export type RadiusToken = keyof typeof radius;

/**
 * ELEVATION — literal CSS `box-shadow` strings (Satori supports `boxShadow`
 * inline). Shadows are theme-scoped: light mode uses soft neutral-black
 * shadows; dark mode uses deeper, higher-opacity shadows since a soft light
 * shadow is invisible on a near-black canvas.
 */
export interface ElevationScale {
  readonly none: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
}

const lightElevation: ElevationScale = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
  md: "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)",
  lg: "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)",
  xl: "0 12px 20px -4px rgba(0,0,0,0.12), 0 4px 8px -4px rgba(0,0,0,0.08)",
};

const darkElevation: ElevationScale = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0,0,0,0.40)",
  md: "0 1px 3px 0 rgba(0,0,0,0.55), 0 1px 2px -1px rgba(0,0,0,0.50)",
  lg: "0 4px 6px -1px rgba(0,0,0,0.55), 0 2px 4px -2px rgba(0,0,0,0.45)",
  xl: "0 12px 24px -4px rgba(0,0,0,0.65), 0 4px 10px -4px rgba(0,0,0,0.50)",
};

export const elevation: Record<ThemeName, ElevationScale> = {
  light: lightElevation,
  dark: darkElevation,
};

/**
 * The resolved token bundle for a single theme. Color tokens are theme-specific
 * (the palette); non-color tokens (spacing/type/radii) are theme-invariant and
 * shared, while elevation is theme-scoped. This is the object `$theme.*` paths
 * resolve against.
 */
export interface Tokens {
  readonly color: Palette;
  readonly spacing: typeof spacing;
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
  readonly lineHeight: typeof lineHeight;
  readonly letterSpacing: typeof letterSpacing;
  readonly radius: typeof radius;
  readonly elevation: ElevationScale;
}

/**
 * Build the resolved token bundle for a theme. `resolveTheme()` walks specs
 * against the object returned here; a `$theme` path like `"color.surface"` or
 * `"radius.md"` is looked up as a dotted path into this bundle.
 */
export function getTokens(theme: ThemeName): Tokens {
  return {
    color: palettes[theme],
    spacing,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    radius,
    elevation: elevation[theme],
  };
}
