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

/** Map a named font weight to Satori's numeric weight, with a fallback. */
function fontWeightValue(value: unknown, fallback: number): number {
  switch (value) {
    case "normal":
      return 400;
    case "medium":
      return 500;
    case "semibold":
      return 600;
    case "bold":
      return 700;
    default:
      return fallback;
  }
}

/**
 * Resolve a List marker style to the glyph placed before each row. `none`
 * returns null (no marker cell); `number` is 1-based and ordinal-suffixed with
 * a period; the rest are static bullet glyphs.
 */
function listMarkerGlyph(marker: string, index: number): string | null {
  switch (marker) {
    case "none":
      return null;
    case "dash":
      return "–";
    case "check":
      return "✓";
    case "number":
      return `${index + 1}.`;
    case "disc":
    default:
      return "•";
  }
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
    case "Grid": {
      // Satori/Yoga has no CSS grid — emulate equal columns with flex-wrap.
      // Satori also rejects `calc()`, so cells use a plain percentage basis
      // (100% / columns) and the gap is a per-cell right/bottom gutter. The
      // container's negative right/bottom margin cancels the trailing gutter so
      // the grid still fills its width exactly (the classic negative-margin
      // gutter technique, which Yoga supports for both % basis and -margin).
      const columns = Math.max(1, Math.trunc((props.columns as number | undefined) ?? 2));
      const gap = (props.gap as number | undefined) ?? 0;
      const basis = `${100 / columns}%`;
      const cells = children.map((child, index) =>
        createElement(
          "div",
          {
            key: `${key}-cell-${index}`,
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: 0,
              flexShrink: 0,
              flexBasis: basis,
              maxWidth: basis,
              paddingRight: gap,
              paddingBottom: gap,
              boxSizing: "border-box",
            },
          },
          child
        )
      );
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            marginRight: gap ? -gap : undefined,
            marginBottom: gap ? -gap : undefined,
            alignItems: props.alignItems as CSSProperties["alignItems"],
            justifyContent: props.justifyContent as CSSProperties["justifyContent"],
            padding: props.padding as CSSProperties["padding"],
            flex: props.flex as CSSProperties["flex"],
          }),
        },
        cells
      );
    }
    case "Spacer": {
      const grow = props.grow === true;
      const size = props.size as number | undefined;
      return createElement("div", {
        key,
        style: cleanStyle({
          display: "flex",
          flex: grow ? 1 : undefined,
          flexShrink: grow ? undefined : 0,
          width: grow ? undefined : size,
          height: grow ? undefined : size,
        }),
      });
    }
    case "Divider": {
      const orientation = (props.orientation as string | undefined) ?? "horizontal";
      const thickness = (props.thickness as number | undefined) ?? 1;
      const length = (props.length as CSSProperties["width"]) ?? "100%";
      // A theme-resolved spec supplies a literal color; fall back to a neutral
      // hairline only when a bare Divider omits it entirely.
      const color = (props.color as string | undefined) ?? "#e4e4e7";
      const isHorizontal = orientation !== "vertical";
      return createElement("div", {
        key,
        style: cleanStyle({
          display: "flex",
          flexShrink: 0,
          backgroundColor: color,
          margin: props.margin as CSSProperties["margin"],
          width: isHorizontal ? length : thickness,
          height: isHorizontal ? thickness : length,
        }),
      });
    }
    case "Badge": {
      // Inline pill. Theme-resolved specs supply literal colors via $theme refs
      // keyed on the chosen variant; neutral fallbacks keep a bare Badge legible.
      const label = requiredText(props, `Badge element "${key}"`);
      const text = props.uppercase ? label.toUpperCase() : label;
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            fontFamily: FONT_FAMILY,
            fontSize: (props.fontSize as number | undefined) ?? 12,
            fontWeight: fontWeightValue(props.fontWeight, 600),
            color: (props.color as string | undefined) ?? "#3f3f46",
            backgroundColor: (props.backgroundColor as string | undefined) ?? "#f4f4f5",
            borderColor: props.borderColor as string | undefined,
            borderWidth: props.borderWidth as CSSProperties["borderWidth"],
            borderStyle: props.borderWidth ? "solid" : undefined,
            borderRadius: (props.borderRadius as number | undefined) ?? 9999,
            paddingTop: (props.paddingY as number | undefined) ?? 2,
            paddingBottom: (props.paddingY as number | undefined) ?? 2,
            paddingLeft: (props.paddingX as number | undefined) ?? 10,
            paddingRight: (props.paddingX as number | undefined) ?? 10,
            letterSpacing: (props.letterSpacing as CSSProperties["letterSpacing"]) ??
              (props.uppercase ? "0.05em" : undefined),
            lineHeight: 1,
          }),
        },
        text
      );
    }
    case "Avatar": {
      const size = (props.size as number | undefined) ?? 40;
      const shape = (props.shape as string | undefined) ?? "circle";
      const borderRadius =
        shape === "square" ? 0 : shape === "rounded" ? Math.round(size * 0.22) : 9999;
      const src = props.src as string | undefined;
      // Image mode only works with a locally-embeddable base64 data: URI —
      // remote URLs would require a network fetch at render time (banned). Any
      // other value falls back to the always-available initials disc.
      const useImage =
        props.mode === "image" && typeof src === "string" && src.startsWith("data:");
      const baseStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        borderColor: props.borderColor as string | undefined,
        borderWidth: props.borderWidth as CSSProperties["borderWidth"],
        borderStyle: props.borderWidth ? "solid" : undefined,
      };

      if (useImage) {
        return createElement(
          "div",
          { key, style: cleanStyle(baseStyle) },
          createElement("img", {
            src,
            width: size,
            height: size,
            style: { width: size, height: size, objectFit: "cover" },
          })
        );
      }

      const initials = ((props.initials as string | undefined) ?? "").slice(0, 3);
      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            ...baseStyle,
            backgroundColor: (props.backgroundColor as string | undefined) ?? "#4f46e5",
            color: (props.color as string | undefined) ?? "#ffffff",
            fontFamily: FONT_FAMILY,
            fontSize: (props.fontSize as number | undefined) ?? Math.round(size * 0.4),
            fontWeight: fontWeightValue(props.fontWeight, 600),
            letterSpacing: "0.02em",
          }),
        },
        initials
      );
    }
    case "Alert": {
      const body = requiredText(props, `Alert element "${key}"`);
      const title = props.title as string | undefined;
      const padding = (props.padding as number | undefined) ?? 16;
      const gap = (props.gap as number | undefined) ?? 4;
      const bg = (props.backgroundColor as string | undefined) ?? "#f4f4f5";
      const border = (props.borderColor as string | undefined) ?? "#e4e4e7";
      const titleColor = (props.titleColor as string | undefined) ?? "#18181b";
      const bodyColor = (props.color as string | undefined) ?? "#52525b";
      const showAccentBar = props.showAccentBar !== false;
      const accentColor = (props.accentColor as string | undefined) ?? border;

      const contentChildren: ReactNode[] = [];
      if (title) {
        contentChildren.push(
          createElement(
            "div",
            {
              key: `${key}__title`,
              style: cleanStyle({
                display: "flex",
                fontFamily: FONT_FAMILY,
                fontSize: 15,
                fontWeight: 600,
                color: titleColor,
                lineHeight: 1.3,
              }),
            },
            title
          )
        );
      }
      contentChildren.push(
        createElement(
          "div",
          {
            key: `${key}__body`,
            style: cleanStyle({
              display: "flex",
              fontFamily: FONT_FAMILY,
              fontSize: 14,
              color: bodyColor,
              lineHeight: 1.5,
            }),
          },
          body
        )
      );

      const inner = createElement(
        "div",
        {
          key: `${key}__content`,
          style: cleanStyle({
            display: "flex",
            flexDirection: "column",
            gap,
            flex: 1,
          }),
        },
        contentChildren
      );

      const children: ReactNode[] = showAccentBar
        ? [
            createElement("div", {
              key: `${key}__bar`,
              style: cleanStyle({
                display: "flex",
                flexShrink: 0,
                width: 3,
                alignSelf: "stretch",
                backgroundColor: accentColor,
                borderRadius: 9999,
              }),
            }),
            inner,
          ]
        : [inner];

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "row",
            gap: showAccentBar ? 12 : 0,
            padding,
            backgroundColor: bg,
            borderColor: border,
            borderWidth: (props.borderWidth as number | undefined) ?? 1,
            borderStyle: "solid",
            borderRadius: (props.borderRadius as number | undefined) ?? 8,
          }),
        },
        children
      );
    }
    case "List": {
      const items = Array.isArray(props.items) ? (props.items as unknown[]) : [];
      const marker = (props.marker as string | undefined) ?? "disc";
      const gap = (props.gap as number | undefined) ?? 6;
      const fontSize = (props.fontSize as number | undefined) ?? 15;
      const color = (props.color as string | undefined) ?? "#18181b";
      const secondaryColor = (props.secondaryColor as string | undefined) ?? "#71717a";
      const markerColor = (props.markerColor as string | undefined) ?? color;
      const lineHeight = (props.lineHeight as number | undefined) ?? 1.5;

      const rows = items.map((item, index) => {
        const isRecord = typeof item === "object" && item !== null;
        const primary = isRecord
          ? String((item as { text?: unknown }).text ?? "")
          : String(item);
        const secondary = isRecord
          ? ((item as { secondary?: unknown }).secondary as string | undefined)
          : undefined;
        const glyph = listMarkerGlyph(marker, index);

        const rowChildren: ReactNode[] = [];
        if (glyph !== null) {
          rowChildren.push(
            createElement(
              "div",
              {
                key: `${key}__m${index}`,
                style: cleanStyle({
                  display: "flex",
                  flexShrink: 0,
                  fontFamily: FONT_FAMILY,
                  fontSize,
                  lineHeight,
                  color: markerColor,
                  width: marker === "number" ? undefined : 16,
                  fontWeight: marker === "check" ? 700 : 400,
                }),
              },
              glyph
            )
          );
        }
        rowChildren.push(
          createElement(
            "div",
            {
              key: `${key}__t${index}`,
              style: cleanStyle({
                display: "flex",
                flexDirection: "row",
                flex: 1,
                justifyContent: secondary ? "space-between" : "flex-start",
                fontFamily: FONT_FAMILY,
                fontSize,
                lineHeight,
                color,
              }),
            },
            secondary
              ? [
                  createElement("div", { key: `${key}__t${index}a`, style: { display: "flex" } }, primary),
                  createElement(
                    "div",
                    {
                      key: `${key}__t${index}b`,
                      style: cleanStyle({ display: "flex", color: secondaryColor }),
                    },
                    secondary
                  ),
                ]
              : primary
          )
        );

        return createElement(
          "div",
          {
            key: `${key}__row${index}`,
            style: cleanStyle({ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-start" }),
          },
          rowChildren
        );
      });

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({ display: "flex", flexDirection: "column", gap }),
        },
        rows
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
