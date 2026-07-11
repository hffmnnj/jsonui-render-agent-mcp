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
const componentDefaults: Record<string, Record<string, ThemeRef | number>> = {
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
