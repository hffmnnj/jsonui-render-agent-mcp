import { describe, expect, it } from "bun:test";
import {
  darkPalette,
  elevation,
  getTokens,
  lightPalette,
  spacing,
} from "../src/tokens/index";

describe("token bundle", () => {
  it("exposes theme-scoped color palettes via getTokens", () => {
    expect(getTokens("light").color).toBe(lightPalette);
    expect(getTokens("dark").color).toBe(darkPalette);
  });

  it("shares theme-invariant spacing across themes", () => {
    expect(getTokens("light").spacing).toBe(getTokens("dark").spacing);
    expect(spacing[4]).toBe(16);
  });

  it("scopes elevation per theme (dark shadows differ from light)", () => {
    expect(elevation.light.md).not.toBe(elevation.dark.md);
    expect(getTokens("dark").elevation).toBe(elevation.dark);
  });

  it("provides full status color slots in both palettes", () => {
    for (const palette of [lightPalette, darkPalette]) {
      for (const role of ["danger", "success", "warning", "info"] as const) {
        expect(palette[role].bg).toMatch(/^#|rgba/);
        expect(palette[role].fg).toMatch(/^#|rgba/);
        expect(palette[role].subtle).toMatch(/^#|rgba/);
        expect(palette[role].border).toMatch(/^#|rgba/);
      }
      expect(palette.chart.length).toBeGreaterThanOrEqual(4);
    }
  });
});
