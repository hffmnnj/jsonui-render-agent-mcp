# jsonui-render-agent-mcp

A browserless MCP server that renders beautiful, theme-aware UI images from a JSON spec and returns a PNG for delivery over chat gateways such as iMessage and Telegram.

## Output defaults

Renders are produced at PNG density `2x` by default so text and charts stay crisp on mobile/chat previews. The logical canvas defaults to **1200 × 630 px** (a social-card-friendly ~1.9:1 ratio). You can override any of these per request:

- Pass explicit `width`/`height` on the root `Frame` element.
- Pass `width`, `height`, or `scale` as `render_ui` tool arguments (these take precedence over the Frame root).

Representative benchmark on the included `examples/dashboard.json` exemplar: well under 5 seconds and under 2 MB.

## Setup

Setup instructions will be added once the server implementation is complete.
