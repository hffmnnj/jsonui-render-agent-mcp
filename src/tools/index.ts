import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPing } from "./ping.js";
import { registerRenderUi } from "./render-ui.js";

/**
 * Register all tools on the given MCP server instance.
 *
 * Add new tool registrations here as they are created — each tool module
 * exports its own `register*` function and is wired in below.
 */
export function registerTools(server: McpServer): void {
  registerPing(server);
  registerRenderUi(server);
}
