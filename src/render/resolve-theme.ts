/**
 * Theme resolution pass — the pre-Satori step that turns a validated, still
 * theme-abstract spec tree into a fully literal one for a given theme.
 *
 * Satori consumes inline styles only: no CSS variables, no media queries. So
 * every `$theme` reference must be replaced with a concrete literal (hex color,
 * px number, box-shadow string, …) BEFORE the tree reaches the renderer. After
 * this pass runs, the tree contains zero `$theme` references — that invariant
 * is asserted by the test suite and is the whole point of this module.
 *
 * A `$theme` reference is a structured object `{ $theme: "<dotted.path>" }`
 * (matching the catalog schema's `colorValue` union), e.g.
 * `{ backgroundColor: { $theme: "color.surface" } }`. The path is resolved
 * against `getTokens(theme)`.
 */

import type { Spec, UIElement } from "@json-render/core";
import { getTokens, type Tokens } from "../tokens/index";
import type { ThemeName } from "../tokens/palettes";

/**
 * The resolved tree is structurally a `Spec`, but semantically guaranteed to be
 * free of `$theme` references. The branded alias documents that guarantee at
 * call sites (e.g. the renderer accepts only a `ResolvedSpec`).
 */
export type ResolvedSpec = Spec & { readonly __themeResolved?: true };

/** Thrown when a `$theme` path cannot be resolved against the token bundle. */
export class ThemeResolutionError extends Error {
  constructor(
    /** The unresolved dotted token path, e.g. "color.accent.nope". */
    public readonly tokenPath: string,
    /** The theme the path failed to resolve under. */
    public readonly theme: ThemeName,
    /** The element key the bad reference was found on, for spec debugging. */
    public readonly elementKey: string
  ) {
    super(
      `Unresolved $theme reference "${tokenPath}" on element "${elementKey}" ` +
        `for theme "${theme}". No such token path exists in the token bundle.`
    );
    this.name = "ThemeResolutionError";
  }
}

/** A `$theme` reference object as it appears embedded in a prop value. */
interface ThemeRef {
  readonly $theme: string;
}

/**
 * A value in the `componentDefaults` map. Almost always a `$theme` ref (so the
 * default honors the active theme and flows through the same resolution logic
 * that already handles refs resolving to arrays, e.g. `color.chart`). A raw
 * `number` is allowed for theme-invariant numeric defaults (radius/spacing).
 */
type DefaultValue = ThemeRef | number;

function isThemeRef(value: unknown): value is ThemeRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "$theme" in value &&
    typeof (value as ThemeRef).$theme === "string"
  );
}

/**
 * Resolve a dotted path (e.g. "color.accent.bg") into the token bundle.
 * Returns `undefined` if any segment is missing so the caller can raise a
 * precise, path-aware error rather than a generic crash.
 */
function lookupToken(tokens: Tokens, path: string): unknown {
  let current: unknown = tokens;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) return undefined;
  }
  return current;
}

/**
 * Recursively resolve a single prop value. Handles the three shapes a value can
 * take: a `$theme` ref (resolved to a literal), an array (mapped), or a nested
 * object (walked). Scalars pass through untouched. Every branch either returns
 * a literal or throws — so nothing `$theme`-shaped can survive.
 */
function resolveValue(
  value: unknown,
  tokens: Tokens,
  theme: ThemeName,
  elementKey: string
): unknown {
  if (isThemeRef(value)) {
    const resolved = lookupToken(tokens, value.$theme);
    if (resolved === undefined) {
      throw new ThemeResolutionError(value.$theme, theme, elementKey);
    }
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, tokens, theme, elementKey));
  }

  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = resolveValue(inner, tokens, theme, elementKey);
    }
    return out;
  }

  return value;
}

/**
 * Per-component default styling applied ONLY when a prop is absent. This lets
 * specs stay terse — a bare `Card` gets a sensible radius/background without the
 * author writing every token — while never overriding an explicit value.
 *
 * Defaults are expressed as `$theme` refs so they flow through the SAME
 * resolution logic (and thus honor the active theme) instead of hardcoding
 * literals. Keys are component `type` names; values are prop -> ref maps.
 */
const componentDefaults: Record<string, Record<string, DefaultValue>> = {
  Frame: {
    backgroundColor: { $theme: "color.background" },
  },
  Box: {
    borderRadius: { $theme: "radius.md" },
  },
  Text: {
    color: { $theme: "color.foreground" },
  },
  Heading: {
    color: { $theme: "color.foreground" },
  },
  // A bare Divider tracks the theme's border color without the author writing it.
  Divider: {
    color: { $theme: "color.border" },
  },
  // A bare Badge is the neutral secondary chip (muted surface + zinc text).
  Badge: {
    color: { $theme: "color.neutral.fg" },
    backgroundColor: { $theme: "color.neutral.bg" },
  },
  // A bare Avatar's initials disc uses the brand accent (fill + on-accent text).
  Avatar: {
    backgroundColor: { $theme: "color.accent.bg" },
    color: { $theme: "color.accent.fg" },
  },
  // A bare Alert reads as a neutral notice: muted surface, themed border,
  // primary title over muted body. `accentColor` inherits the border in satori
  // when omitted, so it needs no separate default here.
  Alert: {
    backgroundColor: { $theme: "color.surfaceMuted" },
    borderColor: { $theme: "color.border" },
    titleColor: { $theme: "color.foreground" },
    color: { $theme: "color.mutedForeground" },
  },
  // A bare List uses primary text with a muted secondary column. `markerColor`
  // inherits the primary `color` in satori when omitted.
  List: {
    color: { $theme: "color.foreground" },
    secondaryColor: { $theme: "color.mutedForeground" },
  },
  // A bare Card is a raised surface with a themed border and container radius.
  // `dividerColor` inherits `borderColor` in satori when omitted.
  Card: {
    backgroundColor: { $theme: "color.surface" },
    borderColor: { $theme: "color.border" },
    borderRadius: { $theme: "radius.lg" },
  },
  // A bare Table: white/background surface, muted header strip, primary header
  // text over muted body, themed borders, and a faint zebra stripe.
  Table: {
    backgroundColor: { $theme: "color.background" },
    headerBackgroundColor: { $theme: "color.surfaceMuted" },
    headerColor: { $theme: "color.foreground" },
    color: { $theme: "color.mutedForeground" },
    borderColor: { $theme: "color.border" },
    stripeColor: { $theme: "color.surface" },
  },
  // A bare Progress bar gets a muted track, accent fill, and muted caption.
  Progress: {
    trackColor: { $theme: "color.surfaceMuted" },
    fillColor: { $theme: "color.accent.bg" },
    labelColor: { $theme: "color.mutedForeground" },
  },
  // A bare Sparkline trends in the brand accent (line, area tint, and end dot
  // all inherit `color` in satori when their own props are omitted).
  Sparkline: {
    color: { $theme: "color.accent.bg" },
  },
  // A bare PieChart cycles the categorical ramp; donut center text uses the
  // primary/muted foreground pair.
  PieChart: {
    colors: { $theme: "color.chart" },
    centerLabelColor: { $theme: "color.foreground" },
    centerValueColor: { $theme: "color.mutedForeground" },
  },
  // A bare ProgressRing: muted track, accent arc, primary center readout over a
  // muted sublabel.
  ProgressRing: {
    trackColor: { $theme: "color.surfaceMuted" },
    fillColor: { $theme: "color.accent.bg" },
    labelColor: { $theme: "color.foreground" },
    sublabelColor: { $theme: "color.mutedForeground" },
  },
  // A bare BarChart: ramp fills, themed gridlines, muted axis labels.
  BarChart: {
    colors: { $theme: "color.chart" },
    gridColor: { $theme: "color.border" },
    labelColor: { $theme: "color.mutedForeground" },
  },
  // A bare LineChart: ramp strokes, themed gridlines, muted axis labels.
  LineChart: {
    colors: { $theme: "color.chart" },
    gridColor: { $theme: "color.border" },
    labelColor: { $theme: "color.mutedForeground" },
  },
  // A bare Metric card: raised surface + themed border, a primary value over a
  // muted label and subtle caption, with success/danger delta accents.
  Metric: {
    backgroundColor: { $theme: "color.surface" },
    borderColor: { $theme: "color.border" },
    valueColor: { $theme: "color.foreground" },
    labelColor: { $theme: "color.mutedForeground" },
    captionColor: { $theme: "color.subtleForeground" },
    positiveColor: { $theme: "color.success.bg" },
    negativeColor: { $theme: "color.danger.bg" },
    // Resolved accent handed to an embedded sparkline that omits its own color
    // (the nested `sparkline` object is below componentDefaults' top-level reach).
    sparklineColor: { $theme: "color.accent.bg" },
  },
};

function applyDefaults(
  element: UIElement,
  resolvedProps: Record<string, unknown>,
  tokens: Tokens,
  theme: ThemeName,
  key: string
): Record<string, unknown> {
  const defaults = componentDefaults[element.type];
  if (!defaults) return resolvedProps;

  const withDefaults = { ...resolvedProps };
  for (const [prop, fallback] of Object.entries(defaults)) {
    const existing = withDefaults[prop];
    if (existing === undefined || existing === null) {
      withDefaults[prop] = resolveValue(fallback, tokens, theme, key);
    }
  }
  return withDefaults;
}

/**
 * Resolve an entire validated spec tree for one theme.
 *
 * Walks every element's `props`, replacing `$theme` references with literal
 * token values and filling per-component style defaults where a prop was
 * omitted. The tree is flat (a keyed `elements` map), so we iterate the map
 * directly rather than recursing through `children`.
 *
 * @throws {ThemeResolutionError} if any `$theme` path is unresolvable — chosen
 *   over a silent fallback so malformed specs fail loudly here, before the
 *   renderer, naming the offending path and element.
 */
export function resolveTheme(tree: Spec, theme: ThemeName): ResolvedSpec {
  const tokens = getTokens(theme);
  const resolvedElements: Record<string, UIElement> = {};

  for (const [key, element] of Object.entries(tree.elements)) {
    const resolvedProps = resolveValue(
      element.props,
      tokens,
      theme,
      key
    ) as Record<string, unknown>;

    resolvedElements[key] = {
      ...element,
      props: applyDefaults(element, resolvedProps, tokens, theme, key),
    };
  }

  return {
    ...tree,
    elements: resolvedElements,
  };
}
