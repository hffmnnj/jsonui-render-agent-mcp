import { describe, expect, it } from "bun:test";
import { validateSpec } from "./validate";

describe("validateSpec", () => {
  it("accepts a valid minimal spec", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          props: { gap: 16, padding: 24 },
          children: ["heading", "text"],
        },
        heading: {
          type: "Heading",
          props: { text: "Hello", level: "h1" },
          children: [],
        },
        text: {
          type: "Text",
          props: { text: "World" },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tree.root).toBe("root");
      expect(result.tree.elements.root.props.width).toBe(400);
      expect(result.tree.elements.heading.props.text).toBe("Hello");
    }
  });

  it("rejects an unknown component name with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "UnknownComponent",
          props: { width: 400, height: 300 },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.root.type");
      expect(result.error.message).toContain("Frame");
    }
  });

  it("rejects a missing required Text prop with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badText"],
        },
        badText: {
          type: "Text",
          props: { color: "#333333" },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badText.props.text");
      expect(result.error.message).toContain("string");
    }
  });

  it("rejects a missing required Heading prop with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badHeading"],
        },
        badHeading: {
          type: "Heading",
          props: { level: "h1" },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badHeading.props.text");
      expect(result.error.message).toContain("string");
    }
  });
});
