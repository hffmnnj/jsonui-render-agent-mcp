import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolveTheme } from "./resolve-theme";
import {
  renderToPng,
  DEFAULT_RENDER_WIDTH,
  DEFAULT_RENDER_HEIGHT,
  DEFAULT_RENDER_SCALE,
  resolveRenderOptions,
} from "./index";
import { validateSpec } from "../catalog/validate";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function renderFixture() {
  const validated = validateSpec({
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 320, height: 180, padding: 20 },
        children: ["stack"],
      },
      stack: {
        type: "Stack",
        props: { gap: 8 },
        children: ["heading", "text"],
      },
      heading: {
        type: "Heading",
        props: { text: "Offline rendering", level: "h2" },
        children: [],
      },
      text: {
        type: "Text",
        props: { text: "Satori and resvg run without a browser.", fontSize: 16 },
        children: [],
      },
    },
  });

  if (!validated.ok) throw new Error(validated.error.message);
  return resolveTheme(validated.tree, "light");
}

describe("renderToPng", () => {
  it("renders a validated and resolved spec as a crisp default-scale PNG", async () => {
    const png = await renderToPng(renderFixture());

    expect(png.subarray(0, 8)).toEqual(pngSignature);
    expect(png.byteLength).toBeGreaterThan(1_000);
    expect(pngDimensions(png)).toEqual({ width: 640, height: 360 });
  });

  it("uses the requested device scale for physical PNG dimensions", async () => {
    const png = await renderToPng(renderFixture(), { scale: 3 });

    expect(png.subarray(0, 8)).toEqual(pngSignature);
    expect(png.byteLength).toBeGreaterThan(1_000);
    expect(pngDimensions(png)).toEqual({ width: 960, height: 540 });
  });

  it("applies the documented default dimensions and scale", () => {
    expect(resolveRenderOptions({})).toEqual({
      width: DEFAULT_RENDER_WIDTH,
      height: DEFAULT_RENDER_HEIGHT,
      scale: DEFAULT_RENDER_SCALE,
    });
    expect(DEFAULT_RENDER_WIDTH).toBe(1200);
    expect(DEFAULT_RENDER_HEIGHT).toBe(630);
    expect(DEFAULT_RENDER_SCALE).toBe(2);
  });

  it("renders the dashboard exemplar within latency and size budgets", async () => {
    const raw = await readFile(new URL("../../examples/dashboard.json", import.meta.url), "utf8");
    const dashboard = JSON.parse(raw);
    const validated = validateSpec(dashboard);
    if (!validated.ok) throw new Error(validated.error.message);
    const resolved = resolveTheme(validated.tree, "dark");

    const start = performance.now();
    const png = await renderToPng(resolved);
    const elapsed = performance.now() - start;

    // Dashboard Frame is 1200x1020; at default scale 2 the PNG is 2400x2040.
    expect(png.subarray(0, 8)).toEqual(pngSignature);
    expect(pngDimensions(png)).toEqual({ width: 2400, height: 2040 });
    expect(png.byteLength).toBeGreaterThan(100_000);
    expect(png.byteLength).toBeLessThan(2_000_000);
    expect(elapsed).toBeLessThan(5000);

    console.log(
      `dashboard exemplar: ${Math.round(elapsed)}ms, ${png.byteLength.toLocaleString()} bytes (${(png.byteLength / 1024).toFixed(1)}KB)`
    );
  });
});
