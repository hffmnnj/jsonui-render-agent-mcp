import { schema as imageSchema } from "@json-render/image";
import { defineCatalog } from "@json-render/core";
import { z } from "zod";
import {
  alertPropsSchema,
  avatarPropsSchema,
  badgePropsSchema,
  boxPropsSchema,
  dividerPropsSchema,
  framePropsSchema,
  gridPropsSchema,
  headingPropsSchema,
  listPropsSchema,
  rowPropsSchema,
  spacerPropsSchema,
  stackPropsSchema,
  textPropsSchema,
} from "./schema";

/**
 * The image schema requires a `visible` field on every element, but the
 * standard json-render image catalog treats visibility as optional in
 * practice. We mark the field optional here so specs omitting it validate.
 */
const specDefinition = imageSchema.definition as {
  spec: {
    inner: {
      elements: {
        inner: {
          inner: { visible?: { optional?: boolean } };
        };
      };
    };
  };
};
specDefinition.spec.inner.elements.inner.inner.visible = { optional: true };

export const schema = imageSchema;

export const catalog = defineCatalog(schema, {
  components: {
    Frame: {
      props: framePropsSchema,
      slots: ["default"],
      description:
        "Root image container. Defines the output image dimensions and background. Must be the root element.",
      example: { width: 1200, height: 630, backgroundColor: "#ffffff" },
    },
    Box: {
      props: boxPropsSchema,
      slots: ["default"],
      description:
        "Generic container with padding, margin, background, border, and flex alignment. Supports absolute positioning.",
      example: {
        padding: 20,
        backgroundColor: "#f9f9f9",
        borderRadius: 8,
        alignItems: "center",
      },
    },
    Stack: {
      props: stackPropsSchema,
      slots: ["default"],
      description: "Vertical flex layout. Use for stacking elements top to bottom.",
      example: { gap: 8, padding: 10 },
    },
    Row: {
      props: rowPropsSchema,
      slots: ["default"],
      description: "Horizontal flex layout. Use for placing elements side by side.",
      example: { gap: 10, alignItems: "center" },
    },
    Text: {
      props: textPropsSchema,
      slots: [],
      description: "Body text with configurable size, color, weight, and alignment.",
      example: { text: "Some content here.", fontSize: 16, color: "#333333" },
    },
    Heading: {
      props: headingPropsSchema,
      slots: [],
      description: "Heading text at various levels. h1 is largest, h4 is smallest.",
      example: { text: "Hello World", level: "h1", color: "#000000" },
    },
    Badge: {
      props: badgePropsSchema,
      slots: [],
      description:
        "Small inline pill label for statuses and tags. Set `variant` and supply matching `$theme` color refs (e.g. color.success.bg / .fg).",
      example: {
        text: "Active",
        variant: "success",
        backgroundColor: { $theme: "color.success.bg" },
        color: { $theme: "color.success.fg" },
      },
    },
    Avatar: {
      props: avatarPropsSchema,
      slots: [],
      description:
        "Circular identity marker. `mode: \"initials\"` (default) draws initials on a tinted disc; `mode: \"image\"` needs a base64 data: URI in `src` (remote URLs are not fetched).",
      example: {
        mode: "initials",
        initials: "JH",
        size: 48,
        backgroundColor: { $theme: "color.accent.bg" },
        color: { $theme: "color.accent.fg" },
      },
    },
    Alert: {
      props: alertPropsSchema,
      slots: [],
      description:
        "Bordered, tinted callout with optional title and required body text. Set `variant` and supply matching `$theme` refs (color.<status>.subtle / .border / .bg).",
      example: {
        title: "Heads up",
        text: "Your storage is almost full.",
        variant: "warning",
        backgroundColor: { $theme: "color.warning.subtle" },
        borderColor: { $theme: "color.warning.border" },
        titleColor: { $theme: "color.warning.bg" },
      },
    },
    List: {
      props: listPropsSchema,
      slots: [],
      description:
        "Vertical list of string or { text, secondary } items with a selectable marker (none/disc/dash/check/number).",
      example: {
        marker: "check",
        gap: 8,
        items: ["Backups enabled", { text: "2FA", secondary: "Recommended" }],
      },
    },
    Grid: {
      props: gridPropsSchema,
      slots: ["default"],
      description:
        "Equal-column grid layout (flex-wrap based). Children flow into `columns` equal-width cells per row, wrapping to new rows, separated by `gap`.",
      example: { columns: 3, gap: 16 },
    },
    Spacer: {
      props: spacerPropsSchema,
      slots: [],
      description:
        "Empty sizing element. Fixed `size` (px) holds a gap; `grow: true` (flex: 1) absorbs remaining space.",
      example: { size: 24 },
    },
    Divider: {
      props: dividerPropsSchema,
      slots: [],
      description:
        "Thin separator line. `orientation` picks the axis; pass a `$theme.color.*` color to track the theme.",
      example: { orientation: "horizontal", color: { $theme: "color.border" } },
    },
  },
});

export type Catalog = typeof catalog;

export type FrameProps = z.infer<typeof framePropsSchema>;
export type BoxProps = z.infer<typeof boxPropsSchema>;
export type StackProps = z.infer<typeof stackPropsSchema>;
export type RowProps = z.infer<typeof rowPropsSchema>;
export type TextProps = z.infer<typeof textPropsSchema>;
export type HeadingProps = z.infer<typeof headingPropsSchema>;
export type BadgeProps = z.infer<typeof badgePropsSchema>;
export type AvatarProps = z.infer<typeof avatarPropsSchema>;
export type AlertProps = z.infer<typeof alertPropsSchema>;
export type ListProps = z.infer<typeof listPropsSchema>;
export type GridProps = z.infer<typeof gridPropsSchema>;
export type SpacerProps = z.infer<typeof spacerPropsSchema>;
export type DividerProps = z.infer<typeof dividerPropsSchema>;
