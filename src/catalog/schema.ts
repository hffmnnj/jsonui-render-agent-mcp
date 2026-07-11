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
