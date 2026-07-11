import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";

test("accepts an MCP initialize handshake over stdio", async () => {
  const transport = new StdioClientTransport({
    command: Bun.which("bun") ?? process.execPath,
    args: ["run", "src/index.ts"],
    stderr: "pipe",
  });
  const client = new Client({ name: "bootstrap-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    expect(client.getServerVersion()).toEqual({
      name: "jsonui-render-agent-mcp",
      version: "0.1.0",
    });
  } finally {
    await client.close();
  }
});
