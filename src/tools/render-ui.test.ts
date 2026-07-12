import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test, describe } from "bun:test";
import { exists } from "node:fs/promises";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function minimalSpec() {
  return {
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
        props: { text: "Render UI", level: "h2" },
        children: [],
      },
      text: {
        type: "Text",
        props: { text: "Validation → theme → render → image content.", fontSize: 16 },
        children: [],
      },
    },
  };
}

type ToolResponse = {
  content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>;
  isError?: boolean;
};

type StructuredError = {
  code: string;
  path: string;
  message: string;
};

function structuredError(result: ToolResponse): StructuredError {
  expect(result.isError).toBe(true);
  expect(result.content[0]?.type).toBe("text");
  return JSON.parse(result.content[0]?.text ?? "") as StructuredError;
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: Bun.which("bun") ?? process.execPath,
    args: ["run", "src/index.ts"],
    stderr: "pipe",
  });
  const client = new Client({ name: "render-ui-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    return await callback(client);
  } finally {
    await client.close();
  }
}

describe("render_ui tool", () => {
  test("is registered and discoverable", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "render_ui");
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("Frame");
      expect(tool!.description).toContain("Box");
      expect(tool!.description).toContain("Stack");
      expect(tool!.description).toContain("Row");
      expect(tool!.description).toContain("Text");
      expect(tool!.description).toContain("Heading");
    });
  });

  test("renders a valid spec with theme light and returns image + path", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: { spec: minimalSpec(), theme: "light" },
      })) as ToolResponse;

      expect(result.isError).toBeUndefined();
      expect(result.content).toBeArray();
      expect(result.content).toHaveLength(2);

      const imageBlock = result.content[0];
      expect(imageBlock.type).toBe("image");
      expect(imageBlock.mimeType).toBe("image/png");
      expect(imageBlock.data).toBeString();
      const png = Buffer.from(imageBlock.data!, "base64");
      expect(png.subarray(0, 8)).toEqual(pngSignature);
      expect(png.byteLength).toBeGreaterThan(1_000);

      const textBlock = result.content[1];
      expect(textBlock.type).toBe("text");
      expect(textBlock.text).toMatch(/^PNG written to: /);
      expect(await exists(textBlock.text!.replace("PNG written to: ", ""))).toBe(true);
    });
  });

  test("renders a valid spec with theme dark and returns a different image", async () => {
    await withClient(async (client) => {
      const lightResult = (await client.callTool({
        name: "render_ui",
        arguments: { spec: minimalSpec(), theme: "light" },
      })) as ToolResponse;

      const darkResult = (await client.callTool({
        name: "render_ui",
        arguments: { spec: minimalSpec(), theme: "dark" },
      })) as ToolResponse;

      expect(lightResult.isError).toBeUndefined();
      expect(darkResult.isError).toBeUndefined();

      const lightPng = Buffer.from(lightResult.content[0]!.data!, "base64");
      const darkPng = Buffer.from(darkResult.content[0]!.data!, "base64");

      expect(lightPng.subarray(0, 8)).toEqual(pngSignature);
      expect(darkPng.subarray(0, 8)).toEqual(pngSignature);
      expect(lightPng.byteLength).toBeGreaterThan(1_000);
      expect(darkPng.byteLength).toBeGreaterThan(1_000);

      expect(lightPng.equals(darkPng)).toBe(false);
    });
  });

  test("auto-sizes a Frame without height to its content layout", async () => {
    await withClient(async (client) => {
      const spec: { elements: { frame: { props: Record<string, unknown> } } } = minimalSpec();
      delete spec.elements.frame.props.height;
      const result = (await client.callTool({
        name: "render_ui",
        arguments: { spec, theme: "light" },
      })) as ToolResponse;

      expect(result.isError).toBeUndefined();
      const png = Buffer.from(result.content[0]!.data!, "base64");
      const dimensions = pngDimensions(png);
      expect(dimensions.width).toBe(640);
      expect(dimensions.height).toBeGreaterThan(100);
      expect(dimensions.height).toBeLessThan(500);
      expect(dimensions.height).not.toBe(1260);
    });
  });

  test("accepts autoSize as an explicit content-height request", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: { spec: minimalSpec(), theme: "light", autoSize: true },
      })) as ToolResponse;

      expect(result.isError).toBeUndefined();
      expect(pngDimensions(Buffer.from(result.content[0]!.data!, "base64")).height).toBeLessThan(360);
    });
  });

  test("returns a structured validation error for an invalid spec without crashing", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: { type: "NotAComponent", props: {}, children: [] },
            },
          },
          theme: "light",
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.path).toBe(".elements.frame.type");
    });
  });

  test("returns a structured validation error for a missing required prop", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: { type: "Frame", props: { height: 180 }, children: [] },
            },
          },
          theme: "light",
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.path).toContain(".elements.frame.props");
    });
  });

  test("rejects an oversized List before rendering", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: {
                type: "Frame",
                props: { width: 320, height: 180 },
                children: ["list"],
              },
              list: {
                type: "List",
                props: { items: Array.from({ length: 1_001 }, () => "item") },
                children: [],
              },
            },
          },
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error).toMatchObject({
        code: "VALIDATION_ERROR",
        path: ".elements.list.props.items",
      });
      expect(error.message).toContain("maximum length of 1000");
    });
  });

  test("returns a structured error for a dangling child reference", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: { type: "Frame", props: { width: 320, height: 180 }, children: ["missing"] },
            },
          },
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error).toMatchObject({ code: "VALIDATION_ERROR", path: ".elements.frame.children[0]" });
      expect(error.message).toContain("does not exist");
    });
  });

  test("returns a structured error for a missing root key", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "missing",
            elements: {
              frame: { type: "Frame", props: { width: 320, height: 180 }, children: [] },
            },
          },
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error).toMatchObject({ code: "VALIDATION_ERROR", path: ".root" });
      expect(error.message).toContain("does not exist");
    });
  });

  test("returns a structured error for non-positive Frame dimensions", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: { type: "Frame", props: { width: -320, height: 180 }, children: [] },
            },
          },
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error).toMatchObject({ code: "VALIDATION_ERROR", path: ".elements.frame.props.width" });
      expect(error.message).toContain("finite positive");
    });
  });

  test("returns a structured error for cyclic child references", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "render_ui",
        arguments: {
          spec: {
            root: "frame",
            elements: {
              frame: { type: "Frame", props: { width: 320, height: 180 }, children: ["a"] },
              a: { type: "Stack", props: {}, children: ["b"] },
              b: { type: "Stack", props: {}, children: ["a"] },
            },
          },
        },
      })) as ToolResponse;

      const error = structuredError(result);
      expect(error).toMatchObject({ code: "VALIDATION_ERROR", path: ".elements.a" });
      expect(error.message).toContain("cycle");
    });
  });
});
