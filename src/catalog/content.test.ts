import { describe, expect, it } from "bun:test";
import { validateSpec } from "./validate";
import { resolveTheme } from "../render/resolve-theme";
import { renderToPng } from "../render/index";
import type { ThemeName } from "../tokens/palettes";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const themes: ThemeName[] = ["light", "dark"];

interface SpecInput {
  root: string;
  elements: Record<string, unknown>;
}

/** Wrap a single content element in a Frame so it forms a renderable spec. */
function frameWith(child: string, element: Record<string, unknown>): SpecInput {
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width: 480, height: 260, padding: 24 },
        children: [child],
      },
      [child]: element,
    },
  };
}

/** Validate → resolve → render, asserting a valid non-trivial PNG each theme. */
async function expectRenders(spec: SpecInput, theme: ThemeName): Promise<Buffer> {
  const validated = validateSpec(spec);
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(validated.error.message);

  const resolved = resolveTheme(validated.tree, theme);
  // The resolution pass must leave zero $theme refs for Satori.
  expect(JSON.stringify(resolved)).not.toContain("$theme");

  const png = await renderToPng(resolved, { scale: 2 });
  expect(png.subarray(0, 8)).toEqual(pngSignature);
  expect(png.byteLength).toBeGreaterThan(1_000);
  return png;
}

describe("Badge content primitive", () => {
  const statusSlots = ["danger", "success", "warning", "info"] as const;

  for (const status of statusSlots) {
    for (const theme of themes) {
      it(`renders the ${status} variant in ${theme} with wired status slots`, async () => {
        await expectRenders(
          frameWith("badge", {
            type: "Badge",
            props: {
              text: status.toUpperCase(),
              variant: status,
              backgroundColor: { $theme: `color.${status}.bg` },
              color: { $theme: `color.${status}.fg` },
            },
            children: [],
          }),
          theme
        );
      });
    }
  }

  it("rejects a Badge missing its required text with a structured error", () => {
    const result = validateSpec(
      frameWith("badge", {
        type: "Badge",
        props: { variant: "success" },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badge.props.text");
      expect(result.error.message).toContain("string");
    }
  });

  it("rejects an unknown Badge variant with a structured error", () => {
    const result = validateSpec(
      frameWith("badge", {
        type: "Badge",
        props: { text: "x", variant: "purple" },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badge.props.variant");
    }
  });
});

describe("Avatar content primitive", () => {
  for (const theme of themes) {
    it(`renders an initials avatar in ${theme}`, async () => {
      await expectRenders(
        frameWith("avatar", {
          type: "Avatar",
          props: {
            mode: "initials",
            initials: "JH",
            size: 56,
            backgroundColor: { $theme: "color.accent.bg" },
            color: { $theme: "color.accent.fg" },
          },
          children: [],
        }),
        theme
      );
    });
  }

  it("renders an image avatar from a base64 data URI", async () => {
    // 1x1 transparent PNG data URI — proves image mode wires without network.
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await expectRenders(
      frameWith("avatar", {
        type: "Avatar",
        props: { mode: "image", src: dataUri, size: 48 },
        children: [],
      }),
      "light"
    );
  });

  it("falls back to initials when an image avatar has no data URI", async () => {
    // A remote URL cannot be fetched offline; render must still succeed.
    await expectRenders(
      frameWith("avatar", {
        type: "Avatar",
        props: {
          mode: "image",
          src: "https://example.com/a.png",
          initials: "AB",
          size: 48,
        },
        children: [],
      }),
      "dark"
    );
  });
});

describe("Alert content primitive", () => {
  const statusSlots = ["danger", "success", "warning", "info"] as const;

  for (const status of statusSlots) {
    for (const theme of themes) {
      it(`renders the ${status} alert in ${theme} with wired status slots`, async () => {
        await expectRenders(
          frameWith("alert", {
            type: "Alert",
            props: {
              title: `${status} title`,
              text: `A ${status} message body describing what happened.`,
              variant: status === "danger" ? "danger" : status,
              backgroundColor: { $theme: `color.${status}.subtle` },
              borderColor: { $theme: `color.${status}.border` },
              titleColor: { $theme: `color.${status}.bg` },
              accentColor: { $theme: `color.${status}.bg` },
              color: { $theme: "color.mutedForeground" },
            },
            children: [],
          }),
          theme
        );
      });
    }
  }

  it("renders a title-less alert body", async () => {
    await expectRenders(
      frameWith("alert", {
        type: "Alert",
        props: {
          text: "Just a body, no title.",
          backgroundColor: { $theme: "color.info.subtle" },
          borderColor: { $theme: "color.info.border" },
        },
        children: [],
      }),
      "light"
    );
  });

  it("rejects an Alert missing its required text", () => {
    const result = validateSpec(
      frameWith("alert", {
        type: "Alert",
        props: { title: "No body" },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.alert.props.text");
    }
  });
});

describe("List content primitive", () => {
  const markers = ["disc", "dash", "check", "number", "none"] as const;

  for (const marker of markers) {
    for (const theme of themes) {
      it(`renders a ${marker}-marked list in ${theme}`, async () => {
        await expectRenders(
          frameWith("list", {
            type: "List",
            props: {
              marker,
              gap: 8,
              items: [
                "Automated backups enabled",
                { text: "Two-factor auth", secondary: "Recommended" },
                "Audit log retention",
              ],
              color: { $theme: "color.foreground" },
              secondaryColor: { $theme: "color.mutedForeground" },
              markerColor: { $theme: "color.accent.bg" },
            },
            children: [],
          }),
          theme
        );
      });
    }
  }

  it("rejects a List with an empty items array", () => {
    const result = validateSpec(
      frameWith("list", {
        type: "List",
        props: { items: [] },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.list.props.items");
    }
  });
});
