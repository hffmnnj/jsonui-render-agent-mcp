import { describe, expect, it } from "bun:test";
import { validateSpec } from "./validate";
import {
  getIconData,
  iconCount,
  iconNames,
  isIconName,
  normalizeIconName,
} from "./icons";
import { resolveTheme } from "../render/resolve-theme";
import { renderToPng } from "../render/index";
import type { ThemeName } from "../tokens/palettes";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const themes: ThemeName[] = ["light", "dark"];

interface SpecInput {
  root: string;
  elements: Record<string, unknown>;
}

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

async function expectRenders(spec: SpecInput, theme: ThemeName): Promise<Buffer> {
  const validated = validateSpec(spec);
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(validated.error.message);

  const resolved = resolveTheme(validated.tree, theme);
  expect(JSON.stringify(resolved)).not.toContain("$theme");

  const png = await renderToPng(resolved, { scale: 2 });
  expect(png.subarray(0, 8)).toEqual(pngSignature);
  expect(png.byteLength).toBeGreaterThan(1_000);
  return png;
}

/** A representative sample of icon names spanning categories. */
const SAMPLE_ICONS = [
  "search",
  "home-01",
  "notification-03",
  "arrow-right-01",
  "user-group",
  "settings-01",
  "mail-01",
  "calendar-03",
  "checkmark-circle-02",
  "alert-circle",
  "download-01",
  "wallet-01",
];

describe("icon lookup module", () => {
  it("exposes a large, thousands-strong free-tier icon set", () => {
    // Free tier is ~4,500+ named icons; our normalized set must be in the
    // thousands to be a faithful, useful catalog.
    expect(iconCount()).toBeGreaterThan(4_000);
    expect(iconNames().length).toBe(iconCount());
  });

  it("normalizes export identifiers to a deterministic kebab-case name", () => {
    expect(normalizeIconName("SearchIcon")).toBe("search");
    expect(normalizeIconName("Notification03Icon")).toBe("notification-03");
    expect(normalizeIconName("ArrowRight01Icon")).toBe("arrow-right-01");
    expect(normalizeIconName("UserGroupIcon")).toBe("user-group");
    expect(normalizeIconName("CheckmarkCircle02Icon")).toBe("checkmark-circle-02");
  });

  it("resolves every sampled name to real SVG node data", () => {
    for (const name of SAMPLE_ICONS) {
      expect(isIconName(name)).toBe(true);
      const data = getIconData(name);
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
      // Only Satori-safe shape tags — never <text>.
      for (const [tag] of data!) {
        expect(["path", "circle", "rect", "ellipse"]).toContain(tag);
      }
    }
  });

  it("reports unknown names as absent", () => {
    expect(isIconName("definitely-not-an-icon-xyz")).toBe(false);
    expect(getIconData("definitely-not-an-icon-xyz")).toBeUndefined();
  });

  it("produces a collision-free, deterministic name set across builds", () => {
    const first = iconNames();
    const unique = new Set(first);
    expect(unique.size).toBe(first.length);
  });
});

describe("Icon catalog component", () => {
  for (const name of SAMPLE_ICONS) {
    for (const theme of themes) {
      it(`renders "${name}" in ${theme}`, async () => {
        await expectRenders(
          frameWith("icon", {
            type: "Icon",
            props: { name, size: 32, color: { $theme: "color.foreground" } },
            children: [],
          }),
          theme
        );
      });
    }
  }

  it("renders a bare Icon (theme foreground default) in both themes", async () => {
    for (const theme of themes) {
      await expectRenders(
        frameWith("icon", { type: "Icon", props: { name: "star" }, children: [] }),
        theme
      );
    }
  });

  it("honors a custom strokeWidth and accent color", async () => {
    await expectRenders(
      frameWith("icon", {
        type: "Icon",
        props: {
          name: "settings-02",
          size: 40,
          strokeWidth: 2.5,
          color: { $theme: "color.accent.bg" },
        },
        children: [],
      }),
      "dark"
    );
  });

  it("rejects an unknown icon name with a structured validation error", () => {
    const result = validateSpec(
      frameWith("icon", {
        type: "Icon",
        props: { name: "not-a-real-icon" },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.path).toBe(".elements.icon.props.name");
      expect(result.error.message).toContain("Unknown icon name");
    }
  });

  it("rejects an Icon missing its required name", () => {
    const result = validateSpec(
      frameWith("icon", { type: "Icon", props: { size: 24 }, children: [] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.icon.props.name");
    }
  });
});

describe("Badge / Alert / Metric icon slot", () => {
  // Regression: each host must still render with NO icon prop (unchanged).
  for (const theme of themes) {
    it(`Badge renders without an icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("badge", {
          type: "Badge",
          props: { text: "Active", variant: "success" },
          children: [],
        }),
        theme
      );
    });

    it(`Badge renders WITH a leading icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("badge", {
          type: "Badge",
          props: { text: "Live", variant: "success", iconName: "checkmark-circle-02" },
          children: [],
        }),
        theme
      );
    });

    it(`Alert renders without an icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("alert", {
          type: "Alert",
          props: { title: "Notice", text: "Something happened.", variant: "info" },
          children: [],
        }),
        theme
      );
    });

    it(`Alert renders WITH a leading icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("alert", {
          type: "Alert",
          props: {
            title: "Warning",
            text: "Storage almost full.",
            variant: "warning",
            iconName: { name: "alert-circle", size: 22 },
          },
          children: [],
        }),
        theme
      );
    });

    it(`Metric renders without an icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("metric", {
          type: "Metric",
          props: { label: "Revenue", value: "$48.2k", delta: { value: "12.4%", direction: "up" } },
          children: [],
        }),
        theme
      );
    });

    it(`Metric renders WITH a vector icon in ${theme}`, async () => {
      await expectRenders(
        frameWith("metric", {
          type: "Metric",
          props: {
            label: "Wallet",
            value: "$1.2k",
            iconName: "wallet-01",
          },
          children: [],
        }),
        theme
      );
    });
  }

  it("keeps Metric's plain-text icon glyph working (backward compatible)", async () => {
    await expectRenders(
      frameWith("metric", {
        type: "Metric",
        props: { label: "Users", value: "1,204", icon: "★" },
        children: [],
      }),
      "light"
    );
  });

  it("rejects an unknown icon name in a Badge iconName slot", () => {
    const result = validateSpec(
      frameWith("badge", {
        type: "Badge",
        props: { text: "x", iconName: "bogus-icon-name" },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badge.props.iconName");
      expect(result.error.message).toContain("Unknown icon name");
    }
  });

  it("rejects an unknown icon name in an Alert iconName object slot", () => {
    const result = validateSpec(
      frameWith("alert", {
        type: "Alert",
        props: { text: "x", iconName: { name: "nope-nope" } },
        children: [],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.alert.props.iconName.name");
    }
  });
});
