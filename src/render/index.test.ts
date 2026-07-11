import { describe, expect, it } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { renderToPng } from "./index";
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
});
