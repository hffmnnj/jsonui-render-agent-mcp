import { schema as imageSchema } from "@json-render/image";
import { defineCatalog } from "@json-render/core";
import { z } from "zod";
import {
  boxPropsSchema,
  framePropsSchema,
  headingPropsSchema,
  rowPropsSchema,
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
  },
});

export type Catalog = typeof catalog;

export type FrameProps = z.infer<typeof framePropsSchema>;
export type BoxProps = z.infer<typeof boxPropsSchema>;
export type StackProps = z.infer<typeof stackPropsSchema>;
export type RowProps = z.infer<typeof rowPropsSchema>;
export type TextProps = z.infer<typeof textPropsSchema>;
export type HeadingProps = z.infer<typeof headingPropsSchema>;
