import { describe, expect, it } from "bun:test";
import type { Spec } from "@json-render/core";
import {
  resolveTheme,
  ThemeResolutionError,
} from "../src/render/resolve-theme";
import { getTokens } from "../src/tokens/index";
import { darkPalette, lightPalette } from "../src/tokens/palettes";

/** Build a minimal valid-shaped spec tree with the given elements. */
function makeSpec(elements: Spec["elements"], root = "root"): Spec {
  return { root, elements } as Spec;
}

/** Recursively scan any value for a surviving `$theme` reference. */
function hasThemeRef(value: unknown): boolean {
  return /"\$theme"\s*:/.test(JSON.stringify(value));
}

describe("resolveTheme — literal token substitution", () => {
  it("replaces $theme refs with the theme's literal color values", () => {
    const spec = makeSpec({
      root: {
        type: "Frame",
        props: {
          width: 400,
          height: 200,
          backgroundColor: { $theme: "color.surface" },
        },
        children: ["title"],
      },
      title: {
        type: "Heading",
        props: { text: "Hello", color: { $theme: "color.accent.bg" } },
      },
    });

    const light = resolveTheme(spec, "light");
    expect(light.elements.root!.props.backgroundColor).toBe(
      lightPalette.surface
    );
    expect(light.elements.title!.props.color).toBe(lightPalette.accent.bg);
  });

  it("resolves non-color token paths (radius, spacing) to literals", () => {
    const spec = makeSpec({
      root: {
        type: "Box",
        props: {
          borderRadius: { $theme: "radius.lg" },
          padding: { $theme: "spacing.4" },
        },
      },
    });

    const resolved = resolveTheme(spec, "light");
    const tokens = getTokens("light");
    expect(resolved.elements.root!.props.borderRadius).toBe(tokens.radius.lg);
    expect(resolved.elements.root!.props.padding).toBe(tokens.spacing[4]);
  });

  it("resolves refs nested inside arrays and objects", () => {
    const spec = makeSpec({
      root: {
        type: "Box",
        props: {
          series: [{ $theme: "color.chart" }, { $theme: "color.danger.bg" }],
          style: { nested: { fill: { $theme: "color.foreground" } } },
        },
      },
    });

    const resolved = resolveTheme(spec, "dark");
    const props = resolved.elements.root!.props as Record<string, unknown>;
    expect((props.series as unknown[])[1]).toBe(darkPalette.danger.bg);
    expect(
      (props.style as { nested: { fill: string } }).nested.fill
    ).toBe(darkPalette.foreground);
  });
});

describe("resolveTheme — light vs dark divergence", () => {
  it("yields different literal color values for light vs dark", () => {
    const spec = makeSpec({
      root: {
        type: "Frame",
        props: {
          width: 400,
          height: 200,
          backgroundColor: { $theme: "color.background" },
        },
        children: ["body"],
      },
      body: {
        type: "Text",
        props: {
          text: "x",
          color: { $theme: "color.foreground" },
        },
      },
    });

    const light = resolveTheme(spec, "light");
    const dark = resolveTheme(spec, "dark");

    // Background diverges.
    expect(light.elements.root!.props.backgroundColor).not.toBe(
      dark.elements.root!.props.backgroundColor
    );
    // Foreground diverges.
    expect(light.elements.body!.props.color).not.toBe(
      dark.elements.body!.props.color
    );
    // And each matches its own palette.
    expect(light.elements.root!.props.backgroundColor).toBe(
      lightPalette.background
    );
    expect(dark.elements.root!.props.backgroundColor).toBe(
      darkPalette.background
    );
  });
});

describe("resolveTheme — zero $theme survivors", () => {
  it("leaves no $theme reference anywhere in the resolved tree", () => {
    const spec = makeSpec({
      root: {
        type: "Frame",
        props: {
          width: 600,
          height: 400,
          backgroundColor: { $theme: "color.background" },
        },
        children: ["card"],
      },
      card: {
        type: "Box",
        props: {
          backgroundColor: { $theme: "color.surface" },
          borderColor: { $theme: "color.border" },
          borderRadius: { $theme: "radius.lg" },
          padding: { $theme: "spacing.6" },
        },
        children: ["heading", "text"],
      },
      heading: {
        type: "Heading",
        props: { text: "Report", color: { $theme: "color.foreground" } },
      },
      text: {
        type: "Text",
        props: { text: "Body", color: { $theme: "color.mutedForeground" } },
      },
    });

    for (const theme of ["light", "dark"] as const) {
      const resolved = resolveTheme(spec, theme);
      expect(hasThemeRef(resolved)).toBe(false);
    }
  });
});

describe("resolveTheme — component style defaults", () => {
  it("fills a default background for Frame when none is given", () => {
    const spec = makeSpec({
      root: { type: "Frame", props: { width: 100, height: 100 } },
    });

    const light = resolveTheme(spec, "light");
    expect(light.elements.root!.props.backgroundColor).toBe(
      lightPalette.background
    );
    const dark = resolveTheme(spec, "dark");
    expect(dark.elements.root!.props.backgroundColor).toBe(
      darkPalette.background
    );
  });

  it("fills a default borderRadius for Box when omitted", () => {
    const spec = makeSpec({
      root: { type: "Box", props: {} },
    });
    const resolved = resolveTheme(spec, "light");
    expect(resolved.elements.root!.props.borderRadius).toBe(
      getTokens("light").radius.md
    );
  });

  it("does not override an explicitly provided prop with a default", () => {
    const spec = makeSpec({
      root: {
        type: "Frame",
        props: { width: 100, height: 100, backgroundColor: "#123456" },
      },
    });
    const resolved = resolveTheme(spec, "light");
    expect(resolved.elements.root!.props.backgroundColor).toBe("#123456");
  });
});

describe("resolveTheme — malformed reference handling", () => {
  it("throws a ThemeResolutionError naming the bad path and element", () => {
    const spec = makeSpec({
      broken: {
        type: "Text",
        props: { text: "x", color: { $theme: "color.accent.nope" } },
      },
    });

    expect(() => resolveTheme(spec, "light")).toThrow(ThemeResolutionError);

    try {
      resolveTheme(spec, "light");
      throw new Error("expected resolveTheme to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeResolutionError);
      const e = err as ThemeResolutionError;
      expect(e.tokenPath).toBe("color.accent.nope");
      expect(e.elementKey).toBe("broken");
      expect(e.theme).toBe("light");
      expect(e.message).toContain("color.accent.nope");
    }
  });

  it("throws when a path partially resolves then dead-ends", () => {
    const spec = makeSpec({
      broken: {
        type: "Box",
        props: { borderRadius: { $theme: "radius.enormous" } },
      },
    });
    expect(() => resolveTheme(spec, "dark")).toThrow(ThemeResolutionError);
  });
});

describe("resolveTheme — immutability", () => {
  it("does not mutate the input spec", () => {
    const spec = makeSpec({
      root: {
        type: "Frame",
        props: {
          width: 100,
          height: 100,
          backgroundColor: { $theme: "color.background" },
        },
      },
    });
    const snapshot = JSON.stringify(spec);
    resolveTheme(spec, "light");
    expect(JSON.stringify(spec)).toBe(snapshot);
  });
});
