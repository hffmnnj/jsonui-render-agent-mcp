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

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Validation error");
      expect(result.content[0].text).toContain(".elements.frame.type");
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
              frame: { type: "Frame", props: { width: 320 }, children: [] },
            },
          },
          theme: "light",
        },
      })) as ToolResponse;

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Validation error");
      expect(result.content[0].text).toContain(".elements.frame.props");
    });
  });
});
