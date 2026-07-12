/**
 * Color palettes — the light + dark source of truth for every color a
 * component may reference via a `$theme.color.*` token path.
 *
 * DESIGN LANGUAGE (shadcn/ui-inspired, 100% hand-authored here — no external
 * shadcn / shadcn-svelte package, per SPEC Amendment 1):
 *   - Neutrals are a cool zinc/slate ramp. Light mode reads on a near-white
 *     canvas with a slightly-off-white surface for depth without shadows;
 *     dark mode reads on a deep zinc canvas with a raised surface.
 *   - Every color is a literal value (hex or rgba). Satori supports inline
 *     styles only — no CSS variables — so nothing here may be a var() or a
 *     reference. These literals are what `resolveTheme()` inlines.
 *   - Semantic slots (not raw color names) so components style by INTENT:
 *     `background`, `surface`, `foreground`, `border`, `accent`, `danger`, …
 *     A component asks for `color.status.danger.bg`, never for "#ef4444".
 *
 * Status colors (danger/success/warning/info) are authored NOW even though the
 * components that use them (Alert, Badge, charts) land in later waves — MH3/MH4
 * need these semantic slots to exist so the palette is stable across waves.
 */

/**
 * A role's color set: `bg` fill, `fg` readable text on that fill, a `subtle`
 * tinted surface (e.g. an Alert body), and a `border` tuned for that surface.
 */
export interface ColorPair {
  readonly bg: string;
  readonly fg: string;
  readonly subtle: string;
  readonly border: string;
}

/**
 * The full set of semantic color slots a component may reference by INTENT.
 * `background` is the page canvas; `surface`/`surfaceMuted` are raised and
 * recessed containers; the `*Foreground` ramp goes primary -> muted -> subtle;
 * `accent` is the brand color, `neutral` the secondary chip, and
 * danger/success/warning/info are the status roles. `chart` is an ordered
 * categorical series ramp that consumers cycle through and wrap.
 */
export interface Palette {
  readonly background: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly foreground: string;
  readonly mutedForeground: string;
  readonly subtleForeground: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly accent: ColorPair;
  readonly neutral: ColorPair;
  readonly danger: ColorPair;
  readonly success: ColorPair;
  readonly warning: ColorPair;
  readonly info: ColorPair;
  readonly chart: readonly string[];
}

/**
 * LIGHT palette — near-white canvas, cool-zinc neutrals, saturated-but-calm
 * accent and status hues chosen for AA contrast against their backgrounds.
 */
export const lightPalette: Palette = {
  background: "#ffffff",
  surface: "#fafafa",
  surfaceMuted: "#f4f4f5",
  foreground: "#18181b",
  mutedForeground: "#52525b",
  subtleForeground: "#a1a1aa",
  border: "#e4e4e7",
  borderStrong: "#d4d4d8",
  accent: {
    bg: "#4f46e5",
    fg: "#ffffff",
    subtle: "#eef2ff",
    border: "#c7d2fe",
  },
  neutral: {
    bg: "#f4f4f5",
    fg: "#3f3f46",
    subtle: "#f4f4f5",
    border: "#e4e4e7",
  },
  danger: {
    bg: "#dc2626",
    fg: "#ffffff",
    subtle: "#fef2f2",
    border: "#fecaca",
  },
  success: {
    bg: "#16a34a",
    fg: "#ffffff",
    subtle: "#f0fdf4",
    border: "#bbf7d0",
  },
  warning: {
    bg: "#d97706",
    fg: "#ffffff",
    subtle: "#fffbeb",
    border: "#fde68a",
  },
  info: {
    bg: "#2563eb",
    fg: "#ffffff",
    subtle: "#eff6ff",
    border: "#bfdbfe",
  },
  chart: ["#4f46e5", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#9333ea"],
};

/**
 * DARK palette — deep zinc canvas with a raised surface, brighter neutral text,
 * and accent/status hues lightened so they read on dark backgrounds while their
 * `subtle` surfaces stay low-luminance (tinted, not washed-out).
 */
export const darkPalette: Palette = {
  background: "#09090b",
  surface: "#18181b",
  surfaceMuted: "#212124",
  foreground: "#fafafa",
  mutedForeground: "#a1a1aa",
  subtleForeground: "#71717a",
  border: "#27272a",
  borderStrong: "#3f3f46",
  accent: {
    bg: "#6366f1",
    fg: "#ffffff",
    subtle: "#1e1b4b",
    border: "#3730a3",
  },
  neutral: {
    bg: "#27272a",
    fg: "#e4e4e7",
    subtle: "#27272a",
    border: "#3f3f46",
  },
  danger: {
    bg: "#ef4444",
    fg: "#0b0809",
    subtle: "#2a1416",
    border: "#7f1d1d",
  },
  success: {
    bg: "#22c55e",
    fg: "#04140a",
    subtle: "#0f2417",
    border: "#166534",
  },
  warning: {
    bg: "#f59e0b",
    fg: "#1a1204",
    subtle: "#2a1f0a",
    border: "#854d0e",
  },
  info: {
    bg: "#3b82f6",
    fg: "#050c18",
    subtle: "#111f34",
    border: "#1e40af",
  },
  chart: ["#818cf8", "#4ade80", "#fbbf24", "#f87171", "#22d3ee", "#c084fc"],
};

/** Theme identifier accepted throughout the render pipeline. */
export type ThemeName = "light" | "dark";

/** Lookup table from theme name to its palette. */
export const palettes: Record<ThemeName, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};
