import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const SERVER_INFO = {
  name: "jsonui-render-agent-mcp",
  version: "0.1.0",
} as const;

export type RunningServer = {
  close(): Promise<void>;
  server: McpServer;
};

/**
 * Connect the MCP server to standard input/output.
 *
 * stdout is owned exclusively by the transport. Callers must send any
 * diagnostics to stderr so they cannot corrupt JSON-RPC frames.
 */
export async function startServer(): Promise<RunningServer> {
  const server = new McpServer(SERVER_INFO);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  let closed = false;

  return {
    server,
    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      await server.close();
    },
  };
}
