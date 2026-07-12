# Agent Guide — JSON-UI Render MCP Server

This doc is for AI coding agents (Claude Code, Codex, Cursor, etc.) working **on** this repository. It is not a contributor/credits list. It tells you how to safely modify the codebase without stepping on the project's architectural landmines.

## What this project is

An MCP server that renders JSON UI specs to crisp PNG images. A client (another AI agent) calls the `render_ui` tool with a JSON description of a dashboard/card/chart/metric and gets back a base64 PNG plus an on-disk temp path. The output is meant for chat gateways like iMessage or Telegram — basically Claude Artifacts, but rasterized.

## Stack and why

- **Bun** runtime and **TypeScript** everywhere.
- **MCP layer:** official `@modelcontextprotocol/sdk` with stdio transport. No hand-rolled JSON-RPC.
- **Render pipeline:** `@json-render/core` (catalog/schema) + `@json-render/image`, which wraps **Satori** (HTML/CSS → SVG via Yoga) and **`@resvg/resvg-js`** (SVG → PNG).
- **React** is used only as Satori's JSX-element-tree pragma. There is **no DOM, no reconciliation, no browser**.
- **Zod** for validation.
- **No Svelte anywhere.** The original plan included `@json-render/shadcn-svelte`, but research confirmed Satori never consumes Svelte. Amendment 1 dropped it entirely. Do not suggest, add, or reintroduce Svelte.
- **Design tokens are hand-authored** in this repo. They are shadcn/ui-*inspired* aesthetically but do not depend on any external shadcn package (neither Svelte nor React).

## The render pipeline

`render_ui` tool call → Zod catalog validation (`src/catalog/validate.ts`) → theme resolution (`src/render/resolve-theme.ts`) → Satori SVG (`src/render/satori.ts`) → resvg PNG (`src/render/rasterize.ts`) → MCP image content block + temp-file text block (`src/render/output.ts`).

Key invariant: **theme tokens must resolve to literal values before Satori runs.** Satori only understands inline styles; CSS variables and media queries do not work. `resolveTheme()` replaces every `{ $theme: "color.foo" }` reference with a concrete hex/rgba/px value keyed on `theme: "light" | "dark"`.

## Directory layout

```
src/
├── server/           # MCP stdio server bootstrap (McpServer + StdioServerTransport)
├── catalog/          # Zod component schemas, catalog registry, validation entry point
│   └── components/   # Currently only chart math helpers live here (arc-helpers.ts, svg-helpers.ts)
├── tokens/           # Hand-authored design tokens: palettes, spacing, type, radii, elevation
├── render/           # Theme resolution, Satori SVG render, resvg rasterization, temp-file output
├── tools/            # MCP tool registration: ping, render_ui, list_components
└── index.ts          # Entry point
```

Per-folder purpose:

- `src/server/` — Boot the MCP server over stdio and wire tools. Do not add HTTP endpoints or raw JSON-RPC here.
- `src/catalog/` — The single source of truth for what components exist and what props they accept. `schema.ts` defines every Zod props schema; `index.ts` registers components via `defineCatalog()`; `validate.ts` layers per-component prop checks and resource limits on top of the core catalog validation.
- `src/tokens/` — `palettes.ts` has light + dark color palettes; `index.ts` bundles spacing, type, radii, elevation, and re-exports the palettes. Every visual value flows from here.
- `src/render/` — The browserless image pipeline. `resolve-theme.ts` runs the pre-Satori token pass; `satori.ts` maps the resolved spec to a React element tree; `rasterize.ts` turns SVG into PNG bytes; `output.ts` writes temp files and builds MCP content blocks.
- `src/tools/` — One file per tool. Add new tools here and register them in `src/tools/index.ts`.

## Build, test, and typecheck commands

These are the real scripts from `package.json`. Do not invent others:

- `bun run dev` — Start the MCP server over stdio (`bun run src/index.ts`).
- `bun run typecheck` — `tsc --noEmit`. Must pass with zero errors.
- `bun test` — Run the full Bun test suite. Tests live next to source files as `*.test.ts`.

Minimum Bun version is `>=0.8.1` (driven by `@resvg/resvg-js` support and a source audit; originally pinned to 1.4.0 without justification, then relaxed by Task 6.3).

## Component catalog

The v1 catalog is fixed at 22 components. Do not add unbounded components; the list is contractually closed for v1.

Layout primitives: `Frame`, `Box`, `Stack`, `Row`, `Grid`, `Spacer`, `Divider`
Content primitives: `Text`, `Heading`, `Badge`, `Avatar`, `Alert`, `List`
Composite primitives: `Card`, `Table`, `Progress`
Custom charts: `BarChart`, `LineChart`, `Sparkline`, `PieChart`, `ProgressRing`, `Metric`

Verify the live list by running the `list_components` tool or reading `src/catalog/index.ts`.

### How to add a new component

Adding a component means touching four places and the tests:

1. **Schema** — Add a `z.object({ ... })` props schema in `src/catalog/schema.ts` and export it. Use the shared helpers:
   - `colorValue` for color props that may be `{ $theme: "color.foo" }`.
   - `themeableNumber` / `themeableString` for props that may be `{ $theme: "spacing.4" }` or `{ $theme: "elevation.sm" }`.
   - Make every optional nullable field `.nullable().optional()` (Zod v4 `.nullable()` alone does **not** accept `undefined`).
2. **Registration** — Add the component to `defineCatalog()` in `src/catalog/index.ts`, including description, slots, and example.
3. **Per-component prop validation** — Add the schema to the `componentPropsSchemas` map in `src/catalog/validate.ts` so `validateSpec()` can return path-aware errors.
4. **Satori render case** — Add a `case "YourComponent":` in `src/render/satori.ts` that emits a React element tree. Every container must use `display: "flex"` because Satori/Yoga is flexbox-only. Text must be in `div` leaves with `display: "flex"`.
5. **Token defaults** — Add theme-aware defaults to `componentDefaults` in `src/render/resolve-theme.ts` so a bare component still looks correct in both light and dark themes.
6. **Tests** — Add a `src/catalog/your-component.test.ts` or extend existing suite. Use `validateSpec()` for invalid-prop checks and render a sample spec in both themes.

### Critical landmine: Satori rejects SVG `<text>`

Satori 0.26.0 throws on raw SVG `<text>` nodes: `text nodes are not currently supported, please convert them to <path>`.

Chart geometry (bars, lines, arcs, gridlines) is drawn with SVG `rect`, `path`, `polyline`, `line`, `circle`. **All text labels** — axis labels, tick labels, legend labels, center readouts — must be rendered as absolutely-positioned Satori `<div>` overlays, never as SVG `<text>`.

This is already the established pattern in `BarChart`, `LineChart`, `PieChart`, `ProgressRing`, and `Metric`. Copy that pattern for any new chart-like component.

## Design-token system

`src/tokens/index.ts` + `src/tokens/palettes.ts` are the single source of truth.

- `palettes.ts` defines `lightPalette` and `darkPalette` with semantic slots: `color.background`, `color.surface`, `color.foreground`, `color.mutedForeground`, `color.border`, `color.accent.{bg,fg,subtle,border}`, status pairs (`danger`, `success`, `warning`, `info`, `neutral`), and `color.chart` (a categorical ramp array).
- `index.ts` adds `spacing`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `radius`, and theme-scoped `elevation`.

Components reference tokens via `{ $theme: "color.surface" }` or `{ $theme: "elevation.md" }`. `resolveTheme()` resolves these to literals before rendering. Do not hardcode colors in `satori.ts`; route fallbacks through `componentDefaults` in `resolve-theme.ts`.

## Validation and error contract

`src/catalog/validate.ts` is the gatekeeper. It returns a structured error object:

```ts
{ code: "VALIDATION_ERROR", path: ".elements.foo.props.bar", message: "..." }
```

`render_ui` forwards validation errors as a text content block containing JSON with that shape. Runtime render failures use:

```ts
{ code: "RENDER_ERROR", path: ".", message: "Rendering failed." }
```

Keep this contract stable. Do not expose raw stack traces to MCP clients.

## Resource limits

Untrusted specs are bounded in `src/catalog/validate.ts`:

- `maxElements`: 2,000
- `maxTreeDepth`: 50
- `maxStringLength`: 10,000 characters
- `maxArrayLength`: 1,000 entries per array
- `maxChartPoints`: 1,000 points per chart series

If you add a new array-shaped prop, make sure `validateArrayLengths()` catches it.

## Testing conventions

- Use Bun's built-in test runner: `bun test`.
- Test files live next to the code they cover: `*.test.ts` in the same folder.
- Validate invalid specs return the expected `{ code, path, message }` shape.
- Render tests should assert valid PNG output (magic bytes, non-trivial byte size) and ideally test both `light` and `dark` themes.
- Run `bun run typecheck` before committing.

## Common anti-patterns to avoid

1. **No hand-rolled JSON-RPC.** Use the official MCP SDK only.
2. **No Playwright/Chromium per render.** The pipeline is browserless Satori + resvg-js. Playwright is cached only as a documented emergency fallback and requires architectural escalation.
3. **No dead validation code.** Zod checks must be wired and reachable in the actual render path.
4. **No raw-HTML injection.** The spec never becomes `page.setContent()` HTML; it flows through the typed Satori element tree only.
5. **No CDN fetches at render time.** Fonts are bundled under `src/render/fonts/`; tokens are local.
6. **No catalog duplication.** Do not shadow the fixed v1 list with redundant custom components.
7. **No test-free delivery.** Every unit has tests.
8. **No dead dependencies.** Every package in `package.json` must be executed by the pipeline. Svelte packages were already removed for exactly this reason.

## Quick checks before you commit

```bash
bun install
bun run typecheck
bun test
```

Also verify:

- `package.json` has no Svelte-related dependencies.
- New component props are in `componentPropsSchemas` in `validate.ts`.
- New component colors/spacing come from tokens, not hardcoded literals.
- No SVG `<text>` nodes are introduced.
