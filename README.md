# jsonui-render-agent-mcp

A browserless MCP server that renders beautiful, theme-aware UI images from a JSON spec and returns a PNG for delivery over chat gateways such as iMessage and Telegram.

Think of it as **Claude Artifacts, but the artifact is a crisp PNG** — agents describe a dashboard, card, chart, or metric in a structured, guard-railed JSON format and get back a rasterized image they can send straight to a user.

Under the hood, specs are validated against a bounded component catalog, resolved to concrete design tokens for the requested theme, rendered to SVG by [Satori](https://github.com/vercel/satori), and rasterized to PNG by [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js). No browser is launched, no CDN is fetched at render time, and every color, spacing, and shadow value is drawn from a single hand-authored token system.

## Setup

Requires [Bun](https://bun.sh/) >= 0.8.1.

The floor is driven by `@resvg/resvg-js`, the SVG→PNG rasterizer, which documents Bun support starting at 0.8.1. The server itself uses only standard ESM/Node.js-compatible APIs (`node:fs/promises`, `node:os`, `node:path`, `import.meta.main`, `process.hrtime.bigint`) that are available in that release.

```bash
bun install
bun run typecheck   # optional sanity check
bun test            # optional: full test suite
```

To start the server directly:

```bash
bun run dev
```

The server speaks MCP over stdio. It does not open a network port.

## Registering with an MCP client (Hermes Agent / OpenClaw)

The server is a standard MCP stdio server. Register it the same way you register any command-based stdio MCP server — point the client at the local checkout and run `bun run src/index.ts`.

For Hermes Agent, add an entry under `mcp_servers` in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  jsonui-render-agent-mcp:
    command: bun
    args:
      - run
      - /home/james/Documents/jsonui-render-agent-mcp/src/index.ts
    enabled: true
```

(Adjust the absolute path to match your checkout location. The equivalent OpenClaw / Claude Desktop / other stdio MCP client entry uses `bun run <checkout>/src/index.ts` as the command.)

## Tools

The server exposes exactly three MCP tools:

- **`ping`** — health check; returns `"pong"`.
- **`list_components`** — returns the full v1 catalog: every component name, description, and prop schema as JSON Schema.
- **`render_ui`** — accepts a validated JSON spec + optional `theme` (`"light"` or `"dark"`, default `"light"`) and returns a base64 PNG image content block plus a text block with the on-disk temp path.

Call `list_components` first to discover what components and props are available.

## Component catalog

The v1 catalog is fixed at 22 components across four categories.

### Layout

- **Frame** — Root image container. Defines the output image dimensions and background. Must be the root element.
- **Box** — Generic container with padding, margin, background, border, and flex alignment. Supports absolute positioning.
- **Stack** — Vertical flex layout. Use for stacking elements top to bottom.
- **Row** — Horizontal flex layout. Use for placing elements side by side.
- **Grid** — Equal-column grid layout (flex-wrap based). Children flow into `columns` equal-width cells per row, wrapping to new rows, separated by `gap`.
- **Spacer** — Empty sizing element. Fixed `size` (px) holds a gap; `grow: true` (flex: 1) absorbs remaining space.
- **Divider** — Thin separator line. `orientation` picks the axis; pass a `$theme.color.*` color to track the theme.

### Content

- **Heading** — Heading text at various levels. `h1` is largest, `h4` is smallest.
- **Text** — Body text with configurable size, color, weight, and alignment.
- **Badge** — Small inline pill label for statuses and tags. Set `variant` and supply matching `$theme` color refs (e.g. `color.success.bg` / `.fg`).
- **Avatar** — Circular identity marker. `mode: "initials"` (default) draws initials on a tinted disc; `mode: "image"` needs a base64 `data:` URI in `src` (remote URLs are not fetched).
- **Alert** — Bordered, tinted callout with optional title and required body text. Set `variant` and supply matching `$theme` refs (`color.<status>.subtle` / `.border` / `.bg`).
- **List** — Vertical list of string or `{ text, secondary }` items with a selectable marker (`none` / `disc` / `dash` / `check` / `number`).

### Composite

- **Card** — Surface container with optional `header` / `footer` regions (arrays of child-element keys) and a required body (children slot). Background, border, radius, and elevation are token-driven; a bare Card auto-themes.
- **Table** — Header row + data rows. `header` styles a distinct column row; `rows` is an array of cell arrays or `{ cells }`. `striped` zebra-stripes body rows. Colors take `$theme` refs.
- **Progress** — Linear progress bar. Fill width is `value / max` (default 100) clamped 0–100%. Track/fill colors and `height` / `radius` are token-driven; optional `label` with `showValue`.

### Charts

- **PieChart** — Proportional pie/donut chart from a `data` series of `{ label, value }`. `donut: true` (or `innerRadius`) cuts a center hole. Slice fills cycle the categorical ramp — pass `colors: { $theme: "color.chart" }`. A single 100% slice renders as a solid disc/ring.
- **ProgressRing** — Circular progress indicator / gauge. A track ring plus an arc filled to `value / max` (clamped 0–100%); renders correctly at 0%, 50%, and 100%. Track/fill colors are token-driven; optional centered `label` / `sublabel`.
- **BarChart** — Vertical bar chart for a single categorical series of `{ label, value }` (or bare numbers). Zero-anchored bars whose fills cycle the categorical ramp — pass `colors: { $theme: "color.chart" }` — or a single `barColor`. Optional gridlines, x-axis labels, and Y tick labels are token-driven div overlays.
- **LineChart** — One or more line series over a shared axis. Provide `series` (`[{ name?, data }]`) or the single-series `data` shorthand. Lines cycle the ramp per series, optionally `smooth`, with `showPoints` and single-series `showArea`. Gridlines and labels are token-driven div overlays.
- **Sparkline** — Compact, axis-less mini line chart for inline use (e.g. beside a Metric value). Just the trend line with optional `smooth`, translucent `showArea`, and an end `showEndDot`. `color` takes a `$theme.color.*` ref.
- **Metric** — Compact stat / KPI card: a large hero `value`, a `label`, an optional signed `delta` chip, and an optional inline `sparkline`. Surface, border, radius, and elevation are token-driven; `plain: true` renders just the stat.

## Token and theming system

Every render call accepts a `theme` argument: `"light"` or `"dark"` (default `"light"`). Rather than shipping CSS variables, the server runs a token-resolution pass that replaces `{ $theme: "<token.path>" }` references with concrete values before the spec reaches the renderer. This works because Satori only supports inline styles.

The token system lives in `src/tokens/` and covers:

- **Colors** — full light and dark palettes including foreground, background, surface, muted foregrounds, borders, and semantic status slots (`success`, `danger`, `warning`, `info`, `accent`).
- **Spacing** — 4px-base scale from `0` to `24`.
- **Typography** — font sizes from `xs` (12 px) up to `display` (48 px), plus weights and line heights.
- **Radii** — `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `full`.
- **Elevation** — literal `box-shadow` strings, scoped per theme (light shadows are soft; dark shadows are deeper and more opaque).

To make a component theme-aware, pass a `$theme` ref instead of a literal value:

```json
{ "backgroundColor": { "$theme": "color.surface" } }
{ "borderRadius": { "$theme": "radius.lg" } }
{ "elevation": { "$theme": "elevation.sm" } }
{ "colors": { "$theme": "color.chart" } }
```

See `src/tokens/index.ts` and `src/tokens/palettes.ts` for the full token map.

## `render_ui` usage example

```json
{
  "spec": {
    "root": "card",
    "elements": {
      "card": {
        "type": "Card",
        "props": {
          "backgroundColor": { "$theme": "color.surface" },
          "borderColor": { "$theme": "color.border" },
          "borderRadius": { "$theme": "radius.lg" },
          "elevation": { "$theme": "elevation.sm" },
          "padding": { "$theme": "spacing.6" }
        },
        "children": ["title", "body"]
      },
      "title": {
        "type": "Heading",
        "props": {
          "text": "Weekly sign-ups",
          "level": "h3",
          "color": { "$theme": "color.foreground" }
        },
        "children": []
      },
      "body": {
        "type": "BarChart",
        "props": {
          "data": [
            { "label": "Mon", "value": 120 },
            { "label": "Tue", "value": 190 },
            { "label": "Wed", "value": 150 },
            { "label": "Thu", "value": 270 },
            { "label": "Fri", "value": 220 }
          ],
          "colors": { "$theme": "color.chart" },
          "gridColor": { "$theme": "color.border" },
          "labelColor": { "$theme": "color.mutedForeground" }
        },
        "children": []
      }
    }
  },
  "theme": "light"
}
```

Returns:

```json
{
  "content": [
    { "type": "image", "data": "<base64 png>", "mimeType": "image/png" },
    { "type": "text", "text": "PNG written to: /tmp/jsonui-render-mcp/jsonui-render-....png" }
  ]
}
```

A richer example combining metrics, charts, tables, and alerts is included in `examples/dashboard.json`.

## Output defaults

Renders are produced at PNG density `2×` by default so text and charts stay crisp on mobile and chat previews. The logical canvas defaults to **1200 × 630 px** (a social-card-friendly ~1.9:1 ratio).

You can override these per request:

- Pass explicit `width` / `height` on the root `Frame` element.
- Pass `width`, `height`, or `scale` as `render_ui` tool arguments (these take precedence over the Frame root).

Representative benchmark on the included `examples/dashboard.json` exemplar: well under 5 seconds and under 2 MB on a typical workstation.

## Known limitations

- **No runtime network access.** `Avatar` in `mode: "image"` expects a base64 `data:` URI; remote URLs are not fetched.
- **Charts need explicit sizing inside flexible parents.** A chart placed directly inside a `Card` or `Row` may collapse unless it has an explicit `width`/`height` or its parent provides a definite cross-axis size.
- **Satori is SVG-only.** All text is rendered as flexbox text; SVG `<text>` nodes are not used, which keeps charts sharp but means very advanced SVG text layout is not available.
- **Static images only.** The output is a PNG, not an interactive page or widget.

## Development

```bash
bun run dev      # start the stdio server
bun run test     # run the full test suite
bun run typecheck
```
