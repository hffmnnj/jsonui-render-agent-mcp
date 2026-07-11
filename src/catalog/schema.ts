import { z } from "zod";

const colorValue = z.union([z.string(), z.object({ $theme: z.string() })]);
const alignItems = z.enum(["flex-start", "center", "flex-end", "stretch"]);
const justifyContent = z.enum([
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
]);
const flexDirection = z.enum(["row", "column"]);

export const framePropsSchema = z.object({
  width: z.number(),
  height: z.number(),
  backgroundColor: colorValue.nullable().optional(),
  padding: z.number().nullable().optional(),
  display: z.enum(["flex", "none"]).nullable().optional(),
  flexDirection: flexDirection.nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
});
export type FrameProps = z.infer<typeof framePropsSchema>;

export const boxPropsSchema = z.object({
  padding: z.number().nullable().optional(),
  paddingTop: z.number().nullable().optional(),
  paddingBottom: z.number().nullable().optional(),
  paddingLeft: z.number().nullable().optional(),
  paddingRight: z.number().nullable().optional(),
  margin: z.number().nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
  width: z.union([z.number(), z.string()]).nullable().optional(),
  height: z.union([z.number(), z.string()]).nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  flexDirection: flexDirection.nullable().optional(),
  position: z.enum(["relative", "absolute"]).nullable().optional(),
  top: z.number().nullable().optional(),
  left: z.number().nullable().optional(),
  right: z.number().nullable().optional(),
  bottom: z.number().nullable().optional(),
  overflow: z.enum(["visible", "hidden"]).nullable().optional(),
});
export type BoxProps = z.infer<typeof boxPropsSchema>;

export const stackPropsSchema = z.object({
  gap: z.number().nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type StackProps = z.infer<typeof stackPropsSchema>;

export const rowPropsSchema = z.object({
  gap: z.number().nullable().optional(),
  alignItems: alignItems.nullable().optional(),
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
  wrap: z.boolean().nullable().optional(),
});
export type RowProps = z.infer<typeof rowPropsSchema>;

export const textPropsSchema = z.object({
  text: z.string(),
  fontSize: z.number().nullable().optional(),
  color: colorValue.nullable().optional(),
  align: z.enum(["left", "center", "right"]).nullable().optional(),
  fontWeight: z.enum(["normal", "bold"]).nullable().optional(),
  fontStyle: z.enum(["normal", "italic"]).nullable().optional(),
  lineHeight: z.number().nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  textDecoration: z.enum(["none", "underline", "line-through"]).nullable().optional(),
});
export type TextProps = z.infer<typeof textPropsSchema>;

export const headingPropsSchema = z.object({
  text: z.string(),
  level: z.enum(["h1", "h2", "h3", "h4"]).nullable().optional(),
  color: colorValue.nullable().optional(),
  align: z.enum(["left", "center", "right"]).nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  lineHeight: z.number().nullable().optional(),
});
export type HeadingProps = z.infer<typeof headingPropsSchema>;

/* ------------------------------------------------------------------ *
 * Content primitives (Wave 3, Task 3.2): Badge, Avatar, Alert, List. *
 *                                                                     *
 * Variant enums are ergonomic hints; the concrete per-variant colors *
 * are supplied by the spec author as `$theme` refs on the explicit   *
 * color props below (e.g. `{ $theme: "color.danger.subtle" }`), so   *
 * they resolve to literals through the SAME theme-resolution pass as  *
 * every other component before ever reaching Satori.                 *
 * ------------------------------------------------------------------ */

/** Shared status/intent variants mapped to the palette's semantic slots. */
const statusVariant = z.enum([
  "default",
  "accent",
  "danger",
  "success",
  "warning",
  "info",
]);

/**
 * Badge — a small inline pill label. `backgroundColor`/`color`/`borderColor`
 * accept `$theme` refs pointing at a status slot (e.g. `color.success.bg` /
 * `color.success.fg`); `variant` records the author's intent for discovery.
 */
export const badgePropsSchema = z.object({
  text: z.string(),
  variant: statusVariant.nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).nullable().optional(),
  paddingX: z.number().nullable().optional(),
  paddingY: z.number().nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  letterSpacing: z.union([z.number(), z.string()]).nullable().optional(),
  uppercase: z.boolean().nullable().optional(),
});
export type BadgeProps = z.infer<typeof badgePropsSchema>;

/**
 * Avatar — a circular identity marker. `mode: "initials"` renders text on a
 * tinted disc (primary, always-supported mode); `mode: "image"` renders an
 * `<img>` and REQUIRES a base64 `data:` URI in `src` — remote URLs are not
 * fetched at render time (network access is a banned anti-pattern), so an
 * `image` avatar without a data URI falls back to the initials disc.
 */
export const avatarPropsSchema = z.object({
  mode: z.enum(["initials", "image"]).nullable().optional(),
  initials: z.string().nullable().optional(),
  src: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  shape: z.enum(["circle", "rounded", "square"]).nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).nullable().optional(),
});
export type AvatarProps = z.infer<typeof avatarPropsSchema>;

/**
 * Alert — a bordered, tinted callout. `variant` records intent; the author
 * supplies the tint/border/foreground via `$theme` status-slot refs
 * (`color.<status>.subtle` / `.border` / `.bg`). `title` is optional; the body
 * `text` is required.
 */
export const alertPropsSchema = z.object({
  text: z.string(),
  title: z.string().nullable().optional(),
  variant: z.enum(["info", "success", "warning", "danger", "neutral"]).nullable().optional(),
  backgroundColor: colorValue.nullable().optional(),
  borderColor: colorValue.nullable().optional(),
  titleColor: colorValue.nullable().optional(),
  color: colorValue.nullable().optional(),
  accentColor: colorValue.nullable().optional(),
  borderWidth: z.number().nullable().optional(),
  borderRadius: z.number().nullable().optional(),
  padding: z.number().nullable().optional(),
  gap: z.number().nullable().optional(),
  showAccentBar: z.boolean().nullable().optional(),
});
export type AlertProps = z.infer<typeof alertPropsSchema>;

/**
 * List — a vertical list of items. Each item is either a plain string or a
 * structured `{ text, secondary? }` row. `marker` selects the bullet style;
 * `gap` controls the space between rows. Colors accept `$theme` refs.
 */
const listItem = z.union([
  z.string(),
  z.object({
    text: z.string(),
    secondary: z.string().nullable().optional(),
  }),
]);

export const listPropsSchema = z.object({
  items: z.array(listItem).min(1),
  marker: z.enum(["none", "disc", "dash", "check", "number"]).nullable().optional(),
  gap: z.number().nullable().optional(),
  fontSize: z.number().nullable().optional(),
  color: colorValue.nullable().optional(),
  secondaryColor: colorValue.nullable().optional(),
  markerColor: colorValue.nullable().optional(),
  lineHeight: z.number().nullable().optional(),
});
export type ListProps = z.infer<typeof listPropsSchema>;

// --- Layout primitives (Wave 3, Task 3.1): Grid, Spacer, Divider ---

/**
 * Grid — an equal-column layout. Satori/Yoga has no CSS-grid support, so this
 * is a flex-wrap grid: `columns` equal-width cells per row, wrapping to new
 * rows as children overflow, separated by a token-driven `gap`. Prefer this
 * over a hand-rolled Row+wrap when you want uniform column widths.
 */
export const gridPropsSchema = z.object({
  /** Number of equal-width columns per row. Defaults to 2. */
  columns: z.number().int().positive().nullable().optional(),
  /** Spacing between cells (both row and column axes), in px. */
  gap: z.number().nullable().optional(),
  /** Cross-axis alignment of cells within a row. */
  alignItems: alignItems.nullable().optional(),
  /** Main-axis distribution of cells within a row. */
  justifyContent: justifyContent.nullable().optional(),
  padding: z.number().nullable().optional(),
  flex: z.number().nullable().optional(),
});
export type GridProps = z.infer<typeof gridPropsSchema>;

/**
 * Spacer — an empty sizing element. Either fixed (`size` px on both axes, holds
 * a gap in a Row or Stack) or flexible (`grow: true` => `flex: 1`, absorbs the
 * remaining main-axis space to push siblings apart). No children.
 */
export const spacerPropsSchema = z.object({
  /** Fixed size in px applied to both width and height. Ignored when grow. */
  size: z.number().nonnegative().nullable().optional(),
  /** When true, expands to fill remaining main-axis space (`flex: 1`). */
  grow: z.boolean().nullable().optional(),
});
export type SpacerProps = z.infer<typeof spacerPropsSchema>;

/**
 * Divider — a thin separator line. `orientation` picks the axis: a horizontal
 * divider is a full-width hairline (height = `thickness`); a vertical divider is
 * a full-height hairline (width = `thickness`). Color is token-driven; pass
 * `{ $theme: "color.border" }` to track the theme's border color.
 */
export const dividerPropsSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]).nullable().optional(),
  /** Line color. Use a `$theme.color.*` ref (e.g. color.border) for theming. */
  color: colorValue.nullable().optional(),
  /** Line thickness in px. Defaults to 1 (a crisp hairline). */
  thickness: z.number().positive().nullable().optional(),
  /**
   * Optional length along the main axis. A number is px; a string (e.g.
   * "50%") is passed through. Defaults to the full cross length ("100%").
   */
  length: z.union([z.number(), z.string()]).nullable().optional(),
  /** Optional margin around the line, in px. */
  margin: z.number().nullable().optional(),
});
export type DividerProps = z.infer<typeof dividerPropsSchema>;
