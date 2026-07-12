import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";

test("ping tool is registered and returns pong", async () => {
  const transport = new StdioClientTransport({
    command: Bun.which("bun") ?? process.execPath,
    args: ["run", "src/index.ts"],
    stderr: "pipe",
  });
  const client = new Client({ name: "ping-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);

    /* 1. List tools and confirm ping is present. */
    const { tools } = await client.listTools();
    const pingTool = tools.find((t) => t.name === "ping");
    expect(pingTool).toBeDefined();
    expect(pingTool!.description).toBeString();

    /* 2. Invoke ping and check the response. */
    const result = await client.callTool({ name: "ping" });
    const content = (result as { content: Array<{ type: string; text: string }> }).content;
    expect(content).toBeArray();
    expect(content[0]).toMatchObject({
      type: "text",
      text: "pong",
    });
  } finally {
    await client.close();
  }
});
