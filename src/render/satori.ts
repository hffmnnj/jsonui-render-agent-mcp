import { readFile } from "node:fs/promises";
import type { CSSProperties, ReactNode } from "react";
import { createElement } from "react";
import satori, { type SatoriOptions } from "satori";
import type { ResolvedSpec } from "./resolve-theme";

const FONT_FAMILY = "FreeSans";
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
let fontsPromise: Promise<SatoriOptions["fonts"]> | undefined;

export interface RenderOptions {
  /** Override the Frame's logical canvas width. */
  width?: number;
  /** Override the Frame's logical canvas height. */
  height?: number;
}

type Props = Record<string, unknown>;

function cleanStyle(style: CSSProperties): CSSProperties {
  return Object.fromEntries(
    Object.entries(style).filter(([, value]) => value !== undefined && value !== null)
  ) as CSSProperties;
}

function asProps(value: unknown): Props {
  return value as Props;
}

function requiredText(props: Props, key: string): string {
  if (typeof props.text !== "string") {
    throw new TypeError(`${key} must have a string text prop.`);
  }
  return props.text;
}

function finiteDimension(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero.`);
  }
  return value;
}

function renderElement(
  spec: ResolvedSpec,
  key: string,
  ancestors: ReadonlySet<string>,
  rootWidth: number,
  rootHeight: number
): ReactNode {
  if (ancestors.has(key)) {
    throw new Error(`Cannot render cyclic child reference at element "${key}".`);
  }

  const element = spec.elements[key];
  if (!element) {
    throw new Error(`Cannot render missing child element "${key}".`);
  }

  const props = asProps(element.props);
  const nextAncestors = new Set(ancestors).add(key);
  const children = (element.children ?? []).map((childKey) =>
    renderElement(spec, childKey, nextAncestors, rootWidth, rootHeight)
  );

  switch (element.type) {
    case "Frame":
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: (props.display as CSSProperties["display"]) ?? "flex",
            flexDirection: (props.flexDirection as CSSProperties["flexDirection"]) ?? "column",
            width: rootWidth,
            height: rootHeight,
            backgroundColor: props.backgroundColor as string | undefined,
            padding: props.padding as CSSProperties["padding"],
            alignItems: props.alignItems as CSSProperties["alignItems"],
            justifyContent: props.justifyContent as CSSProperties["justifyContent"],
            fontFamily: FONT_FAMILY,
          }),
        },
        children
      );
    case "Box":
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: (props.flexDirection as CSSProperties["flexDirection"]) ?? "column",
            padding: props.padding as CSSProperties["padding"],
            paddingTop: props.paddingTop as CSSProperties["paddingTop"],
            paddingBottom: props.paddingBottom as CSSProperties["paddingBottom"],
            paddingLeft: props.paddingLeft as CSSProperties["paddingLeft"],
            paddingRight: props.paddingRight as CSSProperties["paddingRight"],
            margin: props.margin as CSSProperties["margin"],
            backgroundColor: props.backgroundColor as string | undefined,
            borderWidth: props.borderWidth as CSSProperties["borderWidth"],
            borderColor: props.borderColor as string | undefined,
            borderRadius: props.borderRadius as CSSProperties["borderRadius"],
            borderStyle: props.borderWidth ? "solid" : undefined,
            flex: props.flex as CSSProperties["flex"],
            width: props.width as CSSProperties["width"],
            height: props.height as CSSProperties["height"],
            alignItems: props.alignItems as CSSProperties["alignItems"],
            justifyContent: props.justifyContent as CSSProperties["justifyContent"],
            position: props.position as CSSProperties["position"],
            top: props.top as CSSProperties["top"],
            left: props.left as CSSProperties["left"],
            right: props.right as CSSProperties["right"],
            bottom: props.bottom as CSSProperties["bottom"],
            overflow: props.overflow as CSSProperties["overflow"],
          }),
        },
        children
      );
    case "Stack":
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "column",
            gap: props.gap as CSSProperties["gap"],
            alignItems: props.alignItems as CSSProperties["alignItems"],
            justifyContent: props.justifyContent as CSSProperties["justifyContent"],
            padding: props.padding as CSSProperties["padding"],
            flex: props.flex as CSSProperties["flex"],
          }),
        },
        children
      );
    case "Row":
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "row",
            gap: props.gap as CSSProperties["gap"],
            alignItems: props.alignItems as CSSProperties["alignItems"],
            justifyContent: props.justifyContent as CSSProperties["justifyContent"],
            padding: props.padding as CSSProperties["padding"],
            flex: props.flex as CSSProperties["flex"],
            flexWrap: props.wrap ? "wrap" : undefined,
          }),
        },
        children
      );
    case "Text":
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            fontFamily: FONT_FAMILY,
            fontSize: (props.fontSize as number | undefined) ?? 16,
            color: props.color as string | undefined,
            textAlign: (props.align as CSSProperties["textAlign"]) ?? "left",
            fontWeight: props.fontWeight === "bold" ? 700 : 400,
            fontStyle: (props.fontStyle as CSSProperties["fontStyle"]) ?? "normal",
            lineHeight: (props.lineHeight as number | undefined) ?? 1.4,
            letterSpacing: props.letterSpacing as CSSProperties["letterSpacing"],
            textDecoration: props.textDecoration as CSSProperties["textDecoration"],
          }),
        },
        requiredText(props, `Text element "${key}"`)
      );
    case "Heading": {
      const level = props.level ?? "h2";
      const headingStyle = {
        h1: { fontSize: 39, fontWeight: 700 },
        h2: { fontSize: 31, fontWeight: 700 },
        h3: { fontSize: 25, fontWeight: 700 },
        h4: { fontSize: 20, fontWeight: 700 },
      } as const;
      const metrics = headingStyle[level as keyof typeof headingStyle] ?? headingStyle.h2;
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            fontFamily: FONT_FAMILY,
            fontSize: metrics.fontSize,
            fontWeight: metrics.fontWeight,
            color: props.color as string | undefined,
            textAlign: (props.align as CSSProperties["textAlign"]) ?? "left",
            lineHeight: (props.lineHeight as number | undefined) ?? 1.2,
            letterSpacing: props.letterSpacing as CSSProperties["letterSpacing"],
          }),
        },
        requiredText(props, `Heading element "${key}"`)
      );
    }
    default:
      throw new Error(`Unsupported render component "${element.type}" at element "${key}".`);
  }
}

async function loadBundledFonts(): Promise<SatoriOptions["fonts"]> {
  const [regular, bold] = await Promise.all([
    readFile(new URL("./fonts/FreeSans-Regular.otf", import.meta.url)),
    readFile(new URL("./fonts/FreeSans-Bold.otf", import.meta.url)),
  ]);

  return [
    { name: FONT_FAMILY, data: regular, weight: 400, style: "normal" },
    { name: FONT_FAMILY, data: bold, weight: 700, style: "normal" },
  ];
}

function bundledFonts(): Promise<SatoriOptions["fonts"]> {
  fontsPromise ??= loadBundledFonts();
  return fontsPromise;
}

/** Render the project's resolved minimal catalog to an SVG using Satori/Yoga. */
export async function renderToSvg(
  spec: ResolvedSpec,
  options: RenderOptions = {}
): Promise<string> {
  const root = spec.elements[spec.root];
  if (!root || root.type !== "Frame") {
    throw new Error("A renderable spec must have a Frame root element.");
  }

  const rootProps = asProps(root.props);
  const width = finiteDimension(options.width ?? rootProps.width ?? DEFAULT_WIDTH, "Render width");
  const height = finiteDimension(options.height ?? rootProps.height ?? DEFAULT_HEIGHT, "Render height");
  const tree = renderElement(spec, spec.root, new Set(), width, height);

  return satori(tree, { width, height, fonts: await bundledFonts() });
}

export { DEFAULT_HEIGHT, DEFAULT_WIDTH, FONT_FAMILY };
