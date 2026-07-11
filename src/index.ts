/**
 * JSON-UI Render MCP Server
 *
 * Entry point for the browserless MCP server that renders JSON UI specs to
 * crisp PNG images via Satori and @resvg/resvg-js.
 */

export async function main(): Promise<void> {
  console.log("jsonui-render-agent-mcp is ready to start (scaffold only).");
}

if (import.meta.main) {
  await main();
}
