# SKILL.md — Using the JSON-UI Render MCP Server

A complete capability and usage reference for AI agents that already have the `jsonui-render-agent-mcp` server available and want to render dashboards, cards, charts, and metrics as PNG images.

For guidance on modifying the server code itself, see `AGENTS.md`.

## What this server does

`jsonui-render-agent-mcp` renders a JSON UI spec to a crisp PNG image through a browserless Satori + resvg-js pipeline. An agent calls the `render_ui` tool, supplies a structured spec, and gets back an MCP `image` content block (base64-encoded PNG) plus a text block with the on-disk temp path.

Use it when you want shareable, good-looking UI images for chat gateways or any context where a static raster is better than raw text or a live page.

---

## Tools

### `ping`

Simple health check.

**Input:** none (empty object).

**Output:** a text content block containing `pong`.

```json
{
  "name": "ping",
  "arguments": {}
}
```

Response:

```json
{
  "content": [{ "type": "text", "text": "pong" }]
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
    }
  ]
}
```

Call this before composing a complex spec to inspect exact prop schemas. The v1 catalog is fixed at 23 components (the 22 originals plus the new `Icon` component).

```json
{
  "name": "list_components",
  "arguments": {}
}
```

---

### `render_ui`

The main tool. Validates and renders a JSON UI spec to PNG.

**Input parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `spec` | object | yes | — | JSON UI spec. |
| `theme` | `"light" \| "dark"` | no | `"light"` | Visual theme. |
| `width` | positive number | no | root Frame width or `1200` | Override logical width. |
| `height` | positive number | no | root Frame height or `630` | Override logical height. |
| `scale` | number `>= 1` | no | `2` | PNG density multiplier. |
| `autoSize` | boolean | no | `false` | When true, the Frame height may be omitted and the canvas is sized to fit the rendered content (see Auto-sizing). |

**Output on success:**

```json
{
  "content": [
    { "type": "image", "data": "<base64 PNG>", "mimeType": "image/png" },
    { "type": "text", "text": "PNG written to: /tmp/jsonui-render-mcp/jsonui-render-....png" }
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
          "props": { "text": "Rendered from a JSON spec.", "fontSize": 16 },
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

A spec is a flat keyed tree:

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

- `root` is the key of the top-level element and must be a `Frame`.
- `elements` is a map of `key → { type, props, children? }`.
- `children` is an array of element keys, in render order.
- Component regions (e.g. `Card.header`/`Card.footer`) also use arrays of element keys, but live inside `props`.

### `$theme` references

Many props accept either a literal value or a token reference:

```json
{ "$theme": "color.surface" }
{ "$theme": "spacing.4" }
{ "$theme": "elevation.md" }
{ "$theme": "radius.lg" }
{ "$theme": "color.chart" }
```

These resolve to literal values before rendering, so specs stay theme-agnostic.

---

## Component catalog

The v1 catalog has **23 components**:

- **Layout:** Frame, Box, Stack, Row, Grid, Spacer, Divider
- **Content:** Text, Heading, Badge, Avatar, Alert, List
- **Composite:** Card, Table, Progress
- **Charts / metrics:** BarChart, LineChart, Sparkline, PieChart, ProgressRing, Metric
- **Icon:** Icon

`colorValue` means `string | { $theme: string }`. `themeableNumber` means `number | { $theme: string }`. `themeableString` means `string | { $theme: string }`.

### Frame

Root image container. Must be the root element.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `width` | number | yes | — | Canvas width in px. |
| `height` | number | yes* | — | Canvas height in px. May be omitted when `autoSize: true`. |
| `backgroundColor` | colorValue | no | `color.background` | Canvas fill. |
| `padding` | number \| null | no | — | Inner padding. |
| `display` | `"flex" \| "none"` \| null | no | — | Display mode. |
| `flexDirection` | `"row" \| "column"` \| null | no | — | Main axis. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |

**Examples:**

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

Auto-sized Frame:

```json
{
  "type": "Frame",
  "props": {
    "width": 640,
    "padding": 24,
    "backgroundColor": { "$theme": "color.background" }
  },
  "children": ["stack"]
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
| `backgroundColor` | colorValue \| null | no | — | Fill. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderColor` | colorValue \| null | no | — | Border color. |
| `borderRadius` | number \| null | no | `radius.md` | Corner radius. |
| `flex` | number \| null | no | — | Flex grow. |
| `width` | number \| string \| null | no | — | Fixed or relative width. |
| `height` | number \| string \| null | no | — | Fixed or relative height. |
| `alignItems` | align enum \| null | no | — | Cross-axis alignment. |
| `justifyContent` | justify enum \| null | no | — | Main-axis distribution. |
| `flexDirection` | `"row" \| "column"` \| null | no | — | Children axis. |
| `position` | `"relative" \| "absolute"` \| null | no | — | Positioning mode. |
| `top` / `left` / `right` / `bottom` | number \| null | no | — | Absolute offsets. |
| `overflow` | `"visible" \| "hidden"` \| null | no | — | Clipping. |

**Examples:**

Card-like panel:

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

Absolutely positioned badge:

```json
{
  "type": "Box",
  "props": {
    "position": "absolute",
    "top": 12,
    "right": 12,
    "backgroundColor": { "$theme": "color.success.bg" },
    "padding": 6,
    "borderRadius": 9999
  },
  "children": ["statusDot"]
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
| `flex` | number \| null | no | — | Flex grow. |

**Examples:**

Default vertical stack:

```json
{
  "type": "Stack",
  "props": { "gap": 12, "padding": 16 },
  "children": ["heading", "text", "badgeRow"]
}
```

Centered empty-state stack:

```json
{
  "type": "Stack",
  "props": { "gap": 16, "alignItems": "center", "justifyContent": "center", "padding": 40 },
  "children": ["emptyIcon", "emptyTitle", "emptyText"]
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
| `flex` | number \| null | no | — | Flex grow. |
| `wrap` | boolean \| null | no | — | Allow children to wrap. |

**Examples:**

Header row:

```json
{
  "type": "Row",
  "props": { "gap": 12, "alignItems": "center", "justifyContent": "space-between" },
  "children": ["title", "badge"]
}
```

Wrapped tag row:

```json
{
  "type": "Row",
  "props": { "gap": 8, "wrap": true },
  "children": ["tag1", "tag2", "tag3", "tag4"]
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
| `flex` | number \| null | no | — | Flex grow. |

**Examples:**

4-column metric grid:

```json
{
  "type": "Grid",
  "props": { "columns": 4, "gap": 16 },
  "children": ["m1", "m2", "m3", "m4"]
}
```

3-column feature grid:

```json
{
  "type": "Grid",
  "props": { "columns": 3, "gap": 20, "padding": 16 },
  "children": ["featureA", "featureB", "featureC", "featureD", "featureE", "featureF"]
}
```

---

### Spacer

Empty sizing element.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `size` | number `>= 0` \| null | no | — | Fixed width/height in px. |
| `grow` | boolean \| null | no | — | Expands as `flex: 1`. |

**Examples:**

```json
{ "type": "Spacer", "props": { "size": 24 }, "children": [] }
```

```json
{ "type": "Spacer", "props": { "grow": true }, "children": [] }
```

---

### Divider

Thin separator line.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `orientation` | `"horizontal" \| "vertical"` \| null | no | — | Line axis. |
| `color` | colorValue \| null | no | `color.border` | Line color. |
| `thickness` | number `> 0` \| null | no | `1` | Thickness. |
| `length` | number \| string \| null | no | `"100%"` | Length along main axis. |
| `margin` | number \| null | no | — | Margin around the line. |

**Examples:**

```json
{
  "type": "Divider",
  "props": { "orientation": "horizontal", "color": { "$theme": "color.border" }, "margin": 8 },
  "children": []
}
```

```json
{
  "type": "Divider",
  "props": { "orientation": "vertical", "length": 24, "color": { "$theme": "color.borderStrong" } },
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

**Examples:**

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

```json
{
  "type": "Text",
  "props": {
    "text": "Last updated: just now",
    "fontSize": 12,
    "fontStyle": "italic",
    "color": { "$theme": "color.subtleForeground" }
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
| `level` | `"h1" \| "h2" \| "h3" \| "h4"` \| null | no | — | Size level. `h1` is largest. |
| `color` | colorValue \| null | no | `color.foreground` | Text color. |
| `align` | `"left" \| "center" \| "right"` \| null | no | — | Horizontal alignment. |
| `letterSpacing` | number \| string \| null | no | — | Tracking. |
| `lineHeight` | number \| null | no | — | Line height ratio. |

**Examples:**

```json
{
  "type": "Heading",
  "props": { "text": "Platform Overview", "level": "h2", "letterSpacing": "-0.02em" },
  "children": []
}
```

```json
{
  "type": "Heading",
  "props": { "text": "Monthly report", "level": "h3", "color": { "$theme": "color.accent.bg" } },
  "children": []
}
```

---

### Icon

A single HugeIcons free-tier vector icon. Renders as inline SVG — no font, no CDN.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | yes | — | Kebab-case icon name. |
| `size` | themeableNumber \| null | no | `24` | Square size in px. |
| `color` | colorValue \| null | no | `color.foreground` | Stroke/fill color. |
| `strokeWidth` | number `> 0` \| null | no | `1.5` | Line weight. |

**Examples:**

```json
{
  "type": "Icon",
  "props": { "name": "search", "size": 24, "color": { "$theme": "color.foreground" } },
  "children": []
}
```

```json
{
  "type": "Icon",
  "props": { "name": "notification-03", "size": 20, "color": { "$theme": "color.warning.bg" }, "strokeWidth": 2 },
  "children": []
}
```

```json
{
  "type": "Icon",
  "props": { "name": "arrow-right-01", "size": 16, "color": { "$theme": "color.mutedForeground" } },
  "children": []
}
```

The full icon reference is below.

---

### Badge

Small inline pill label.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Label text. |
| `variant` | status enum \| null | no | — | Intent hint. |
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
| `iconName` | iconSlot \| null | no | — | Optional HugeIcons icon (string name or `{ name, color?, size?, strokeWidth? }`). |

**Examples:**

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

With a leading icon:

```json
{
  "type": "Badge",
  "props": {
    "text": "Live",
    "variant": "success",
    "backgroundColor": { "$theme": "color.success.subtle" },
    "color": { "$theme": "color.success.bg" },
    "iconName": "checkmark-circle-02"
  },
  "children": []
}
```

With an icon object for overrides:

```json
{
  "type": "Badge",
  "props": {
    "text": "New",
    "backgroundColor": { "$theme": "color.accent.subtle" },
    "color": { "$theme": "color.accent.bg" },
    "iconName": { "name": "sparkles", "size": 14, "color": { "$theme": "color.accent.bg" } }
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
| `size` | number \| null | no | — | Disc size. |
| `shape` | `"circle" \| "rounded" \| "square"` \| null | no | — | Shape. |
| `backgroundColor` | colorValue \| null | no | `color.accent.bg` | Disc fill. |
| `color` | colorValue \| null | no | `color.accent.fg` | Initials color. |
| `borderColor` | colorValue \| null | no | — | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `fontSize` | number \| null | no | — | Initials font size. |
| `fontWeight` | enum \| null | no | — | Initials weight. |

**Examples:**

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

```json
{
  "type": "Avatar",
  "props": {
    "mode": "image",
    "src": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "size": 48,
    "shape": "rounded"
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
| `variant` | enum \| null | no | — | Intent. |
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
| `iconName` | iconSlot \| null | no | — | Optional HugeIcons icon. |

**Examples:**

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
    "accentColor": { "$theme": "color.warning.bg" },
    "showAccentBar": true
  },
  "children": []
}
```

With an icon:

```json
{
  "type": "Alert",
  "props": {
    "title": "Payment received",
    "text": "$48.2k has been deposited.",
    "variant": "success",
    "backgroundColor": { "$theme": "color.success.subtle" },
    "borderColor": { "$theme": "color.success.border" },
    "titleColor": { "$theme": "color.success.bg" },
    "iconName": "checkmark-circle-02"
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

**Examples:**

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

```json
{
  "type": "List",
  "props": {
    "marker": "number",
    "gap": 6,
    "items": [
      "Connect data source",
      "Configure sync schedule",
      "Verify schema"
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
| `header` | string[] \| null | no | — | Element keys rendered in the header. |
| `footer` | string[] \| null | no | — | Element keys rendered in the footer. |
| `backgroundColor` | colorValue \| null | no | `color.surface` | Card fill. |
| `borderColor` | colorValue \| null | no | `color.border` | Border color. |
| `borderWidth` | number \| null | no | — | Border thickness. |
| `borderRadius` | themeableNumber \| null | no | `radius.lg` | Corner radius. |
| `padding` | themeableNumber \| null | no | — | Inner padding. |
| `gap` | themeableNumber \| null | no | — | Space between body children. |
| `elevation` | themeableString \| null | no | — | Box shadow. |
| `dividerColor` | colorValue \| null | no | — | Separator between header/body/footer. |
| `width` | number \| string \| null | no | — | Fixed or relative width. |
| `flex` | number \| null | no | — | Flex grow. |

**Examples:**

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

```json
{
  "type": "Card",
  "props": {
    "padding": { "$theme": "spacing.6" },
    "gap": { "$theme": "spacing.4" },
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" },
    "borderRadius": { "$theme": "radius.lg" }
  },
  "children": ["heading", "bodyText", "badge"]
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

**Examples:**

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

```json
{
  "type": "Table",
  "props": {
    "header": [
      { "text": "Region", "align": "left" },
      { "text": "Latency", "align": "right" },
      { "text": "Errors", "align": "right" }
    ],
    "rows": [
      [{ "text": "us-east" }, { "text": "24ms", "align": "right" }, { "text": "0.01%", "align": "right" }],
      [{ "text": "eu-west" }, { "text": "38ms", "align": "right" }, { "text": "0.02%", "align": "right" }]
    ],
    "rowBorders": true,
    "cellPaddingX": 16,
    "cellPaddingY": 8
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
| `max` | number `> 0` \| null | no | `100` | Denominator. |
| `trackColor` | colorValue \| null | no | `color.surfaceMuted` | Unfilled track. |
| `fillColor` | colorValue \| null | no | `color.accent.bg` | Fill. |
| `height` | number `> 0` \| null | no | `8` | Bar height. |
| `radius` | number `>= 0` \| null | no | `height / 2` | Corner radius. |
| `label` | string \| null | no | — | Caption above the bar. |
| `showValue` | boolean \| null | no | `false` | Show percentage. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |
| `fontSize` | number \| null | no | — | Label size. |
| `width` | number \| string \| null | no | — | Bar width. |

**Examples:**

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

```json
{
  "type": "Progress",
  "props": {
    "value": 4_200,
    "max": 10_000,
    "showValue": true,
    "fillColor": { "$theme": "color.success.bg" },
    "trackColor": { "$theme": "color.surfaceMuted" },
    "height": 12,
    "radius": 6
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
| `width` | number `> 0` \| null | no | `360` | Chart width. |
| `height` | number `> 0` \| null | no | `200` | Chart height. |
| `colors` | colorRamp \| null | no | `color.chart` | Categorical fill ramp. |
| `barColor` | colorValue \| null | no | — | Single fill for every bar. |
| `barRatio` | number `> 0` and `<= 1` \| null | no | `0.62` | Fraction of each band the bar occupies. |
| `barRadius` | number `>= 0` \| null | no | — | Bar corner radius. |
| `showGrid` | boolean \| null | no | `true` | Horizontal gridlines. |
| `showAxisLabels` | boolean \| null | no | `true` | Per-bar x labels. |
| `showValueLabels` | boolean \| null | no | `true` | Y-axis tick labels. |
| `gridColor` | colorValue \| null | no | `color.border` | Gridline color. |
| `axisColor` | colorValue \| null | no | — | Axis color. |
| `labelColor` | colorValue \| null | no | `color.mutedForeground` | Label color. |

**Examples:**

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

Single-color wide bars without Y labels:

```json
{
  "type": "BarChart",
  "props": {
    "data": [
      { "label": "Q1", "value": 120 },
      { "label": "Q2", "value": 190 },
      { "label": "Q3", "value": 150 },
      { "label": "Q4", "value": 270 }
    ],
    "barColor": { "$theme": "color.accent.bg" },
    "barRatio": 0.75,
    "showValueLabels": false,
    "gridColor": { "$theme": "color.border" }
  },
  "children": []
}
```

Large-value data with labels:

```json
{
  "type": "BarChart",
  "props": {
    "data": [
      { "label": "Jan", "value": 42000 },
      { "label": "Feb", "value": 58000 },
      { "label": "Mar", "value": 35000 },
      { "label": "Apr", "value": 71000 },
      { "label": "May", "value": 64000 }
    ],
    "width": 520,
    "height": 260,
    "colors": { "$theme": "color.chart" },
    "showGrid": true,
    "showValueLabels": true
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
| `width` | number `> 0` \| null | no | — | Chart width. |
| `height` | number `> 0` \| null | no | — | Chart height. |
| `colors` | colorRamp \| null | no | `color.chart` | Per-series stroke ramp. |
| `strokeWidth` | number `> 0` \| null | no | `2` | Line thickness. |
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

**Examples:**

Multi-series smooth line chart:

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

Single-series area chart:

```json
{
  "type": "LineChart",
  "props": {
    "data": [12, 19, 15, 27, 24, 33, 30],
    "smooth": true,
    "showArea": true,
    "axisLabels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "width": 520,
    "height": 220,
    "gridColor": { "$theme": "color.border" }
  },
  "children": []
}
```

Sparse high-value series:

```json
{
  "type": "LineChart",
  "props": {
    "series": [
      { "name": "Revenue", "data": [120, 145, 138, 190, 210, 245, 230] },
      { "name": "Costs", "data": [80, 92, 88, 110, 115, 130, 125] }
    ],
    "axisLabels": ["M", "T", "W", "T", "F", "S", "S"],
    "smooth": false,
    "showPoints": true,
    "width": 540,
    "height": 240,
    "colors": { "$theme": "color.chart" }
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
| `width` | number `> 0` \| null | no | `120` | Chart width. |
| `height` | number `> 0` \| null | no | `32` | Chart height. |
| `color` | colorValue \| null | no | `color.accent.bg` | Line color. |
| `strokeWidth` | number `> 0` \| null | no | — | Line thickness. |
| `smooth` | boolean \| null | no | — | Bézier smoothing. |
| `showArea` | boolean \| null | no | `true` | Fill translucent area under the line. |
| `areaColor` | colorValue \| null | no | — | Override area fill. |
| `showEndDot` | boolean \| null | no | `true` | Draw a dot at the final point. |
| `endDotColor` | colorValue \| null | no | — | Override end dot color. |

**Examples:**

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

```json
{
  "type": "Sparkline",
  "props": {
    "data": [188, 176, 181, 165, 158, 149, 142],
    "width": 160,
    "height": 40,
    "color": { "$theme": "color.success.bg" },
    "showArea": true,
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
| `size` | number `> 0` \| null | no | `200` | Overall square size. |
| `innerRadius` | number `>= 0` \| null | no | — | Hole radius; `0` = full pie. |
| `donut` | boolean \| null | no | — | Shorthand to make a donut. |
| `colors` | colorRamp \| null | no | `color.chart` | Categorical fill ramp. |
| `padAngle` | number `>= 0` \| null | no | — | Gap between slices in px. |
| `backgroundColor` | colorValue \| null | no | — | Color painted behind slice gaps. |
| `centerLabel` | string \| null | no | — | Big text in a donut hole. |
| `centerValue` | string \| null | no | — | Small caption under the label. |
| `centerLabelColor` | colorValue \| null | no | `color.foreground` | Label color. |
| `centerValueColor` | colorValue \| null | no | `color.mutedForeground` | Caption color. |

**Examples:**

Donut with legend-style labels:

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

Center-label donut:

```json
{
  "type": "PieChart",
  "props": {
    "data": [
      { "value": 82 },
      { "value": 18 }
    ],
    "donut": true,
    "size": 160,
    "colors": [{ "$theme": "color.success.bg" }, { "$theme": "color.surfaceMuted" }],
    "centerLabel": "82%",
    "centerValue": "On time",
    "backgroundColor": { "$theme": "color.surface" }
  },
  "children": []
}
```

Small labeled pie:

```json
{
  "type": "PieChart",
  "props": {
    "data": [
      { "label": "Direct", "value": 40 },
      { "label": "Referral", "value": 35 },
      { "label": "Organic", "value": 25 }
    ],
    "size": 180,
    "padAngle": 2,
    "colors": { "$theme": "color.chart" },
    "backgroundColor": { "$theme": "color.background" }
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
| `max` | number `> 0` \| null | no | `100` | Denominator. |
| `size` | number `> 0` \| null | no | `160` | Overall square size. |
| `thickness` | number `> 0` \| null | no | proportion of `size` | Ring stroke thickness. |
| `trackColor` | colorValue \| null | no | `color.surfaceMuted` | Unfilled ring. |
| `fillColor` | colorValue \| null | no | `color.accent.bg` | Fill arc. |
| `rounded` | boolean \| null | no | `true` | Round arc ends. |
| `startAngle` | number \| null | no | `0` | Start angle in degrees. |
| `label` | string \| null | no | — | Big centered readout. |
| `showValue` | boolean \| null | no | `false` | Auto-show percentage. |
| `sublabel` | string \| null | no | — | Small caption under label. |
| `labelColor` | colorValue \| null | no | `color.foreground` | Label color. |
| `sublabelColor` | colorValue \| null | no | `color.mutedForeground` | Sublabel color. |

**Examples:**

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

```json
{
  "type": "ProgressRing",
  "props": {
    "value": 72,
    "max": 100,
    "size": 120,
    "thickness": 10,
    "showValue": true,
    "sublabel": "Complete",
    "trackColor": { "$theme": "color.surfaceMuted" },
    "fillColor": { "$theme": "color.accent.bg" }
  },
  "children": []
}
```

---

### Metric

Compact stat / KPI card.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | string \| number | yes | — | Hero readout. |
| `label` | string | yes | — | Metric name. |
| `caption` | string \| null | no | — | Secondary line. |
| `delta` | `{ value, direction?, intent?, color?, showArrow? }` \| null | no | — | Change chip. |
| `sparkline` | Sparkline props \| null | no | — | Inline trend chart. |
| `sparklinePosition` | `"below" \| "right"` \| null | no | `"below"` | Sparkline placement. |
| `plain` | boolean \| null | no | `false` | Drop the card surface. |
| `icon` | string \| null | no | — | Small glyph beside the label (text/emoji). |
| `iconName` | iconSlot \| null | no | — | Optional HugeIcons vector icon beside the label. |
| `backgroundColor` | colorValue \| null | no | `color.surface` | Card fill. |
| `borderColor` | colorValue \| null | no | `color.border` | Border. |
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
| `valueFontSize` | number `> 0` \| null | no | `fontSize.display` | Hero size. |
| `labelFontSize` | number `> 0` \| null | no | — | Label size. |
| `width` | number \| string \| null | no | — | Card width. |
| `flex` | number \| null | no | — | Flex grow. |

The `delta` object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | Display string. |
| `direction` | `"up" \| "down" \| "flat"` \| null | no | Arrow direction. |
| `intent` | `"positive" \| "negative" \| "neutral"` \| null | no | Force color semantics. |
| `color` | colorValue \| null | no | Explicit override. |
| `showArrow` | boolean \| null | no | `true` | Show the arrow glyph. |

**Examples:**

Standard metric with sparkline:

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
      "smooth": true
    },
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" },
    "elevation": { "$theme": "elevation.sm" }
  },
  "children": []
}
```

Metric with an icon:

```json
{
  "type": "Metric",
  "props": {
    "label": "Active Users",
    "value": "18,430",
    "caption": "7-day rolling",
    "delta": { "value": "8.1%", "direction": "up" },
    "iconName": { "name": "user-group", "size": 16, "color": { "$theme": "color.mutedForeground" } },
    "backgroundColor": { "$theme": "color.surface" },
    "borderColor": { "$theme": "color.border" }
  },
  "children": []
}
```

Plain metric (no card):

```json
{
  "type": "Metric",
  "props": {
    "label": "Error Rate",
    "value": "0.38%",
    "plain": true,
    "delta": { "value": "0.09pp", "direction": "up", "intent": "negative" },
    "sparkline": { "data": [0.22, 0.25, 0.24, 0.28, 0.31, 0.35, 0.38], "smooth": true, "color": { "$theme": "color.danger.bg" } }
  },
  "children": []
}
```

---

## Icons reference

The server includes every icon in `@hugeicons/core-free-icons` (6,158 icons in the current dependency, Stroke Rounded style). You reference an icon by a lowercase kebab-case string derived from the HugeIcons `<Name>Icon` export:

```
SearchIcon            -> "search"
Notification03Icon    -> "notification-03"
ArrowRight01Icon      -> "arrow-right-01"
UserGroupIcon         -> "user-group"
CheckmarkCircle02Icon -> "checkmark-circle-02"
Pdf01Icon             -> "pdf-01"
```

The canonical way to confirm a name is to check it with `isIconName()` from `src/catalog/icons.ts` or to call `list_components` and inspect the `Icon` schema example. Do not guess names; always verify against the actual imported set.

### Verified example names by category

The following names were verified programmatically against `isIconName()` in the current build. Each line is a runnable `Icon` name.

**Navigation / wayfinding**

- `home`, `home-01` — homepage / dashboard entry
- `dashboard-square-01`, `dashboard-circle` — dashboard nav
- `search`, `search-01` — search field
- `menu-01`, `menu-02` — menu toggle
- `sidebar-left`, `sidebar-right` — collapsible sidebars
- `layers`, `layout`, `grid-view` — layout pickers
- `navigation`, `navigation-01`, `compass`, `compass-01` — navigation
- `maps`, `maps-circle`, `map-pin`, `map-pinpoint`, `location-01` — maps / location

**Actions**

- `add-01`, `add-02` — add / create
- `minus-sign`, `multiplication-sign` — math / remove
- `check` — confirm
- `cancel-01`, `cancel-02`, `cancel-circle` — cancel / close
- `delete-01`, `delete-02` — delete
- `edit-01`, `edit-02` — edit
- `copy-01`, `copy-02`, `copy-check` — copy
- `clipboard-paste`, `clipboard-check` — clipboard actions
- `download-01`, `download-02`, `upload-01`, `upload-02` — transfer
- `refresh` — refresh
- `rotate`, `rotate-01`, `rotate-02`, `rotate-clockwise`, `rotate-360` — rotate
- `undo`, `redo` — undo / redo
- `settings-01`, `settings-02`, `cog` — settings
- `sliders-horizontal`, `sliders-vertical` — settings / filters
- `filter`, `filter-horizontal`, `filter-vertical` — filter
- `sort-by-up`, `sort-by-down`, `sorting-az`, `sorting-one-nine` — sort

**Status / alerts**

- `alert`, `alert-01`, `alert-02`, `alert-circle`, `alert-diamond`, `alert-square` — alerts
- `badge-alert`, `badge-info` — badge status
- `information-circle`, `information-square`, `help-circle`, `question` — info / help
- `checkmark-circle-01`, `checkmark-circle-02`, `checkmark-square-01`, `checkmark-square-02` — success
- `shield`, `shield-01`, `shield-02` — security / protection
- `bell`, `bell-dot`, `bell-off`, `bell-plus`, `notification-03` — notifications

**Communication**

- `mail`, `mail-01`, `mail-02` — email
- `message`, `message-01`, `message-02`, `chat`, `chat-01`, `bubble-chat` — messaging
- `call`, `call-02`, `call-incoming-01`, `call-outgoing-01` — calls
- `video`, `video-01`, `video-02` — video
- `mail-send`, `mail-reply`, `mail-reply-all`, `message-circle-reply` — send / reply
- `inbox`, `inbox-check` — inbox
- `share-01`, `share-02` — share
- `megaphone` — announcements

**Media / content**

- `image`, `image-01`, `image-02`, `camera`, `camera-01`, `camera-02` — images / photos
- `play`, `play-circle`, `pause`, `pause-circle`, `stop` — playback
- `volume-high`, `volume-low`, `volume-off`, `volume-up` — volume
- `music-note`, `music-note-01` — music
- `mic`, `mic-01`, `mic-02` — microphone
- `film` — video content

**Commerce / finance**

- `shopping-cart`, `shopping-bag-01`, `shopping-bag-02`, `store`, `store-01` — shopping
- `tag`, `tag-01`, `tag-02`, `hot-price` — tags / pricing
- `receipt-text` — receipts
- `credit-card`, `credit-card-accept`, `credit-card-add` — cards
- `wallet`, `wallet-01` — wallet
- `bank`, `banknote` — banking
- `coins`, `coins-01`, `coins-02`, `dollar-sign`, `dollar-circle` — currency
- `euro`, `euro-circle`, `pound`, `pound-circle` — foreign currency
- `bitcoin`, `bitcoin-01`, `bitcoin-02` — crypto
- `piggy-bank`, `cash-01`, `cash-02`, `invoice-01`, `invoice-02` — savings / invoices

**Files / folders**

- `file`, `file-01`, `file-02`, `file-check`, `file-plus`, `file-minus`, `file-x` — files
- `document-attachment`, `document-code`, `document-validation` — documents
- `folder`, `folder-01`, `folder-02`, `folder-open`, `folder-add`, `folder-check` — folders
- `archive`, `archive-01`, `archive-02` — archive
- `attachment-01`, `attachment-02`, `zip` — attachments
- `book`, `book-01`, `book-02`, `book-open`, `book-open-01`, `book-open-02`, `bookmark-01`, `bookmark-02` — books / bookmarks

**Arrows / chevrons**

- `arrow-left`, `arrow-left-01`, `arrow-right`, `arrow-right-01`, `arrow-up`, `arrow-up-01`, `arrow-down`, `arrow-down-01` — directional arrows
- `arrow-up-left`, `arrow-up-right`, `arrow-down-left`, `arrow-down-right` — diagonal arrows
- `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down` — chevrons
- `chevrons-left`, `chevrons-right` — double chevrons
- `arrow-turn-backward`, `arrow-turn-forward`, `arrow-turn-down`, `arrow-turn-up` — turns
- `corner-up-left`, `corner-up-right`, `corner-down-left`, `corner-down-right` — corners

**Social / brands**

- `github`, `twitter`, `new-twitter`, `linkedin`, `linkedin-01`, `facebook`, `facebook-01`, `facebook-02`, `instagram`, `youtube` — major social platforms
- `discord`, `slack`, `twitch` — communities
- `figma`, `dribbble` — design
- `google`, `apple`, `spotify`, `notion` — services

**Devices / tech**

- `laptop`, `computer`, `monitor-dot` — computers
- `smart-phone`, `smart-phone-01`, `tablet`, `tablet-01`, `tablet-02`, `watch`, `watch-01`, `watch-02` — mobile
- `headphones`, `airpod-01`, `speaker`, `printer` — peripherals
- `server-stack`, `database`, `database-01`, `database-02`, `hard-drive` — infrastructure
- `cloud`, `cloud-upload`, `cloud-download`, `cloud-check` — cloud
- `wifi`, `wifi-01`, `wifi-02`, `wifi-off`, `bluetooth`, `usb` — connectivity
- `battery-full`, `battery-charging-01`, `battery-low` — power
- `cpu`, `cpu-charge`, `chip`, `chip-02`, `circuit-board` — chips

**People / users**

- `user`, `user-02`, `user-03`, `user-group`, `team-work` — people
- `user-add`, `user-minus`, `user-check`, `user-block` — user actions
- `profile`, `contact`, `contact-book`, `identity-card`, `user-circle` — identity
- `account-setting`, `account-setting-01`, `account-setting-02` — account settings

**Time / calendar**

- `clock`, `clock-01`, `clock-02`, `timer`, `alarm-clock`, `history`, `hourglass` — time
- `calendar`, `calendar-01`, `calendar-02`, `calendar-03`, `calendar-days`, `calendar-clock`, `calendar-check`, `calendar-plus`, `calendar-minus`, `calendar-x` — calendar

**Weather / nature**

- `sun`, `sun-01`, `moon`, `cloud`, `cloud-rain`, `cloud-sun-rain`, `cloud-moon-rain`, `cloud-lightning`, `cloud-snow` — sky
- `fast-wind`, `slow-winds`, `wind-power`, `tornado` — wind
- `thermometer`, `thermometer-cold`, `droplet`, `fire`, `flame` — temperature / elements
- `snow`, `cloud-little-snow` — snow
- `umbrella`, `tree`, `trees`, `flower`, `leaf`, `mountain`, `wave`, `sunrise`, `sunset` — nature

That is **200 verified names**. The actual icon set contains 6,158 names; use `list_components` or the server's `isIconName()` export to validate any name beyond this list before documenting it.

---

## Design tokens

Tokens are the single source of truth for spacing, type, radii, elevation, and color. Reference them with `{ $theme: "<path>" }`.

### Color tokens (`color.*`)

Available in both `light` and `dark`:

- `color.background`, `color.surface`, `color.surfaceMuted`
- `color.foreground`, `color.mutedForeground`, `color.subtleForeground`
- `color.border`, `color.borderStrong`
- `color.accent.{bg,fg,subtle,border}`
- `color.neutral.{bg,fg,subtle,border}`
- `color.danger.{bg,fg,subtle,border}`
- `color.success.{bg,fg,subtle,border}`
- `color.warning.{bg,fg,subtle,border}`
- `color.info.{bg,fg,subtle,border}`
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

## Themes: light vs dark

Set `theme` to `"light"` or `"dark"` on the `render_ui` call. The same spec produces two visually distinct images because `$theme` color references resolve to different palettes.

```json
{ "name": "render_ui", "arguments": { "spec": { ... }, "theme": "light" } }
{ "name": "render_ui", "arguments": { "spec": { ... }, "theme": "dark" } }
```

- **Light:** near-white canvas, dark text, soft shadows.
- **Dark:** deep zinc canvas, light text, deeper shadows.

Use theme tokens even when you hardcode some colors so surfaces and foregrounds switch consistently.

---

## Auto-sizing

When `autoSize: true` is passed to `render_ui`, you may omit the `height` on the root `Frame` and the server will size the output canvas to the actual Satori/Yoga content height instead of a fixed default. This removes blank-space voids for content shorter than a fixed canvas.

**Key points:**

- Explicit `width` on the root `Frame` is still required so the layout has a known horizontal constraint.
- Explicit `height` on the `Frame` continues to work unchanged (backward-compatible).
- When the root `Frame` omits `height`, use `autoSize: true` to request content-aware sizing.

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
          "props": { "width": 640, "padding": 32, "backgroundColor": { "$theme": "color.background" } },
          "children": ["stack"]
        },
        "stack": {
          "type": "Stack",
          "props": { "gap": 12 },
          "children": ["title", "body"]
        },
        "title": { "type": "Heading", "props": { "text": "Auto-sized" }, "children": [] },
        "body": { "type": "Text", "props": { "text": "Canvas height matches content." }, "children": [] }
      }
    },
    "autoSize": true,
    "theme": "light"
  }
}
```

---

## Emoji support

You can use emoji freely in `Text` and `Heading` content. The rendering pipeline bundles a fallback font that covers common emoji and pictographic characters, so they render as recognizable glyphs rather than missing-glyph boxes.

```json
{
  "type": "Text",
  "props": { "text": "Latest status: all systems green ✅" },
  "children": []
}
```

```json
{
  "type": "Heading",
  "props": { "text": "🚀 Launch metrics" },
  "children": []
}
```

For status indicators, prefer the catalog's own `Badge`, `Alert`, `Progress`, and `Metric.delta` components (they remain crisp and semantically clear), but emoji in running text is fully supported.

---

## Output defaults

| Property | Default | Notes |
|----------|---------|-------|
| Logical dimensions | `1200 x 630` | Overridden by root `Frame` width/height. |
| Physical dimensions | `2400 x 1260` | Default scale is 2. |
| Scale | `2` | Crisp on mobile / chat previews. |
| Format | PNG | base64 + `image/png` content block. |
| Temp file | `/tmp/jsonui-render-mcp/jsonui-render-<timestamp>.png` | Adjacent text block returns the path. |
| Aspect ratio | ~1.9:1 | Chat-gateway friendly. |

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

- `code` — `VALIDATION_ERROR` (schema / limit / graph issue) or `RENDER_ERROR` (unexpected render failure).
- `path` — dotted path to the offending value.
- `message` — human-readable reason.

The server process stays alive on every error.

---

## Resource limits

Untrusted specs are bounded:

| Limit | Value | What it guards |
|-------|-------|----------------|
| `maxElements` | 2,000 | Total keys in `elements`. |
| `maxTreeDepth` | 50 | Depth of the element reference graph. |
| `maxStringLength` | 10,000 characters | Any string prop value. |
| `maxArrayLength` | 1,000 entries | Any array in the spec. |
| `maxChartPoints` | 1,000 points | Per chart series / sparkline data array. |

Violations return a `VALIDATION_ERROR` with a path pointing at the oversized value.

---

## Complete example specs

### Example 1 — Greeting card

A minimal, theme-aware greeting card.

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

Result: a 1280x720 PNG with a centered card, heading, and subtitle.

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

### Example 3 — Bar + donut panel

A side-by-side bar chart and donut chart inside boxes.

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 900, "height": 420, "padding": 24, "backgroundColor": { "$theme": "color.background" } },
      "children": ["row"]
    },
    "row": {
      "type": "Row",
      "props": { "gap": 20 },
      "children": ["barBox", "donutBox"]
    },
    "barBox": {
      "type": "Box",
      "props": { "padding": 20, "backgroundColor": { "$theme": "color.surface" }, "borderRadius": 16, "flex": 1 },
      "children": ["barTitle", "barChart"]
    },
    "barTitle": {
      "type": "Heading",
      "props": { "text": "Weekly sign-ups", "level": "h4" },
      "children": []
    },
    "barChart": {
      "type": "BarChart",
      "props": {
        "data": [
          { "label": "Mon", "value": 120 },
          { "label": "Tue", "value": 190 },
          { "label": "Wed", "value": 150 },
          { "label": "Thu", "value": 270 },
          { "label": "Fri", "value": 220 }
        ],
        "width": 380,
        "height": 220,
        "colors": { "$theme": "color.chart" },
        "gridColor": { "$theme": "color.border" },
        "labelColor": { "$theme": "color.mutedForeground" }
      },
      "children": []
    },
    "donutBox": {
      "type": "Box",
      "props": { "padding": 20, "backgroundColor": { "$theme": "color.surface" }, "borderRadius": 16, "flex": 1, "alignItems": "center" },
      "children": ["donutTitle", "donutChart"]
    },
    "donutTitle": {
      "type": "Heading",
      "props": { "text": "Traffic sources", "level": "h4" },
      "children": []
    },
    "donutChart": {
      "type": "PieChart",
      "props": {
        "data": [
          { "label": "Direct", "value": 40 },
          { "label": "Referral", "value": 35 },
          { "label": "Organic", "value": 25 }
        ],
        "donut": true,
        "size": 220,
        "colors": { "$theme": "color.chart" },
        "backgroundColor": { "$theme": "color.surface" }
      },
      "children": []
    }
  }
}
```

Result: a 1800x840 PNG with two rounded panels, a 5-bar chart on the left and a labeled donut on the right.

---

### Example 4 — Status panel with alerts, table, and progress

A compact operations status card.

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 760, "height": 640, "padding": 28, "backgroundColor": { "$theme": "color.background" } },
      "children": ["card"]
    },
    "card": {
      "type": "Card",
      "props": {
        "backgroundColor": { "$theme": "color.surface" },
        "borderColor": { "$theme": "color.border" },
        "borderRadius": { "$theme": "radius.lg" },
        "padding": { "$theme": "spacing.6" },
        "gap": { "$theme": "spacing.4" },
        "elevation": { "$theme": "elevation.md" }
      },
      "children": ["header", "alert", "table", "progress"]
    },
    "header": {
      "type": "Row",
      "props": { "gap": 12, "alignItems": "center" },
      "children": ["headerIcon", "headerTitle"]
    },
    "headerIcon": {
      "type": "Icon",
      "props": { "name": "server-stack", "size": 28, "color": { "$theme": "color.accent.bg" } },
      "children": []
    },
    "headerTitle": {
      "type": "Heading",
      "props": { "text": "Infrastructure status", "level": "h3" },
      "children": []
    },
    "alert": {
      "type": "Alert",
      "props": {
        "title": "All systems operational",
        "text": "No incidents in the last 24 hours.",
        "variant": "success",
        "backgroundColor": { "$theme": "color.success.subtle" },
        "borderColor": { "$theme": "color.success.border" },
        "titleColor": { "$theme": "color.success.bg" },
        "iconName": "checkmark-circle-02"
      },
      "children": []
    },
    "table": {
      "type": "Table",
      "props": {
        "header": ["Service", "Status", "Uptime"],
        "rows": [
          ["API", { "text": "Operational", "color": { "$theme": "color.success.bg" } }, "99.98%"],
          ["Database", { "text": "Operational", "color": { "$theme": "color.success.bg" } }, "99.95%"],
          ["Cache", { "text": "Degraded", "color": { "$theme": "color.warning.bg" } }, "99.71%"]
        ],
        "striped": true,
        "headerBackgroundColor": { "$theme": "color.surfaceMuted" },
        "borderColor": { "$theme": "color.border" }
      },
      "children": []
    },
    "progress": {
      "type": "Progress",
      "props": {
        "value": 72,
        "label": "Storage used",
        "showValue": true,
        "trackColor": { "$theme": "color.surfaceMuted" },
        "fillColor": { "$theme": "color.accent.bg" }
      },
      "children": []
    }
  }
}
```

Result: a 1520x1280 PNG showing a card with a server icon header, a success alert, a 3-row status table, and a progress bar.

---

### Example 5 — Full dashboard

The checked-in `examples/dashboard.json` combines a header, metric grid, line chart, progress ring, table, progress bars, and alerts. Render it in either theme:

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

Result: a crisp dark-themed platform overview dashboard.

---

### Example 6 — Icon showcase strip

A simple strip showing multiple verified icons at different sizes and colors.

```json
{
  "root": "frame",
  "elements": {
    "frame": {
      "type": "Frame",
      "props": { "width": 720, "height": 120, "padding": 24, "backgroundColor": { "$theme": "color.background" } },
      "children": ["row"]
    },
    "row": {
      "type": "Row",
      "props": { "gap": 24, "alignItems": "center", "justifyContent": "center" },
      "children": ["i1", "i2", "i3", "i4", "i5", "i6"]
    },
    "i1": { "type": "Icon", "props": { "name": "home", "size": 32, "color": { "$theme": "color.foreground" } }, "children": [] },
    "i2": { "type": "Icon", "props": { "name": "search", "size": 28, "color": { "$theme": "color.accent.bg" } }, "children": [] },
    "i3": { "type": "Icon", "props": { "name": "notification-03", "size": 28, "color": { "$theme": "color.warning.bg" } }, "children": [] },
    "i4": { "type": "Icon", "props": { "name": "checkmark-circle-02", "size": 32, "color": { "$theme": "color.success.bg" } }, "children": [] },
    "i5": { "type": "Icon", "props": { "name": "user-group", "size": 28, "color": { "$theme": "color.mutedForeground" } }, "children": [] },
    "i6": { "type": "Icon", "props": { "name": "arrow-right-01", "size": 24, "color": { "$theme": "color.subtleForeground" } }, "children": [] }
  }
}
```

Result: a 1440x240 PNG strip of six crisp HugeIcons glyphs.

---

## Quick workflow

1. Call `list_components` to confirm the catalog and inspect prop schemas.
2. Build a spec with a `Frame` root, flat `elements` map, and keyed `children` arrays.
3. Prefer `$theme` references over hardcoded colors.
4. Call `render_ui` with `theme: "light"` or `theme: "dark"` and `scale: 2`.
5. If validation fails, read `code`, `path`, and `message`, fix the spec, and retry.
6. On success, the first content block is the base64 PNG; the second is the temp-file path.

## See also

- `AGENTS.md` — guidance for agents working on this repo's code.
- `README.md` — project overview for end users.
- `examples/dashboard.json` — a full, render-validated dashboard spec.
