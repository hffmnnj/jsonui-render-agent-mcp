import { describe, expect, it } from "bun:test";
import { validateSpec } from "../../validate";
import { resolveTheme } from "../../../render/resolve-theme";
import { renderToPng } from "../../../render/index";
import type { ThemeName } from "../../../tokens/palettes";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function renderInBothThemes(spec: unknown): Promise<Record<ThemeName, Buffer>> {
  const validated = validateSpec(spec);
  if (!validated.ok) {
    throw new Error(`spec failed validation at ${validated.error.path}: ${validated.error.message}`);
  }

  const out: Partial<Record<ThemeName, Buffer>> = {};
  for (const theme of ["light", "dark"] as const) {
    const resolved = resolveTheme(validated.tree, theme);
    out[theme] = await renderToPng(resolved);
  }
  return out as Record<ThemeName, Buffer>;
}

function expectValidPng(png: Buffer): void {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.byteLength).toBeGreaterThan(1_000);
}

describe("layout primitives — validation + both-theme render", () => {
  it("renders a Grid of cards into equal wrapping columns", async () => {
    const spec = {
      root: "frame",
      elements: {
        frame: {
          type: "Frame",
          props: {
            width: 480,
            height: 300,
            padding: 24,
            backgroundColor: { $theme: "color.background" },
          },
          children: ["grid"],
        },
        grid: {
          type: "Grid",
          props: { columns: 3, gap: 16 },
          children: ["a", "b", "c", "d", "e"],
        },
        a: { type: "Box", props: { padding: 16, backgroundColor: { $theme: "color.surface" }, borderWidth: 1, borderColor: { $theme: "color.border" } }, children: ["at"] },
        b: { type: "Box", props: { padding: 16, backgroundColor: { $theme: "color.surface" }, borderWidth: 1, borderColor: { $theme: "color.border" } }, children: ["bt"] },
        c: { type: "Box", props: { padding: 16, backgroundColor: { $theme: "color.surface" }, borderWidth: 1, borderColor: { $theme: "color.border" } }, children: ["ct"] },
        d: { type: "Box", props: { padding: 16, backgroundColor: { $theme: "color.surface" }, borderWidth: 1, borderColor: { $theme: "color.border" } }, children: ["dt"] },
        e: { type: "Box", props: { padding: 16, backgroundColor: { $theme: "color.surface" }, borderWidth: 1, borderColor: { $theme: "color.border" } }, children: ["et"] },
        at: { type: "Text", props: { text: "One" }, children: [] },
        bt: { type: "Text", props: { text: "Two" }, children: [] },
        ct: { type: "Text", props: { text: "Three" }, children: [] },
        dt: { type: "Text", props: { text: "Four" }, children: [] },
        et: { type: "Text", props: { text: "Five" }, children: [] },
      },
    };

    const { light, dark } = await renderInBothThemes(spec);
    expectValidPng(light);
    expectValidPng(dark);
    // Light and dark differ (surface/border tokens differ), so bytes must differ.
    expect(light.equals(dark)).toBe(false);
  });

  it("uses a growing Spacer to push Row siblings apart and a fixed Spacer for a gap", async () => {
    const spec = {
      root: "frame",
      elements: {
        frame: {
          type: "Frame",
          props: { width: 420, height: 120, padding: 20, backgroundColor: { $theme: "color.background" } },
          children: ["row"],
        },
        row: {
          type: "Row",
          props: { alignItems: "center" },
          children: ["left", "grow", "mid", "fixed", "right"],
        },
        left: { type: "Text", props: { text: "Left", color: { $theme: "color.foreground" } }, children: [] },
        grow: { type: "Spacer", props: { grow: true }, children: [] },
        mid: { type: "Text", props: { text: "Mid", color: { $theme: "color.mutedForeground" } }, children: [] },
        fixed: { type: "Spacer", props: { size: 24 }, children: [] },
        right: { type: "Text", props: { text: "Right", color: { $theme: "color.foreground" } }, children: [] },
      },
    };

    const { light, dark } = await renderInBothThemes(spec);
    expectValidPng(light);
    expectValidPng(dark);
  });

  it("renders horizontal and vertical Dividers with a theme-driven color", async () => {
    const spec = {
      root: "frame",
      elements: {
        frame: {
          type: "Frame",
          props: { width: 400, height: 200, padding: 20, backgroundColor: { $theme: "color.background" } },
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          props: { gap: 12 },
          children: ["top", "hr", "row"],
        },
        top: { type: "Text", props: { text: "Above", color: { $theme: "color.foreground" } }, children: [] },
        hr: {
          type: "Divider",
          props: { orientation: "horizontal", color: { $theme: "color.border" }, thickness: 1 },
          children: [],
        },
        row: {
          type: "Row",
          props: { gap: 12, alignItems: "center" },
          children: ["l", "vr", "r"],
        },
        l: { type: "Text", props: { text: "L", color: { $theme: "color.foreground" } }, children: [] },
        vr: {
          type: "Divider",
          props: { orientation: "vertical", color: { $theme: "color.borderStrong" }, thickness: 2, length: 40 },
          children: [],
        },
        r: { type: "Text", props: { text: "R", color: { $theme: "color.foreground" } }, children: [] },
      },
    };

    const { light, dark } = await renderInBothThemes(spec);
    expectValidPng(light);
    expectValidPng(dark);
    expect(light.equals(dark)).toBe(false);
  });

  it("rejects a Grid with a non-positive column count via a structured error", () => {
    const result = validateSpec({
      root: "frame",
      elements: {
        frame: { type: "Frame", props: { width: 200, height: 200 }, children: ["grid"] },
        grid: { type: "Grid", props: { columns: 0 }, children: [] },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.grid.props.columns");
    }
  });

  it("rejects a Divider with a bad orientation via a structured error", () => {
    const result = validateSpec({
      root: "frame",
      elements: {
        frame: { type: "Frame", props: { width: 200, height: 200 }, children: ["d"] },
        d: { type: "Divider", props: { orientation: "diagonal" }, children: [] },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.d.props.orientation");
    }
  });
});
