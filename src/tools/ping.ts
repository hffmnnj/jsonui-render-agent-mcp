import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register the `ping` tool — a trivial health-check endpoint.
 *
 * Takes no arguments, returns `"pong"` as a text content block.
 */
export function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      description: "Simple ping-pong health check. Returns 'pong'.",
    },
    () => {
      return {
        content: [{ type: "text" as const, text: "pong" }],
      };
    },
  );
}
