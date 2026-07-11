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

  it("rejects a wrong-type Box prop with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badBox"],
        },
        badBox: {
          type: "Box",
          props: { padding: "20" },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badBox.props.padding");
      expect(result.error.message).toContain("number");
    }
  });

  it("rejects a malformed List items array with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badList"],
        },
        badList: {
          type: "List",
          props: { items: [] },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badList.props.items");
      expect(result.error.message).toContain("items");
    }
  });

  it("rejects a malformed BarChart data series with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badChart"],
        },
        badChart: {
          type: "BarChart",
          props: { data: [] },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badChart.props.data");
      expect(result.error.message).toContain(">=");
    }
  });

  it("rejects a LineChart missing both series and data with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badLine"],
        },
        badLine: {
          type: "LineChart",
          props: {},
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badLine.props.series");
      expect(result.error.message).toContain("series");
    }
  });

  it("rejects a malformed Metric nested sparkline with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badMetric"],
        },
        badMetric: {
          type: "Metric",
          props: { value: 48, label: "Sessions", sparkline: { data: [] } },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badMetric.props.sparkline.data");
      expect(result.error.message).toContain("items");
    }
  });

  it("rejects a malformed Table row cell with a structured error", () => {
    const result = validateSpec({
      root: "root",
      elements: {
        root: {
          type: "Frame",
          props: { width: 400, height: 300, backgroundColor: "#ffffff" },
          children: ["badTable"],
        },
        badTable: {
          type: "Table",
          props: { rows: [{ cells: [{ text: 123 }] }] },
          children: [],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe(".elements.badTable.props.rows[0]");
      expect(result.error.message).toBeDefined();
    }
  });

  it("returns the same structured error shape for every invalid case", () => {
    const cases = [
      validateSpec({
        root: "root",
        elements: { root: { type: "Nope", props: {}, children: [] } },
      }),
      validateSpec({
        root: "root",
        elements: {
          root: { type: "Frame", props: { width: 100 }, children: [] },
        },
      }),
      validateSpec({
        root: "root",
        elements: {
          root: {
            type: "Frame",
            props: { width: 100, height: 100 },
            children: ["list"],
          },
          list: { type: "List", props: { items: [] }, children: [] },
        },
      }),
      validateSpec({
        root: "root",
        elements: {
          root: {
            type: "Frame",
            props: { width: 100, height: 100 },
            children: ["chart"],
          },
          chart: { type: "BarChart", props: { data: [] }, children: [] },
        },
      }),
    ];

    for (const result of cases) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error.path).toBe("string");
        expect(typeof result.error.message).toBe("string");
        expect(result.error.path.length).toBeGreaterThan(0);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    }
  });
});
