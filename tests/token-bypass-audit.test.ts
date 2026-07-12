import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { Spec } from "@json-render/core";
import { resolveTheme } from "../src/render/resolve-theme";
import { renderToPng } from "../src/render/index";
import { getTokens } from "../src/tokens/index";
import type { Palette, ThemeName } from "../src/tokens/palettes";

/**
 * MH6 — single-source design tokens. Two guards:
 *   1. `satori.ts` source contains zero raw hex-color literals. The renderer is
 *      a pure "already-resolved literal, just draw it" layer; every color must
 *      arrive from a token via `resolveTheme`, never a fallback baked into the
 *      renderer.
 *   2. A representative spec that omits every optional color prop, resolved for
 *      both themes, contains only color literals that exist in that theme's
 *      palette — proving the omitted values were filled from tokens, not from a
 *      renderer-owned hardcoded fallback.
 */

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;

/** Flatten every string in a palette (ColorPairs + the chart ramp) into a set. */
function paletteColorSet(palette: Palette): Set<string> {
  const out = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (HEX_LITERAL.test(value)) out.add(value.toLowerCase());
      HEX_LITERAL.lastIndex = 0;
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(palette);
  return out;
}

/** Collect every hex-color literal appearing anywhere in a resolved tree. */
function collectHexLiterals(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const matches = value.match(HEX_LITERAL);
    if (matches) for (const m of matches) out.add(m.toLowerCase());
  } else if (Array.isArray(value)) {
    for (const item of value) collectHexLiterals(item, out);
  } else if (value && typeof value === "object") {
    for (const inner of Object.values(value)) collectHexLiterals(inner, out);
  }
}

/**
 * A spec exercising every catalog component whose renderer previously carried a
 * hardcoded color fallback — each deliberately OMITS its optional color props so
 * the resolved literals can only come from `resolveTheme`'s token defaults.
 */
function auditSpec(): Spec {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 700, height: 1400, padding: 24 },
        children: [
          "divider",
          "badge",
          "avatar",
          "alert",
          "list",
          "card",
          "table",
          "progress",
          "sparkline",
          "pie",
          "ring",
          "bar",
          "line",
          "metric",
        ],
      },
      divider: { type: "Divider", props: {} },
      badge: { type: "Badge", props: { text: "New" } },
      avatar: { type: "Avatar", props: { initials: "JH" } },
      alert: { type: "Alert", props: { title: "Heads up", text: "A notice." } },
      list: {
        type: "List",
        props: { items: [{ text: "One", secondary: "a" }, { text: "Two" }] },
      },
      card: {
        type: "Card",
        props: { header: ["cardHeading"] },
        children: ["cardBody"],
      },
      cardHeading: { type: "Heading", props: { text: "Card", level: "h3" } },
      cardBody: { type: "Text", props: { text: "Body" } },
      table: {
        type: "Table",
        props: {
          header: ["A", "B"],
          rows: [["1", "2"], ["3", "4"], ["5", "6"]],
        },
      },
      progress: { type: "Progress", props: { value: 60, label: "Load", showValue: true } },
      sparkline: { type: "Sparkline", props: { data: [3, 5, 4, 8, 6, 9] } },
      pie: {
        type: "PieChart",
        props: {
          donut: true,
          centerLabel: "72%",
          centerValue: "done",
          data: [{ label: "x", value: 3 }, { label: "y", value: 1 }],
        },
      },
      ring: {
        type: "ProgressRing",
        props: { value: 72, showValue: true, sublabel: "used" },
      },
      bar: {
        type: "BarChart",
        props: { data: [{ label: "a", value: 3 }, { label: "b", value: 7 }] },
      },
      line: {
        type: "LineChart",
        props: {
          axisLabels: ["a", "b", "c"],
          data: [{ label: "a", value: 3 }, { label: "b", value: 7 }, { label: "c", value: 5 }],
        },
      },
      metric: {
        type: "Metric",
        props: {
          label: "Revenue",
          value: "$48.2k",
          caption: "vs last month",
          delta: { value: "12%", direction: "up" },
          sparkline: { data: [1, 2, 3, 4] },
        },
      },
    },
  } as Spec;
}

describe("MH6 — satori.ts carries no hardcoded color literals", () => {
  it("has zero raw hex-color string literals in its source", () => {
    const source = readFileSync(new URL("../src/render/satori.ts", import.meta.url), "utf8");
    const matches = source.match(HEX_LITERAL) ?? [];
    expect(matches).toEqual([]);
  });
});

describe("MH6 — token-bypass audit across themes", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`resolves every omitted color from ${theme} tokens (no rogue literals)`, () => {
      const resolved = resolveTheme(auditSpec(), theme as ThemeName);

      // No $theme reference may survive resolution.
      expect(/"\$theme"\s*:/.test(JSON.stringify(resolved))).toBe(false);

      const allowed = paletteColorSet(getTokens(theme as ThemeName).color);
      const found = new Set<string>();
      collectHexLiterals(resolved, found);

      const rogue = [...found].filter((c) => !allowed.has(c));
      expect(rogue).toEqual([]);
      // Sanity: the audit spec actually produced token-sourced colors.
      expect(found.size).toBeGreaterThan(0);
    });
  }

  it("renders the audited spec to a valid PNG in both themes", async () => {
    for (const theme of ["light", "dark"] as const) {
      const png = await renderToPng(resolveTheme(auditSpec(), theme as ThemeName));
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
      expect(png.byteLength).toBeGreaterThan(1_000);
    }
  });
});
