# SKILL.md — Using the JSON-UI Render MCP Server

A complete usage guide for AI agents that want to render dashboards, cards, charts, and metrics as PNG images through the MCP server.

Read this when you need to **call** the `jsonui-render-agent-mcp` server as a tool. For guidance on modifying the server code itself, see `AGENTS.md`.

---

## What this server does

`jsonui-render-agent-mcp` is a browserless MCP server that turns a JSON UI spec into a crisp PNG image. It validates the spec, resolves theme tokens, renders the tree through Satori (HTML/CSS → SVG), rasterizes with `@resvg/resvg-js`, and returns:

- an MCP `image` content block with a base64-encoded PNG and `mimeType: "image/png"`, and
- an adjacent `text` content block with the absolute path of the temp-file copy.

Use it when you want to generate shareable UI images for chat gateways (iMessage, Telegram, Slack) or any context where a static, good-looking raster is better than raw text or a live webpage.

The visual goal: **Claude Artifacts, but rendered to a PNG**.

---

## MCP registration (stdio transport)

The server uses the official `@modelcontextprotocol/sdk` over **stdio**. Register it with any stdio-capable MCP client.

### Hermes Agent / OpenClaw-style config

```json
{
  "mcpServers": {
    "jsonui-render": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/this/repo/src/index.ts"],
      "env": {}
    }
  }
}
```

### Requirements

- **Bun runtime** (declared minimum `>=0.8.1`).
- The server is the repo's `src/index.ts`, launched with `bun run src/index.ts`.
- stdout is owned by MCP JSON-RPC; send any diagnostics to stderr.

After registration, list tools and confirm three tools exist: `ping`, `render_ui`, and `list_components`.

---

## Tools

### `ping`

Simple health check.

**Input:** none (empty object).

**Output:**

```json
{
  "content": [{ "type": "text", "text": "pong" }]
}
```

**Example call:**

```json
{
  "name": "ping",
  "arguments": {}
}
```

---

### `list_components`

Returns the full v1 catalog: every component name, description, and its prop schema as JSON Schema.

**Input:** none (empty object).

**Output:** one text content block containing JSON:

```json
{
  "components": [
    {
      "name": "Frame",
      "description": "Root image container...",
      "props": { "type": "object", "properties": { ... }, "required": [...] }
    },
    ...
  ]
}
```

**Example call:**

```json
{
  "name": "list_components",
  "arguments": {}
}
```

**Why call it:** use `list_components` before composing a complex spec to confirm the live catalog and inspect exact prop schemas. The v1 catalog is fixed at 22 components.

---

### `render_ui`

The main tool. Validates and renders a JSON UI spec to PNG.

**Input schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `spec` | object | yes | — | The JSON UI spec (see below). |
| `theme` | `"light" \| "dark"` | no | `"light"` | Visual theme. |
| `width` | positive number | no | root Frame width or `1200` | Override render width in logical px. |
| `height` | positive number | no | root Frame height or `630` | Override render height in logical px. |
| `scale` | number `>=1` | no | `2` | PNG density multiplier for crisp previews. |

**Output on success:**

```json
{
  "content": [
    {
      "type": "image",
      "data": "<base64 PNG bytes>",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "PNG written to: /tmp/jsonui-render-mcp/jsonui-render-....png"
    }
  ]
}
```

**Output on failure:** a single text content block with `isError: true` containing a JSON object with `code`, `path`, and `message`.

**Example call:**

```json
{
  "name": "render_ui",
  "arguments": {
    "spec": {
      "root": "frame",
      "elements": {
        "frame": {
          "type": "Frame",
          "props": { "width": 640, "height": 360, "padding": 24 },
          "children": ["stack"]
        },
        "stack": {
          "type": "Stack",
          "props": { "gap": 12 },
          "children": ["title", "body"]
        },
        "title": {
          "type": "Heading",
          "props": { "text": "Hello Agent", "level": "h2" },
          "children": []
        },
        "body": {
          "type": "Text",
          "props": { "text": "This spec was rendered by jsonui-render-agent-mcp.", "fontSize": 16 },
          "children": []
        }
      }
    },
    "theme": "light",
    "scale": 2
  }
}
```

---

## Spec shape

Every spec is a flat keyed tree:

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 1200, "height": 630 },
      "children": ["header", "body"]
    },
    "header": { "type": "Heading", "props": { "text": "Title" }, "children": [] },
    "body": { "type": "Text", "props": { "text": "Body" }, "children": [] }
  }
}
```

- `root` is the key of the top-level element. It must be a `Frame`.
- `elements` is a map of `key → { type, props, children? }`.
- `children` is an array of element keys, in render order.
- Component-specific regions (e.g. `Card.header`/`Card.footer`) also use arrays of element keys, but live inside `props`.

### `$theme` references

Many props accept either a literal value or a theme token reference object:

```json
{ "$theme": "color.surface" }
{ "$theme": "spacing.4" }
{ "$theme": "elevation.md" }
{ "$theme": "radius.lg" }
{ "$theme": "color.chart" }
```

The server resolves these to literal values before rendering. Use them to keep specs theme-agnostic and visually consistent.

---

## Component catalog

The v1 catalog has **22 components**.

- **Layout primitives:** Frame, Box, Stack, Row, Grid, Spacer, Divider
- **Content primitives:** Text, Heading, Badge, Avatar, Alert, List
- **Composite primitives:** Card, Table, Progress
- **Charts / metrics:** BarChart, LineChart, Sparkline, PieChart, ProgressRing, Metric

Every prop table below is derived from the live Zod schemas in `src/catalog/schema.ts`. `colorValue` means `string | { $theme: string }`. `themeableNumber` means `number | { $theme: string }`. `themeableString` means `string | { $theme: string }`.

### Frame

Root image container. Must be the root element. Defines output dimensions and background.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `width` | number | yes | — | Canvas width in px. |
| `height` | number | yes | — | Canvas height in px. |
| `backgroundColor` | colorValue | no | `color.background` | Canvas fill. |
| `padding` | number \| null | no | — | Inner padding. |
| `display` | `"flex" \| "none"` \| null | no | — | Display mode. |
| `flexDirection` | `"row" \| "column"` \| null | no | — | Main axis of Frame children. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |

**Example:**

```json
{
  "type": "Frame",
  "props": {
    "width": 1200,
    "height": 630,
    "padding": 32,
    "backgroundColor": { "$theme": "color.background" },
    "flexDirection": "column"
  },
  "children": ["header", "body"]
}
```

---

### Box

Generic container with padding, margin, background, border, and flex alignment. Supports absolute positioning.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `padding` | number \| null | no | — | Uniform inner padding. |
| `paddingTop` | number \| null | no | — | Top padding. |
| `paddingBottom` | number \| null | no | — | Bottom padding. |
| `paddingLeft` | number \| null | no | — | Left padding. |
| `paddingRight` | number \| null | no | — | Right padding. |
| `margin` | number \| null | no | — | Outer margin. |
| `backgroundColor` | colorValue \| null | no | — | Fill color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderColor` | colorValue \| null | no | — | Border color. |
| `borderRadius` | number \| null | no | `radius.md` | Corner radius. |
| `flex` | number \| null | no | — | Flex grow factor. |
| `width` | number \| string \| null | no | — | Fixed or relative width. |
| `height` | number \| string \| null | no | — | Fixed or relative height. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |
| `flexDirection` | `"row" \| "column"` \| null | no | — | Children layout axis. |
| `position` | `"relative" \| "absolute"` \| null | no | — | Positioning mode. |
| `top` / `left` / `right` / `bottom` | number \| null | no | — | Absolute offsets. |
| `overflow` | `"visible" \| "hidden"` \| null | no | — | Clipping behavior. |

**Example:**

```json
{
  "type": "Box",
  "props": {
    "padding": 24,
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" },
    "borderWidth": 1,
    "borderRadius": 16,
    "flex": 1
  },
  "children": ["title", "chart"]
}
```

---

### Stack

Vertical flex layout (column).

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `gap` | number \| null | no | — | Vertical space between children. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |
| `padding` | number \| null | no | — | Inner padding. |
| `flex` | number \| null | no | — | Flex grow factor. |

**Example:**

```json
{
  "type": "Stack",
  "props": { "gap": 12, "padding": 16 },
  "children": ["heading", "text", "badgeRow"]
}
```

---

### Row

Horizontal flex layout (row).

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `gap` | number \| null | no | — | Horizontal space between children. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |
| `padding` | number \| null | no | — | Inner padding. |
| `flex` | number \| null | no | — | Flex grow factor. |
| `wrap` | boolean \| null | no | — | Allow children to wrap. |

**Example:**

```json
{
  "type": "Row",
  "props": { "gap": 12, "alignItems": "center", "justifyContent": "space-between" },
  "children": ["title", "badge"]
}
```

---

### Grid

Equal-column flex-wrap grid.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `columns` | integer `>0` \| null | no | `2` | Columns per row. |
| `gap` | number \| null | no | — | Space between cells. |
| `alignItems` | align enum \| null | no | — | Cell cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Cell main-axis distribution. |
| `padding` | number \| null | no | — | Inner padding. |
| `flex` | number \| null | no | — | Flex grow factor. |

**Example:**

```json
{
  "type": "Grid",
  "props": { "columns": 4, "gap": 20 },
  "children": ["m1", "m2", "m3", "m4"]
}
```

---

### Spacer

Empty sizing element.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `size` | number `>=0` \| null | no | — | Fixed width/height in px. |
| `grow` | boolean \| null | no | — | When true, expands as `flex: 1`. |

**Example:**

```json
{
  "type": "Spacer",
  "props": { "grow": true },
  "children": []
}
```

---

### Divider

Thin separator line.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `orientation` | `"horizontal" \| "vertical"` \| null | no | — | Line axis. |
| `color` | colorValue \| null | no | `color.border` | Line color. |
| `thickness` | number `>0` \| null | no | `1` | Line thickness. |
| `length` | number \| string \| null | no | `"100%"` | Length along the main axis. |
| `margin` | number \| null | no | — | Margin around the line. |

**Example:**

```json
{
  "type": "Divider",
  "props": { "orientation": "horizontal", "color": { "$theme": "color.border" } },
  "children": []
}
```

---

### Text

Body text.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Text content. |
| `fontSize` | number \| null | no | — | Size in px. |
| `color` | colorValue \| null | no | `color.foreground` | Text color. |
| `align` | `"left" \| "center" \| "right"` \| null | no | — | Horizontal alignment. |
| `fontWeight` | `"normal" \| "bold"` \| null | no | — | Weight. |
| `fontStyle` | `"normal" \| "italic"` \| null | no | — | Style. |
| `lineHeight` | number \| null | no | — | Line height ratio. |
| `letterSpacing` | number \| string \| null | no | — | Tracking. |
| `textDecoration` | `"none" \| "underline" \| "line-through"` \| null | no | — | Decoration. |

**Example:**

```json
{
  "type": "Text",
  "props": {
    "text": "Revenue grew 12.4% this month.",
    "fontSize": 16,
    "color": { "$theme": "color.mutedForeground" }
  },
  "children": []
}
```

---

### Heading

Heading text.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Text content. |
| `level` | `"h1" \| "h2" \| "h3" \| "h4"` \| null | no | — | Size level. h1 is largest. |
| `color` | colorValue \| null | no | `color.foreground` | Text color. |
| `align` | `"left" \| "center" \| "right"` \| null | no | — | Horizontal alignment. |
| `letterSpacing` | number \| string \| null | no | — | Tracking. |
| `lineHeight` | number \| null | no | — | Line height ratio. |

**Example:**

```json
{
  "type": "Heading",
  "props": { "text": "Platform Overview", "level": "h2", "letterSpacing": "-0.02em" },
  "children": []
}
```

---

### Badge

Small inline pill label.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Label text. |
| `variant` | status variant enum \| null | no | — | Intent hint (`default`, `accent`, `danger`, `success`, `warning`, `info`). |
| `backgroundColor` | colorValue \| null | no | `color.neutral.bg` | Fill. |
| `color` | colorValue \| null | no | `color.neutral.fg` | Text color. |
| `borderColor` | colorValue \| null | no | — | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `fontSize` | number \| null | no | — | Text size. |
| `fontWeight` | `"normal" \| "medium" \| "semibold" \| "bold"` \| null | no | — | Weight. |
| `paddingX` | number \| null | no | — | Horizontal padding. |
| `paddingY` | number \| null | no | — | Vertical padding. |
| `borderRadius` | number \| null | no | — | Corner radius. |
| `letterSpacing` | number \| string \| null | no | — | Tracking. |
| `uppercase` | boolean \| null | no | — | Uppercase text. |

**Example:**

```json
{
  "type": "Badge",
  "props": {
    "text": "Operational",
    "variant": "success",
    "uppercase": true,
    "backgroundColor": { "$theme": "color.success.subtle" },
    "color": { "$theme": "color.success.bg" },
    "borderColor": { "$theme": "color.success.border" },
    "borderWidth": 1
  },
  "children": []
}
```

---

### Avatar

Circular identity marker.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `"initials" \| "image"` \| null | no | `"initials"` | Render mode. |
| `initials` | string \| null | no | — | Initials text. |
| `src` | string \| null | no | — | For `mode: "image"`, a base64 `data:` URI. Remote URLs are not fetched. |
| `size` | number \| null | no | — | Disc size in px. |
| `shape` | `"circle" \| "rounded" \| "square"` \| null | no | — | Shape. |
| `backgroundColor` | colorValue \| null | no | `color.accent.bg` | Disc fill. |
| `color` | colorValue \| null | no | `color.accent.fg` | Initials color. |
| `borderColor` | colorValue \| null | no | — | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `fontSize` | number \| null | no | — | Initials font size. |
| `fontWeight` | `"normal" \| "medium" \| "semibold" \| "bold"` \| null | no | — | Initials weight. |

**Example:**

```json
{
  "type": "Avatar",
  "props": {
    "mode": "initials",
    "initials": "JH",
    "size": 48,
    "backgroundColor": { "$theme": "color.accent.bg" },
    "color": { "$theme": "color.accent.fg" }
  },
  "children": []
}
```

---

### Alert

Bordered, tinted callout.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Body text. |
| `title` | string \| null | no | — | Optional title. |
| `variant` | `"info" \| "success" \| "warning" \| "danger" \| "neutral"` \| null | no | — | Intent. |
| `backgroundColor` | colorValue \| null | no | `color.surfaceMuted` | Fill. |
| `borderColor` | colorValue \| null | no | `color.border` | Border. |
| `titleColor` | colorValue \| null | no | `color.foreground` | Title color. |
| `color` | colorValue \| null | no | `color.mutedForeground` | Body color. |
| `accentColor` | colorValue \| null | no | — | Left accent bar color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderRadius` | number \| null | no | — | Corner radius. |
| `padding` | number \| null | no | — | Inner padding. |
| `gap` | number \| null | no | — | Space between title and body. |
| `showAccentBar` | boolean \| null | no | — | Show a left accent bar. |

**Example:**

```json
{
  "type": "Alert",
  "props": {
    "title": "Heads up",
    "text": "Your storage is almost full.",
    "variant": "warning",
    "backgroundColor": { "$theme": "color.warning.subtle" },
    "borderColor": { "$theme": "color.warning.border" },
    "titleColor": { "$theme": "color.warning.bg" },
    "accentColor": { "$theme": "color.warning.bg" }
  },
  "children": []
}
```

---

### List

Vertical list of items.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `items` | array (min 1) | yes | — | Strings or `{ text, secondary? }` objects. |
| `marker` | `"none" \| "disc" \| "dash" \| "check" \| "number"` \| null | no | — | Bullet style. |
| `gap` | number \| null | no | — | Space between items. |
| `fontSize` | number \| null | no | — | Text size. |
| `color` | colorValue \| null | no | `color.foreground` | Primary text color. |
| `secondaryColor` | colorValue \| null | no | `color.mutedForeground` | Secondary text color. |
| `markerColor` | colorValue \| null | no | — | Bullet color. |
| `lineHeight` | number \| null | no | — | Line height ratio. |

**Example:**

```json
{
  "type": "List",
  "props": {
    "marker": "check",
    "gap": 8,
    "items": [
      "Backups enabled",
      { "text": "2FA", "secondary": "Recommended" }
    ]
  },
  "children": []
}
```

---

### Card

Surface container with optional `header` and `footer` regions and a required body (`children`).

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `header` | string[] \| null | no | — | Element keys rendered in the header region. |
| `footer` | string[] \| null | no | — | Element keys rendered in the footer region. |
| `backgroundColor` | colorValue \| null | no | `color.surface` | Card fill. |
| `borderColor` | colorValue \| null | no | `color.border` | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderRadius` | themeableNumber \| null | no | `radius.lg` | Corner radius. |
| `padding` | themeableNumber \| null | no | — | Inner padding. |
| `gap` | themeableNumber \| null | no | — | Space between body children. |
| `elevation` | themeableString \| null | no | — | Box shadow. |
| `dividerColor` | colorValue \| null | no | — | Separator between header/body/footer. |
| `width` | number \| string \| null | no | — | Fixed or relative width. |
| `flex` | number \| null | no | — | Flex grow factor. |

**Example:**

```json
{
  "type": "Card",
  "props": {
    "header": ["cardTitle"],
    "footer": ["cardMeta"],
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" },
    "borderRadius": { "$theme": "radius.lg" },
    "elevation": { "$theme": "elevation.md" }
  },
  "children": ["cardBody"]
}
```

---

### Table

Header row + data rows.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `header` | cell[] \| null | no | — | Distinct header row cells. |
| `rows` | (cell[] \| `{ cells }`)[] (min 1) | yes | — | Data rows. |
| `striped` | boolean \| null | no | `true` | Zebra-stripe body rows. |
| `rowBorders` | boolean \| null | no | `true` | Draw hairline under each row. |
| `cellPaddingX` | number \| null | no | — | Horizontal cell padding. |
| `cellPaddingY` | number \| null | no | — | Vertical cell padding. |
| `fontSize` | number \| null | no | — | Cell text size. |
| `backgroundColor` | colorValue \| null | no | `color.background` | Table fill. |
| `headerBackgroundColor` | colorValue \| null | no | `color.surfaceMuted` | Header fill. |
| `headerColor` | colorValue \| null | no | `color.foreground` | Header text color. |
| `color` | colorValue \| null | no | `color.mutedForeground` | Body text color. |
| `borderColor` | colorValue \| null | no | `color.border` | Row border color. |
| `stripeColor` | colorValue \| null | no | `color.surface` | Alternate row fill. |
| `borderRadius` | number \| null | no | — | Outer corner radius. |
| `borderWidth` | number \| null | no | — | Border thickness. |

A **cell** is either a string or `{ text, align?, color? }`.

**Example:**

```json
{
  "type": "Table",
  "props": {
    "header": ["Service", "Status", "Uptime"],
    "rows": [
      ["API", { "text": "Operational", "color": { "$theme": "color.success.bg" } }, "99.98%"],
      ["Database", { "text": "Degraded", "color": { "$theme": "color.warning.bg" } }, "99.91%"]
    ],
    "striped": true,
    "headerBackgroundColor": { "$theme": "color.surfaceMuted" },
    "borderColor": { "$theme": "color.border" }
  },
  "children": []
}
```

---

### Progress

Linear progress bar.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | number | yes | — | Current value. |
| `max` | number `>0` \| null | no | `100` | Denominator. |
| `trackColor` | colorValue \| null | no | `color.surfaceMuted` | Unfilled track color. |
| `fillColor` | colorValue \| null | no | `color.accent.bg` | Fill color. |
| `height` | number `>0` \| null | no | `8` | Bar height in px. |
| `radius` | number `>=0` \| null | no | `height / 2` | Corner radius. |
| `label` | string \| null | no | — | Caption above the bar. |
| `showValue` | boolean \| null | no | `false` | Show computed percentage. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |
| `fontSize` | number \| null | no | — | Label size. |
| `width` | number \| string \| null | no | — | Bar width. |

**Example:**

```json
{
  "type": "Progress",
  "props": {
    "value": 72,
    "label": "Storage used",
    "showValue": true,
    "height": 10,
    "trackColor": { "$theme": "color.surfaceMuted" },
    "fillColor": { "$theme": "color.accent.bg" }
  },
  "children": []
}
```

---

### BarChart

Vertical bar chart for one categorical series.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | seriesPoint[] (min 1) | yes | — | `{ label?, value }` or bare numbers. |
| `width` | number `>0` \| null | no | `360` | Chart width. |
| `height` | number `>0` \| null | no | `200` | Chart height. |
| `colors` | colorRamp \| null | no | `color.chart` | Categorical fill ramp. |
| `barColor` | colorValue \| null | no | — | Single fill for every bar. |
| `barRatio` | number `>0` and `<=1` \| null | no | `0.62` | Fraction of each band the bar occupies. |
| `barRadius` | number `>=0` \| null | no | — | Bar corner radius. |
| `showGrid` | boolean \| null | no | `true` | Horizontal gridlines. |
| `showAxisLabels` | boolean \| null | no | `true` | Per-bar x labels. |
| `showValueLabels` | boolean \| null | no | `true` | Y-axis tick labels. |
| `gridColor` | colorValue \| null | no | `color.border` | Gridline color. |
| `axisColor` | colorValue \| null | no | — | Axis color. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |

**Example:**

```json
{
  "type": "BarChart",
  "props": {
    "data": [
      { "label": "Mon", "value": 42 },
      { "label": "Tue", "value": 58 },
      { "label": "Wed", "value": 35 },
      { "label": "Thu", "value": 71 },
      { "label": "Fri", "value": 64 }
    ],
    "colors": { "$theme": "color.chart" },
    "gridColor": { "$theme": "color.border" },
    "labelColor": { "$theme": "color.mutedForeground" }
  },
  "children": []
}
```

---

### LineChart

One or more line series over a shared axis.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `series` | `{ name?, data, color? }[]` (min 1) | no* | — | Multi-series input. |
| `data` | seriesPoint[] (min 1) | no* | — | Single-series shorthand. |
| `width` | number `>0` \| null | no | — | Chart width. |
| `height` | number `>0` \| null | no | — | Chart height. |
| `colors` | colorRamp \| null | no | `color.chart` | Per-series stroke ramp. |
| `strokeWidth` | number `>0` \| null | no | `2` | Line thickness. |
| `smooth` | boolean \| null | no | `false` | Bézier smoothing. |
| `showPoints` | boolean \| null | no | `false` | Draw point dots. |
| `showArea` | boolean \| null | no | `false` | Fill area under a single line. |
| `axisLabels` | string[] \| null | no | — | X-axis labels. |
| `showGrid` | boolean \| null | no | — | Horizontal gridlines. |
| `showAxisLabels` | boolean \| null | no | — | X-axis labels toggle. |
| `showValueLabels` | boolean \| null | no | — | Y-axis tick labels toggle. |
| `gridColor` | colorValue \| null | no | `color.border` | Gridline color. |
| `axisColor` | colorValue \| null | no | — | Axis color. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |

`*` Provide either `series` or `data`, not neither.

**Example:**

```json
{
  "type": "LineChart",
  "props": {
    "series": [
      { "name": "This week", "data": [12, 19, 15, 27, 24, 33, 30] },
      { "name": "Last week", "data": [10, 14, 13, 18, 20, 22, 21] }
    ],
    "axisLabels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "smooth": true,
    "showPoints": true,
    "colors": { "$theme": "color.chart" },
    "gridColor": { "$theme": "color.border" },
    "labelColor": { "$theme": "color.mutedForeground" }
  },
  "children": []
}
```

---

### Sparkline

Compact, axis-less mini line for inline use.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | seriesPoint[] (min 2) | yes | — | Numeric or `{ value }` points. |
| `width` | number `>0` \| null | no | `120` | Chart width. |
| `height` | number `>0` \| null | no | `32` | Chart height. |
| `color` | colorValue \| null | no | `color.accent.bg` | Line color. |
| `strokeWidth` | number `>0` \| null | no | — | Line thickness. |
| `smooth` | boolean \| null | no | — | Bézier smoothing. |
| `showArea` | boolean \| null | no | `true` | Fill translucent area under the line. |
| `areaColor` | colorValue \| null | no | — | Override area fill. |
| `showEndDot` | boolean \| null | no | `true` | Draw a dot at the final point. |
| `endDotColor` | colorValue \| null | no | — | Override end dot color. |

**Example:**

```json
{
  "type": "Sparkline",
  "props": {
    "data": [4, 6, 5, 8, 7, 11, 9, 13],
    "width": 120,
    "height": 32,
    "color": { "$theme": "color.accent.bg" },
    "smooth": true
  },
  "children": []
}
```

---

### PieChart

Pie or donut chart from proportional slices.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `{ label?, value, color? }[]` (min 1) | yes | — | Slice values. |
| `size` | number `>0` \| null | no | `200` | Overall square size. |
| `innerRadius` | number `>=0` \| null | no | — | Hole radius; `0` = full pie. |
| `donut` | boolean \| null | no | — | Shorthand to make a donut. |
| `colors` | colorRamp \| null | no | `color.chart` | Categorical fill ramp. |
| `padAngle` | number `>=0` \| null | no | — | Gap between slices in px. |
| `backgroundColor` | colorValue \| null | no | — | Color painted behind slice gaps. |
| `centerLabel` | string \| null | no | — | Big text in a donut hole. |
| `centerValue` | string \| null | no | — | Small caption under the label. |
| `centerLabelColor` | colorValue \| null | no | `color.foreground` | Label color. |
| `centerValueColor` | colorValue \| null | no | `color.mutedForeground` | Caption color. |

**Example:**

```json
{
  "type": "PieChart",
  "props": {
    "data": [
      { "label": "Compute", "value": 45 },
      { "label": "Storage", "value": 30 },
      { "label": "Network", "value": 25 }
    ],
    "donut": true,
    "colors": { "$theme": "color.chart" },
    "backgroundColor": { "$theme": "color.surface" }
  },
  "children": []
}
```

---

### ProgressRing

Circular progress indicator / gauge.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | number | yes | — | Current value. |
| `max` | number `>0` \| null | no | `100` | Denominator. |
| `size` | number `>0` \| null | no | `160` | Overall square size. |
| `thickness` | number `>0` \| null | no | proportion of `size` | Ring stroke thickness. |
| `trackColor` | colorValue \| null | no | `color.surfaceMuted` | Unfilled ring color. |
| `fillColor` | colorValue \| null | no | `color.accent.bg` | Fill arc color. |
| `rounded` | boolean \| null | no | `true` | Round arc ends. |
| `startAngle` | number \| null | no | `0` | Start angle in degrees (`0` = top). |
| `label` | string \| null | no | — | Big centered readout. |
| `showValue` | boolean \| null | no | `false` | Auto-show computed percentage. |
| `sublabel` | string \| null | no | — | Small caption under label. |
| `labelColor` | colorValue \| null | no | `color.foreground` | Label color. |
| `sublabelColor` | colorValue \| null | no | `color.mutedForeground` | Sublabel color. |

**Example:**

```json
{
  "type": "ProgressRing",
  "props": {
    "value": 99.98,
    "max": 100,
    "size": 200,
    "label": "99.98%",
    "sublabel": "30-day uptime",
    "trackColor": { "$theme": "color.surfaceMuted" },
    "fillColor": { "$theme": "color.success.bg" }
  },
  "children": []
}
```

---

### Metric

Compact stat / KPI card with hero value, label, optional delta chip, and optional inline sparkline.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | string \| number | yes | — | Hero readout. |
| `label` | string | yes | — | Metric name. |
| `caption` | string \| null | no | — | Secondary line. |
| `delta` | `{ value, direction?, intent?, color?, showArrow? }` \| null | no | — | Change chip. |
| `sparkline` | Sparkline props \| null | no | — | Inline trend chart. |
| `sparklinePosition` | `"below" \| "right"` \| null | no | `"below"` | Sparkline placement. |
| `plain` | boolean \| null | no | `false` | Drop the card surface. |
| `icon` | string \| null | no | — | Small glyph beside the label. |
| `backgroundColor` | colorValue \| null | no | `color.surface` | Card fill. |
| `borderColor` | colorValue \| null | no | `color.border` | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderRadius` | themeableNumber \| null | no | — | Corner radius. |
| `padding` | themeableNumber \| null | no | — | Inner padding. |
| `elevation` | themeableString \| null | no | — | Box shadow. |
| `valueColor` | colorValue \| null | no | `color.foreground` | Hero value color. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |
| `captionColor` | colorValue \| null | no | `color.subtleForeground` | Caption color. |
| `positiveColor` | colorValue \| null | no | `color.success.bg` | Positive delta color. |
| `negativeColor` | colorValue \| null | no | `color.danger.bg` | Negative delta color. |
| `neutralColor` | colorValue \| null | no | — | Neutral delta color. |
| `valueFontSize` | number `>0` \| null | no | `fontSize.display` | Hero value size. |
| `labelFontSize` | number `>0` \| null | no | — | Label size. |
| `width` | number \| string \| null | no | — | Card width. |
| `flex` | number \| null | no | — | Flex grow factor. |

The `delta` object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | Display string (e.g. `"12.4%"`). |
| `direction` | `"up" \| "down" \| "flat"` \| null | no | Arrow direction; inferred from leading sign if omitted. |
| `intent` | `"positive" \| "negative" \| "neutral"` \| null | no | Force color semantics (use `"positive"` for down-is-good metrics). |
| `color` | colorValue \| null | no | Explicit override. |
| `showArrow` | boolean \| null | no | `true` | Show the arrow glyph. |

**Example:**

```json
{
  "type": "Metric",
  "props": {
    "label": "Monthly Revenue",
    "value": "$48.2k",
    "caption": "vs. last month",
    "delta": { "value": "12.4%", "direction": "up" },
    "sparkline": {
      "data": [30, 34, 32, 38, 40, 44, 48],
      "height": 40,
      "smooth": true,
      "color": { "$theme": "color.success.bg" }
    },
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" },
    "elevation": { "$theme": "elevation.sm" }
  },
  "children": []
}
```

---

## Design tokens

Tokens are the single source of truth for spacing, type, radii, elevation, and color. Reference them with `{ $theme: "<path>" }`.

### Color tokens (`color.*`)

Available under both `light` and `dark` palettes:

- `color.background`
- `color.surface`
- `color.surfaceMuted`
- `color.foreground`
- `color.mutedForeground`
- `color.subtleForeground`
- `color.border`
- `color.borderStrong`
- `color.accent.bg`, `color.accent.fg`, `color.accent.subtle`, `color.accent.border`
- `color.neutral.bg`, `color.neutral.fg`, `color.neutral.subtle`, `color.neutral.border`
- `color.danger.bg`, `color.danger.fg`, `color.danger.subtle`, `color.danger.border`
- `color.success.bg`, `color.success.fg`, `color.success.subtle`, `color.success.border`
- `color.warning.bg`, `color.warning.fg`, `color.warning.subtle`, `color.warning.border`
- `color.info.bg`, `color.info.fg`, `color.info.subtle`, `color.info.border`
- `color.chart` — categorical ramp array

### Non-color tokens

| Namespace | Example paths | Notes |
|-----------|---------------|-------|
| `spacing` | `spacing.4` → `16` | 4px base unit. |
| `fontSize` | `fontSize.h1`, `fontSize.display` | Body is `base` = 16. |
| `fontWeight` | `fontWeight.bold` → `700` | Numeric weights. |
| `lineHeight` | `lineHeight.tight`, `lineHeight.normal` | Unitless ratios. |
| `letterSpacing` | `letterSpacing.tight` → `"-0.02em"` | CSS string. |
| `radius` | `radius.md` → `6`, `radius.lg` → `8`, `radius.full` → `9999` | px values. |
| `elevation` | `elevation.sm`, `elevation.md`, `elevation.lg`, `elevation.xl` | Theme-scoped shadow strings. |

---

## Complete example specs

### Example 1 — Simple greeting card

A minimal, theme-aware greeting card. Good first render.

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 640, "height": 360, "padding": 32, "backgroundColor": { "$theme": "color.background" } },
      "children": ["card"]
    },
    "card": {
      "type": "Box",
      "props": {
        "padding": 32,
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "borderWidth": 1,
        "borderRadius": 16,
        "alignItems": "center",
        "justifyContent": "center"
      },
      "children": ["stack"]
    },
    "stack": {
      "type": "Stack",
      "props": { "gap": 12, "alignItems": "center" },
      "children": ["title", "subtitle"]
    },
    "title": {
      "type": "Heading",
      "props": { "text": "Hello, Agent", "level": "h2", "color": { "$theme": "color.foreground" } },
      "children": []
    },
    "subtitle": {
      "type": "Text",
      "props": { "text": "Your first render worked.", "fontSize": 16, "color": { "$theme": "color.mutedForeground" } },
      "children": []
    }
  }
}
```

Tool call:

```json
{
  "name": "render_ui",
  "arguments": {
    "spec": { ... },
    "theme": "light",
    "scale": 2
  }
}
```

Result: a 1280x720 PNG (640x360 logical at 2x) with a centered card, heading, and subtitle.

---

### Example 2 — Metric cards row

A row of four KPI metric cards with inline sparklines.

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 1200, "height": 220, "padding": 24, "backgroundColor": { "$theme": "color.background" } },
      "children": ["row"]
    },
    "row": {
      "type": "Row",
      "props": { "gap": 16 },
      "children": ["m1", "m2", "m3", "m4"]
    },
    "m1": {
      "type": "Metric",
      "props": {
        "label": "Revenue",
        "value": "$48.2k",
        "caption": "vs. last month",
        "delta": { "value": "12.4%", "direction": "up" },
        "sparkline": { "data": [30, 34, 32, 38, 40, 44, 48], "smooth": true },
        "flex": 1,
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "elevation": { "$theme": "elevation.sm" }
      },
      "children": []
    },
    "m2": {
      "type": "Metric",
      "props": {
        "label": "Active Users",
        "value": "18,430",
        "caption": "7-day rolling",
        "delta": { "value": "8.1%", "direction": "up" },
        "sparkline": { "data": [12, 13, 15, 14, 16, 17, 18], "smooth": true },
        "flex": 1,
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "elevation": { "$theme": "elevation.sm" }
      },
      "children": []
    },
    "m3": {
      "type": "Metric",
      "props": {
        "label": "p95 Latency",
        "value": "142ms",
        "caption": "down is better",
        "delta": { "value": "6.3%", "direction": "down", "intent": "positive" },
        "sparkline": { "data": [188, 176, 181, 165, 158, 149, 142], "smooth": true },
        "flex": 1,
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "elevation": { "$theme": "elevation.sm" }
      },
      "children": []
    },
    "m4": {
      "type": "Metric",
      "props": {
        "label": "Error Rate",
        "value": "0.38%",
        "caption": "vs. 0.29% last week",
        "delta": { "value": "0.09pp", "direction": "up", "intent": "negative" },
        "sparkline": { "data": [0.22, 0.25, 0.24, 0.28, 0.31, 0.35, 0.38], "smooth": true },
        "flex": 1,
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "elevation": { "$theme": "elevation.sm" }
      },
      "children": []
    }
  }
}
```

Result: a single-row dashboard of four equally-sized metric cards.

---

### Example 3 — Full dashboard

A complete 1200x1020 dashboard with header, metric grid, line chart, progress ring, table, progress bars, and an alert. This spec is the checked-in `examples/dashboard.json`.

**Tool call:**

```json
{
  "name": "render_ui",
  "arguments": {
    "spec": { /* full examples/dashboard.json content */ },
    "theme": "dark",
    "scale": 2
  }
}
```

**Result:** a 2400x2040 PNG showing a dark-themed platform overview dashboard.

The full JSON is large; reference `examples/dashboard.json` in the repo. It combines:

- `Frame` with `flexDirection: "column"`
- header `Row` with `Heading`, `Text`, and `Badge`
- 4-column `Grid` of `Metric` cards
- two side-by-side `Box` panels: one with a `LineChart`, one with a `ProgressRing`
- a `Table` of service health
- two `Progress` bars and an `Alert`

This spec has been validated against the live server and renders cleanly.

---

## Themes: light vs dark

Set `theme` to `"light"` or `"dark"` on the `render_ui` call. The same spec produces two visually distinct images because `$theme` color references resolve to different literal palettes.

### Example

```json
{ "name": "render_ui", "arguments": { "spec": { ... }, "theme": "light" } }
{ "name": "render_ui", "arguments": { "spec": { ... }, "theme": "dark" } }
```

- **Light:** near-white canvas (`#ffffff`), dark text, soft shadows.
- **Dark:** deep zinc canvas (`#09090b`), light text, deeper shadows.

Use `theme` even when a spec hardcodes some colors; the token-driven surfaces and foregrounds will still switch.

---

## Output defaults

| Property | Default | Notes |
|----------|---------|-------|
| Logical dimensions | `1200 x 630` | Overridden by root `Frame` width/height. |
| Physical dimensions | `2400 x 1260` | Because default scale is 2. |
| Scale | `2` | Crisp on mobile / chat previews. |
| Format | PNG | base64 + `image/png` content block. |
| Temp file | `/tmp/jsonui-render-mcp/jsonui-render-<timestamp>.png` | Adjacent text block returns the path. |
| Aspect ratio | ~1.9:1 | Chat-gateway friendly. |

To change dimensions, either set `width`/`height` on the root `Frame` or pass `width`/`height` to `render_ui`. To change density, pass `scale`.

---

## Error contract

All errors return a structured JSON text block with `isError: true`:

```json
{
  "code": "VALIDATION_ERROR",
  "path": ".elements.frame.props.height",
  "message": "Required"
}
```

- `code` — either `VALIDATION_ERROR` (schema / limit / graph issue) or `RENDER_ERROR` (unexpected render failure).
- `path` — dotted path to the offending value (e.g. `.elements.foo.props.bar`, `.root`, `.elements.foo.children[2]`).
- `message` — human-readable reason.

The server process stays alive on every error; no uncaught exceptions reach the MCP client.

### Example error response

For a spec missing the required `Frame.height`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"code\":\"VALIDATION_ERROR\",\"path\":\".elements.frame.props.height\",\"message\":\"Required\"}"
    }
  ],
  "isError": true
}
```

---

## Resource limits

Untrusted specs are bounded in `src/catalog/validate.ts`:

| Limit | Value | What it guards |
|-------|-------|----------------|
| `maxElements` | 2,000 | Total element count in `elements`. |
| `maxTreeDepth` | 50 | Depth of the element reference graph. |
| `maxStringLength` | 10,000 characters | Any string prop value. |
| `maxArrayLength` | 1,000 entries | Any array in the spec. |
| `maxChartPoints` | 1,000 points | Per chart series / bar data array / sparkline data array. |

Violating any limit returns a `VALIDATION_ERROR` with a path pointing at the oversized value.

---

## Known limitations

Two caveats to keep in mind when building specs:

1. **Charts inside `Card` regions can render incorrectly.** A concurrent debugging task found a flex-sizing bug when chart components (`BarChart`, `LineChart`, `Sparkline`, `PieChart`, `ProgressRing`, `Metric`) are nested inside `Card` header/body/footer regions. Until the fix lands, **prefer placing charts in `Box` containers** rather than inside `Card`.

2. **Emoji and pictographic Unicode may render as missing-glyph boxes.** Only a standard text font is bundled; there is no emoji font. Avoid emoji characters in `Text` and `Heading` content. Use the catalog's own components (e.g. `Badge` for status labels, `Alert` for callouts, colored `Text`, or `Metric.delta`) instead of emoji indicators.

---

## Quick workflow for agents

1. Call `list_components` to confirm the catalog.
2. Build a spec with a `Frame` root, flat `elements` map, and keyed `children` arrays.
3. Prefer `$theme` references over hardcoded colors.
4. Call `render_ui` with `theme: "light"` or `theme: "dark"` and `scale: 2`.
5. If validation fails, read the `code`, `path`, and `message`, fix the spec, and retry.
6. On success, the first content block is the base64 PNG; the second is the temp-file path.

---

## See also

- `AGENTS.md` — guidance for agents working **on** this repo's code.
- `README.md` — project overview, installation, and registration for end users.
- `examples/dashboard.json` — a full, render-validated dashboard spec.
