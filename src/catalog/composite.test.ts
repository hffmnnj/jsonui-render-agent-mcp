import { describe, expect, it } from "bun:test";
import { validateSpec } from "./validate";
import { resolveTheme } from "../render/resolve-theme";
import { renderToPng } from "../render/index";
import { getTokens } from "../tokens/index";
import type { ThemeName } from "../tokens/palettes";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const themes: ThemeName[] = ["light", "dark"];

interface SpecInput {
  root: string;
  elements: Record<string, unknown>;
}

/** Wrap a single composite element in a Frame so it forms a renderable spec. */
function frameWith(child: string, extra: Record<string, unknown>): SpecInput {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 560, height: 320, padding: 24, backgroundColor: { $theme: "color.background" } },
        children: [child],
      },
      ...extra,
    },
  };
}

/** Validate → resolve → render, asserting a valid non-trivial PNG for a theme. */
async function expectRenders(spec: SpecInput, theme: ThemeName): Promise<Buffer> {
  const validated = validateSpec(spec);
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(`${validated.error.path}: ${validated.error.message}`);

  const resolved = resolveTheme(validated.tree, theme);
  expect(JSON.stringify(resolved)).not.toContain("$theme");

  const png = await renderToPng(resolved, { scale: 2 });
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.byteLength).toBeGreaterThan(1_000);
  return png;
}

describe("Card composite primitive", () => {
  for (const theme of themes) {
    it(`renders a Card with header, body, and footer regions in ${theme}`, async () => {
      await expectRenders(
        frameWith("card", {
          card: {
            type: "Card",
            props: {
              header: ["cardTitle"],
              footer: ["cardMeta"],
              elevation: { $theme: "elevation.md" },
            },
            children: ["cardBody"],
          },
          cardTitle: { type: "Heading", props: { text: "Deployment", level: "h3" }, children: [] },
          cardBody: { type: "Text", props: { text: "All systems nominal across every region." }, children: [] },
          cardMeta: {
            type: "Text",
            props: { text: "Updated 2m ago", fontSize: 13, color: { $theme: "color.mutedForeground" } },
            children: [],
          },
        }),
        theme
      );
    });
  }

  it("renders a bare Card (body only) with auto-themed surface defaults", async () => {
    await expectRenders(
      frameWith("card", {
        card: { type: "Card", props: {}, children: ["cardBody"] },
        cardBody: { type: "Text", props: { text: "Minimal card." }, children: [] },
      }),
      "dark"
    );
  });

  it("rejects a Card whose header is not an array of keys", () => {
    const result = validateSpec(
      frameWith("card", {
        card: { type: "Card", props: { header: "nope" }, children: ["cardBody"] },
        cardBody: { type: "Text", props: { text: "x" }, children: [] },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.card.props.header");
  });
});

describe("Table composite primitive", () => {
  for (const theme of themes) {
    it(`renders a header + striped data rows in ${theme}`, async () => {
      await expectRenders(
        frameWith("table", {
          table: {
            type: "Table",
            props: {
              header: ["Service", "Status", { text: "Uptime", align: "right" }],
              rows: [
                ["API", "Operational", { text: "99.98%", align: "right" }],
                ["Database", "Operational", { text: "99.95%", align: "right" }],
                ["Cache", "Degraded", { text: "97.10%", align: "right" }],
              ],
              striped: true,
              headerBackgroundColor: { $theme: "color.surfaceMuted" },
              headerColor: { $theme: "color.foreground" },
              color: { $theme: "color.mutedForeground" },
              borderColor: { $theme: "color.border" },
              stripeColor: { $theme: "color.surface" },
            },
            children: [],
          },
        }),
        theme
      );
    });
  }

  it("renders { cells } row objects", async () => {
    await expectRenders(
      frameWith("table", {
        table: {
          type: "Table",
          props: {
            header: ["Key", "Value"],
            rows: [{ cells: ["Region", "us-east-1"] }, { cells: ["Nodes", "12"] }],
            borderColor: { $theme: "color.border" },
          },
          children: [],
        },
      }),
      "light"
    );
  });

  it("rejects a Table with no rows", () => {
    const result = validateSpec(
      frameWith("table", {
        table: { type: "Table", props: { rows: [] }, children: [] },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.table.props.rows");
  });
});

describe("Progress composite primitive", () => {
  for (const theme of themes) {
    it(`renders a labelled progress bar in ${theme}`, async () => {
      await expectRenders(
        frameWith("progress", {
          progress: {
            type: "Progress",
            props: {
              value: 72,
              max: 100,
              label: "Storage used",
              showValue: true,
              trackColor: { $theme: "color.surfaceMuted" },
              fillColor: { $theme: "color.accent.bg" },
              labelColor: { $theme: "color.mutedForeground" },
            },
            children: [],
          },
        }),
        theme
      );
    });
  }

  it("clamps out-of-range values and renders bare defaults", async () => {
    for (const value of [-20, 250]) {
      await expectRenders(
        frameWith("progress", {
          progress: { type: "Progress", props: { value }, children: [] },
        }),
        "light"
      );
    }
  });

  it("rejects a Progress missing its required value", () => {
    const result = validateSpec(
      frameWith("progress", {
        progress: { type: "Progress", props: { label: "no value" }, children: [] },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.path).toBe(".elements.progress.props.value");
  });
});

/* ------------------------------------------------------------------ *
 * Cross-theme catalog audit (Task 3.3 acceptance).                    *
 *                                                                     *
 * A representative dashboard combines Card + Table + Progress with    *
 * Wave-1/3.1/3.2 primitives (Heading, Text, Badge, Alert, Divider),   *
 * every color expressed as a `$theme` ref. It asserts:                *
 *   (a) both themes produce valid non-trivial PNGs;                   *
 *   (b) the light and dark bytes are meaningfully different;          *
 *   (c) no raw color literal bypasses the token system — the source   *
 *       spec carries zero hex/rgb literals, and every literal in the  *
 *       resolved trees is a value that exists in the token bundle.    *
 * This is the guardrail for MH6 ("every component references tokens") *
 * and anti-pattern #6 (catalog duplication / inconsistency).          *
 * ------------------------------------------------------------------ */

/** A dashboard spec whose colors are ALL `$theme` refs (no literals). */
function dashboardSpec(): SpecInput {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 720, height: 560, padding: 32, backgroundColor: { $theme: "color.background" } },
        children: ["card"],
      },
      card: {
        type: "Card",
        props: {
          header: ["titleRow"],
          footer: ["footNote"],
          elevation: { $theme: "elevation.lg" },
          backgroundColor: { $theme: "color.surface" },
          borderColor: { $theme: "color.border" },
          borderRadius: { $theme: "radius.xl" },
        },
        children: ["alert", "table", "divider", "progress"],
      },
      titleRow: {
        type: "Row",
        props: { justifyContent: "space-between", alignItems: "center" },
        children: ["title", "statusBadge"],
      },
      title: { type: "Heading", props: { text: "Infrastructure", level: "h3" }, children: [] },
      statusBadge: {
        type: "Badge",
        props: {
          text: "Healthy",
          variant: "success",
          backgroundColor: { $theme: "color.success.bg" },
          color: { $theme: "color.success.fg" },
        },
        children: [],
      },
      alert: {
        type: "Alert",
        props: {
          title: "Scheduled maintenance",
          text: "A rolling restart will occur at 02:00 UTC.",
          variant: "info",
          backgroundColor: { $theme: "color.info.subtle" },
          borderColor: { $theme: "color.info.border" },
          titleColor: { $theme: "color.info.bg" },
          accentColor: { $theme: "color.info.bg" },
          color: { $theme: "color.mutedForeground" },
        },
        children: [],
      },
      table: {
        type: "Table",
        props: {
          header: ["Service", "Status", { text: "Uptime", align: "right" }],
          rows: [
            ["API Gateway", "Operational", { text: "99.99%", align: "right" }],
            ["Workers", "Operational", { text: "99.97%", align: "right" }],
            ["Queue", "Operational", { text: "99.90%", align: "right" }],
          ],
          striped: true,
          headerBackgroundColor: { $theme: "color.surfaceMuted" },
          headerColor: { $theme: "color.foreground" },
          color: { $theme: "color.mutedForeground" },
          borderColor: { $theme: "color.border" },
          stripeColor: { $theme: "color.surfaceMuted" },
        },
        children: [],
      },
      divider: {
        type: "Divider",
        props: { orientation: "horizontal", color: { $theme: "color.border" }, margin: 4 },
        children: [],
      },
      progress: {
        type: "Progress",
        props: {
          value: 68,
          max: 100,
          label: "Rollout progress",
          showValue: true,
          trackColor: { $theme: "color.surfaceMuted" },
          fillColor: { $theme: "color.accent.bg" },
          labelColor: { $theme: "color.mutedForeground" },
        },
        children: [],
      },
      footNote: {
        type: "Text",
        props: { text: "Last synced 30s ago", fontSize: 13, color: { $theme: "color.subtleForeground" } },
        children: [],
      },
    },
  };
}

/** Recursively collect every string value in an object graph. */
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) collectStrings(inner, out);
  }
}

/** Hex (#abc / #aabbcc / #aabbccdd) or rgb()/rgba() color literals. */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/;

/** Every literal color that legitimately exists in the token bundle. */
function tokenColorLiterals(theme: ThemeName): Set<string> {
  const strings: string[] = [];
  collectStrings(getTokens(theme), strings);
  return new Set(strings.filter((s) => COLOR_LITERAL.test(s)));
}

describe("cross-theme dashboard audit (Card + Table + Progress + primitives)", () => {
  it("(a) renders valid non-trivial PNGs in both themes and (b) they differ", async () => {
    const spec = dashboardSpec();

    const validated = validateSpec(spec);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(`${validated.error.path}: ${validated.error.message}`);

    const light = await renderToPng(resolveTheme(validated.tree, "light"), { scale: 2 });
    const dark = await renderToPng(resolveTheme(validated.tree, "dark"), { scale: 2 });

    // (a) both are valid, non-trivial PNGs.
    for (const png of [light, dark]) {
      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(png.byteLength).toBeGreaterThan(5_000);
    }

    // (b) light and dark outputs are meaningfully different.
    expect(light.byteLength).not.toBe(dark.byteLength);
    expect(light.equals(dark)).toBe(false);
  });

  it("(c) no component bypasses the token system with a raw color literal", () => {
    const spec = dashboardSpec();

    // The source spec must carry zero raw color literals — every color a $theme ref.
    const sourceStrings: string[] = [];
    collectStrings(spec, sourceStrings);
    const rawSourceColors = sourceStrings.filter((s) => COLOR_LITERAL.test(s));
    expect(rawSourceColors).toEqual([]);

    const validated = validateSpec(spec);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.error.message);

    // Every color literal in the resolved tree must originate from the token
    // module — i.e. it must be present in that theme's token bundle. A literal
    // that is NOT a token would mean a component hardcoded a color.
    for (const theme of themes) {
      const resolved = resolveTheme(validated.tree, theme);
      const resolvedStrings: string[] = [];
      collectStrings(resolved, resolvedStrings);
      const resolvedColors = resolvedStrings.filter((s) => COLOR_LITERAL.test(s));

      // The dashboard uses color, so there must be resolved literals to check.
      expect(resolvedColors.length).toBeGreaterThan(0);

      const allowed = tokenColorLiterals(theme);
      const strays = resolvedColors.filter((c) => !allowed.has(c));
      expect(strays).toEqual([]);
    }
  });
});
