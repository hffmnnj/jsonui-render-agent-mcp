import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, test } from "bun:test";

import { catalog } from "../catalog/index.js";

type ToolResponse = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

async function withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: Bun.which("bun") ?? process.execPath,
    args: ["run", "src/index.ts"],
    stderr: "pipe",
  });
  const client = new Client({ name: "list-components-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    return await callback(client);
  } finally {
    await client.close();
  }
}

describe("list_components tool", () => {
  test("is registered and discoverable", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "list_components");
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("catalog");
    });
  });

  test("returns all registered components with descriptions and JSON Schema props", async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: "list_components",
        arguments: {},
      })) as ToolResponse;

      expect(result.isError).toBeUndefined();
      expect(result.content).toBeArray();
      expect(result.content).toHaveLength(1);

      const textBlock = result.content[0];
      expect(textBlock.type).toBe("text");

      const payload = JSON.parse(textBlock.text!);
      expect(payload.components).toBeArray();
      expect(payload.components).toHaveLength(
        Object.keys(catalog.data.components).length,
      );

      for (const entry of payload.components) {
        expect(entry.name).toBeString();
        expect(entry.description).toBeString();
        expect(entry.props).toBeObject();
        expect(entry.props.type).toBe("object");
      }
    });
  });
});
