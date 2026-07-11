import { readFile } from "node:fs/promises";
import type { CSSProperties, ReactNode } from "react";
import { createElement } from "react";
import satori, { type SatoriOptions } from "satori";
import {
  arcPath,
  clamp,
  computeSlices,
  slicePath,
  type SliceDatum,
} from "../catalog/components/charts/arc-helpers";
import {
  areaPath,
  axisTicks,
  barRects,
  domainFromValues,
  entryLabel,
  entryValue,
  formatTick,
  linearScale,
  plotBox,
  pointsToAttr,
  rampColor,
  round,
  seriesPoints,
  smoothPath,
  type Point,
} from "../catalog/components/charts/svg-helpers";
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

/* ------------------------------------------------------------------ *
 * Axis/series chart helpers (BarChart, LineChart, Sparkline).         *
 *                                                                     *
 * These build an inline <svg> of shape-only geometry (rect/polyline/  *
 * path/line/circle) plus flexbox <div> LABEL overlays — Satori throws *
 * on SVG <text>, so every label is a positioned div, never a text     *
 * node. Colors arrive already theme-resolved (literal hex / a literal *
 * ramp array from `color.chart`), so these helpers never see $theme.  *
 * ------------------------------------------------------------------ */

/** Fallback categorical ramp if a chart omits `colors` entirely (matches the
 *  light palette's `color.chart`; a spec normally passes a resolved ramp). */
const DEFAULT_CHART_RAMP = ["#4f46e5", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#9333ea"];

/** Coerce a resolved `colors` prop into a literal ramp array. */
function resolveRamp(colors: unknown): string[] {
  return Array.isArray(colors) && colors.length > 0 ? (colors as string[]) : DEFAULT_CHART_RAMP;
}

/** Pull the numeric values out of a `(number | { value, label })[]` series. */
function seriesValues(data: unknown): number[] {
  return Array.isArray(data) ? data.map((d) => entryValue(d)) : [];
}

/** Pull the optional per-point labels out of a series (undefined where absent). */
function seriesLabels(data: unknown): Array<string | undefined> {
  return Array.isArray(data) ? data.map((d) => entryLabel(d)) : [];
}

/** A row of evenly-spaced x-axis category labels under a plot band. */
function bandAxisLabels(
  key: string,
  labels: Array<string | undefined>,
  color: string,
  fontSize: number
): ReactNode {
  return createElement(
    "div",
    {
      key: `${key}__xlabels`,
      style: cleanStyle({ display: "flex", flexDirection: "row", width: "100%" }),
    },
    labels.map((label, index) =>
      createElement(
        "div",
        {
          key: `${key}__xl${index}`,
          style: cleanStyle({
            display: "flex",
            flex: 1,
            justifyContent: "center",
            fontFamily: FONT_FAMILY,
            fontSize,
            color,
            lineHeight: 1,
          }),
        },
        label ?? ""
      )
    )
  );
}

/**
 * The Y-axis tick labels, absolutely positioned against the plot's left gutter
 * so each sits vertically aligned with its gridline. Returns one positioned div
 * per tick (the caller places them inside a relatively-positioned plot column).
 */
function valueTickLabels(
  key: string,
  ticks: Array<{ value: number; position: number }>,
  color: string,
  fontSize: number,
  gutter: number
): ReactNode[] {
  return ticks.map((tick, index) =>
    createElement(
      "div",
      {
        key: `${key}__yl${index}`,
        style: cleanStyle({
          display: "flex",
          position: "absolute",
          left: 0,
          top: round(tick.position - fontSize / 2),
          width: gutter - 6,
          height: fontSize,
          justifyContent: "flex-end",
          alignItems: "center",
          fontFamily: FONT_FAMILY,
          fontSize,
          color,
          lineHeight: 1,
        }),
      },
      formatTick(tick.value)
    )
  );
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
    case "Card": {
      // Region-bearing surface. `header`/`footer` are arrays of child-element
      // KEYS (rendered through the same recursion, so they honor the cycle
      // guard); the body is the standard `children` slot. Regions are separated
      // by a hairline drawn as a bottom/top border rather than an extra element.
      const padding = (props.padding as number | undefined) ?? 20;
      const gap = (props.gap as number | undefined) ?? 12;
      const bg = (props.backgroundColor as string | undefined) ?? "#fafafa";
      const border = (props.borderColor as string | undefined) ?? "#e4e4e7";
      const dividerColor = (props.dividerColor as string | undefined) ?? border;
      const borderRadius = (props.borderRadius as number | undefined) ?? 8;
      const borderWidth = (props.borderWidth as number | undefined) ?? 1;

      const renderRegionKeys = (keys: unknown): ReactNode[] => {
        if (!Array.isArray(keys)) return [];
        return keys.map((childKey) =>
          renderElement(spec, String(childKey), nextAncestors, rootWidth, rootHeight)
        );
      };

      const sections: ReactNode[] = [];
      const headerNodes = renderRegionKeys(props.header);
      const footerNodes = renderRegionKeys(props.footer);

      if (headerNodes.length > 0) {
        sections.push(
          createElement(
            "div",
            {
              key: `${key}__header`,
              style: cleanStyle({
                display: "flex",
                flexDirection: "column",
                gap,
                padding,
                borderBottomWidth: borderWidth,
                borderBottomColor: dividerColor,
                borderBottomStyle: "solid",
              }),
            },
            headerNodes
          )
        );
      }

      sections.push(
        createElement(
          "div",
          {
            key: `${key}__body`,
            style: cleanStyle({
              display: "flex",
              flexDirection: "column",
              gap,
              padding,
              flex: 1,
            }),
          },
          children
        )
      );

      if (footerNodes.length > 0) {
        sections.push(
          createElement(
            "div",
            {
              key: `${key}__footer`,
              style: cleanStyle({
                display: "flex",
                flexDirection: "column",
                gap,
                padding,
                borderTopWidth: borderWidth,
                borderTopColor: dividerColor,
                borderTopStyle: "solid",
              }),
            },
            footerNodes
          )
        );
      }

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "column",
            backgroundColor: bg,
            borderColor: border,
            borderWidth,
            borderStyle: "solid",
            borderRadius,
            boxShadow: props.elevation as string | undefined,
            overflow: "hidden",
            width: props.width as CSSProperties["width"],
            flex: props.flex as CSSProperties["flex"],
          }),
        },
        sections
      );
    }
    case "Table": {
      const rawRows = Array.isArray(props.rows) ? (props.rows as unknown[]) : [];
      const header = Array.isArray(props.header) ? (props.header as unknown[]) : null;
      const striped = props.striped !== false;
      const rowBorders = props.rowBorders !== false;
      const px = (props.cellPaddingX as number | undefined) ?? 12;
      const py = (props.cellPaddingY as number | undefined) ?? 8;
      const fontSize = (props.fontSize as number | undefined) ?? 14;
      const bg = (props.backgroundColor as string | undefined) ?? "#ffffff";
      const headerBg = (props.headerBackgroundColor as string | undefined) ?? "#f4f4f5";
      const headerColor = (props.headerColor as string | undefined) ?? "#18181b";
      const bodyColor = (props.color as string | undefined) ?? "#52525b";
      const border = (props.borderColor as string | undefined) ?? "#e4e4e7";
      const stripe = (props.stripeColor as string | undefined) ?? "#fafafa";
      const borderRadius = (props.borderRadius as number | undefined) ?? 8;
      const borderWidth = (props.borderWidth as number | undefined) ?? 1;

      const cellText = (cell: unknown): string =>
        typeof cell === "object" && cell !== null
          ? String((cell as { text?: unknown }).text ?? "")
          : String(cell);
      const cellAlign = (cell: unknown): CSSProperties["justifyContent"] => {
        const a =
          typeof cell === "object" && cell !== null
            ? ((cell as { align?: unknown }).align as string | undefined)
            : undefined;
        return a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start";
      };
      const cellColor = (cell: unknown): string | undefined =>
        typeof cell === "object" && cell !== null
          ? ((cell as { color?: unknown }).color as string | undefined)
          : undefined;

      const buildCell = (
        cell: unknown,
        cellKey: string,
        opts: { fontWeight: number; color: string }
      ): ReactNode =>
        createElement(
          "div",
          {
            key: cellKey,
            style: cleanStyle({
              display: "flex",
              flex: 1,
              justifyContent: cellAlign(cell),
              paddingTop: py,
              paddingBottom: py,
              paddingLeft: px,
              paddingRight: px,
              fontFamily: FONT_FAMILY,
              fontSize,
              fontWeight: opts.fontWeight,
              color: cellColor(cell) ?? opts.color,
              lineHeight: 1.4,
            }),
          },
          cellText(cell)
        );

      const tableRows: ReactNode[] = [];

      if (header) {
        tableRows.push(
          createElement(
            "div",
            {
              key: `${key}__thead`,
              style: cleanStyle({
                display: "flex",
                flexDirection: "row",
                backgroundColor: headerBg,
                borderBottomWidth: borderWidth,
                borderBottomColor: border,
                borderBottomStyle: "solid",
              }),
            },
            header.map((cell, ci) =>
              buildCell(cell, `${key}__h${ci}`, { fontWeight: 600, color: headerColor })
            )
          )
        );
      }

      rawRows.forEach((row, ri) => {
        const cells: unknown[] = Array.isArray(row)
          ? row
          : Array.isArray((row as { cells?: unknown }).cells)
            ? ((row as { cells: unknown[] }).cells)
            : [];
        const isStriped = striped && ri % 2 === 1;
        const isLast = ri === rawRows.length - 1;
        tableRows.push(
          createElement(
            "div",
            {
              key: `${key}__r${ri}`,
              style: cleanStyle({
                display: "flex",
                flexDirection: "row",
                backgroundColor: isStriped ? stripe : undefined,
                borderBottomWidth: rowBorders && !isLast ? borderWidth : undefined,
                borderBottomColor: rowBorders && !isLast ? border : undefined,
                borderBottomStyle: rowBorders && !isLast ? "solid" : undefined,
              }),
            },
            cells.map((cell, ci) =>
              buildCell(cell, `${key}__r${ri}c${ci}`, { fontWeight: 400, color: bodyColor })
            )
          )
        );
      });

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "column",
            backgroundColor: bg,
            borderColor: border,
            borderWidth,
            borderStyle: "solid",
            borderRadius,
            overflow: "hidden",
          }),
        },
        tableRows
      );
    }
    case "Progress": {
      const value = typeof props.value === "number" ? props.value : 0;
      const max = (props.max as number | undefined) ?? 100;
      const ratio = max > 0 ? value / max : 0;
      const pct = Math.max(0, Math.min(100, ratio * 100));
      const height = (props.height as number | undefined) ?? 8;
      const radius = (props.radius as number | undefined) ?? height / 2;
      const track = (props.trackColor as string | undefined) ?? "#f4f4f5";
      const fill = (props.fillColor as string | undefined) ?? "#4f46e5";
      const label = props.label as string | undefined;
      const showValue = props.showValue === true;
      const labelColor = (props.labelColor as string | undefined) ?? "#52525b";
      const fontSize = (props.fontSize as number | undefined) ?? 13;

      const bar = createElement(
        "div",
        {
          key: `${key}__track`,
          style: cleanStyle({
            display: "flex",
            width: "100%",
            height,
            backgroundColor: track,
            borderRadius: radius,
            overflow: "hidden",
          }),
        },
        createElement("div", {
          key: `${key}__fill`,
          style: cleanStyle({
            display: "flex",
            width: `${pct}%`,
            height: "100%",
            backgroundColor: fill,
            borderRadius: radius,
          }),
        })
      );

      if (!label && !showValue) {
        return createElement(
          "div",
          {
            key,
            style: cleanStyle({
              display: "flex",
              flexDirection: "column",
              width: (props.width as CSSProperties["width"]) ?? "100%",
            }),
          },
          bar
        );
      }

      const caption = createElement(
        "div",
        {
          key: `${key}__label`,
          style: cleanStyle({
            display: "flex",
            flexDirection: "row",
            justifyContent: label && showValue ? "space-between" : "flex-start",
            fontFamily: FONT_FAMILY,
            fontSize,
            color: labelColor,
            marginBottom: 6,
          }),
        },
        [
          createElement("div", { key: `${key}__label_t`, style: { display: "flex" } }, label ?? ""),
          showValue
            ? createElement(
                "div",
                { key: `${key}__label_v`, style: { display: "flex" } },
                `${Math.round(pct)}%`
              )
            : null,
        ]
      );

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            flexDirection: "column",
            width: (props.width as CSSProperties["width"]) ?? "100%",
          }),
        },
        [caption, bar]
      );
    }
    case "PieChart": {
      // Hand-authored SVG pie/donut. Slices are filled arc `path`s inside an
      // <svg>; any center/label text is a normal Satori <div> overlaid on top
      // (Satori rejects SVG <text> nodes, so we never emit them). Slice colors
      // cycle the resolved `color.chart` ramp; a per-slice `color` overrides it.
      const size = (props.size as number | undefined) ?? 200;
      const rawData = Array.isArray(props.data) ? (props.data as unknown[]) : [];
      const data: SliceDatum[] = rawData.map((d) => {
        const rec = (typeof d === "object" && d !== null ? d : {}) as Record<string, unknown>;
        return {
          label: typeof rec.label === "string" ? rec.label : undefined,
          value: typeof rec.value === "number" ? rec.value : 0,
        };
      });

      const ramp = Array.isArray(props.colors)
        ? (props.colors as string[])
        : ["#4f46e5", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#9333ea"];
      const perSliceColor = rawData.map((d) =>
        typeof d === "object" && d !== null
          ? ((d as { color?: unknown }).color as string | undefined)
          : undefined
      );

      const center = { x: size / 2, y: size / 2 };
      const outerRadius = size / 2;
      const donut = props.donut === true || (props.innerRadius as number | undefined) !== undefined;
      const innerRadius = donut
        ? Math.min(
            outerRadius - 1,
            (props.innerRadius as number | undefined) ?? Math.round(outerRadius * 0.6)
          )
        : 0;

      const bg = (props.backgroundColor as string | undefined) ?? "transparent";
      // A gap between slices, drawn as a background-colored stroke on each path.
      const padStroke = (props.padAngle as number | undefined) ?? 0;

      const slices = computeSlices(data);
      const slicePaths: ReactNode[] = [];
      slices.forEach((slice) => {
        if (slice.fraction <= 0) return; // skip zero-value slices, don't crash
        const d = slicePath(center, outerRadius, innerRadius, slice.startAngle, slice.endAngle);
        if (!d) return;
        const fill =
          perSliceColor[slice.index] ?? ramp[slice.index % Math.max(1, ramp.length)] ?? "#4f46e5";
        slicePaths.push(
          createElement("path", {
            key: `${key}__slice${slice.index}`,
            d,
            fill,
            stroke: padStroke > 0 ? bg : undefined,
            strokeWidth: padStroke > 0 ? padStroke : undefined,
          })
        );
      });

      const svg = createElement(
        "svg",
        { key: `${key}__svg`, width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        slicePaths
      );

      // Optional center text (typically for a donut). Overlaid absolutely so the
      // SVG stays a clean vector and the text uses the real font metrics.
      const overlay: ReactNode[] = [];
      const centerLabel = props.centerLabel as string | undefined;
      const centerValue = props.centerValue as string | undefined;
      if (centerLabel || centerValue) {
        const labelNodes: ReactNode[] = [];
        if (centerLabel) {
          labelNodes.push(
            createElement(
              "div",
              {
                key: `${key}__cl`,
                style: cleanStyle({
                  display: "flex",
                  fontFamily: FONT_FAMILY,
                  fontSize: Math.round(size * 0.16),
                  fontWeight: 700,
                  color: (props.centerLabelColor as string | undefined) ?? "#18181b",
                  lineHeight: 1,
                }),
              },
              centerLabel
            )
          );
        }
        if (centerValue) {
          labelNodes.push(
            createElement(
              "div",
              {
                key: `${key}__cv`,
                style: cleanStyle({
                  display: "flex",
                  fontFamily: FONT_FAMILY,
                  fontSize: Math.round(size * 0.075),
                  color: (props.centerValueColor as string | undefined) ?? "#52525b",
                  lineHeight: 1,
                  marginTop: 4,
                }),
              },
              centerValue
            )
          );
        }
        overlay.push(
          createElement(
            "div",
            {
              key: `${key}__center`,
              style: cleanStyle({
                position: "absolute",
                top: 0,
                left: 0,
                width: size,
                height: size,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }),
            },
            labelNodes
          )
        );
      }

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            position: "relative",
            width: size,
            height: size,
            flexShrink: 0,
          }),
        },
        [svg, ...overlay]
      );
    }
    case "ProgressRing": {
      // Circular gauge: a full track `circle` plus a partial progress arc
      // `path`. 0% draws no arc (track only), 100% draws a complete ring (the
      // arc helper splits a 360° sweep so it isn't a degenerate zero-length
      // arc). Center readout is an overlaid Satori <div>, never an SVG <text>.
      const size = (props.size as number | undefined) ?? 160;
      const rawValue = typeof props.value === "number" ? props.value : 0;
      const max = (props.max as number | undefined) ?? 100;
      const ratio = max > 0 ? clamp(rawValue / max, 0, 1) : 0;
      const pct = Math.round(ratio * 100);

      const thickness = (props.thickness as number | undefined) ?? Math.max(6, Math.round(size * 0.1));
      const radius = size / 2 - thickness / 2;
      const center = { x: size / 2, y: size / 2 };
      const startAngle = (props.startAngle as number | undefined) ?? 0;
      const track = (props.trackColor as string | undefined) ?? "#f4f4f5";
      const fill = (props.fillColor as string | undefined) ?? "#4f46e5";
      const rounded = props.rounded !== false;

      const svgChildren: ReactNode[] = [
        createElement("circle", {
          key: `${key}__track`,
          cx: center.x,
          cy: center.y,
          r: radius,
          fill: "none",
          stroke: track,
          strokeWidth: thickness,
        }),
      ];

      // Progress arc — only when there is something to draw (ratio > 0). At
      // ratio === 1 the helper emits a split full-circle arc so it renders.
      if (ratio > 0) {
        const d = arcPath(center, radius, startAngle, startAngle + ratio * 360);
        if (d) {
          svgChildren.push(
            createElement("path", {
              key: `${key}__fill`,
              d,
              fill: "none",
              stroke: fill,
              strokeWidth: thickness,
              strokeLinecap: rounded ? "round" : "butt",
            })
          );
        }
      }

      const svg = createElement(
        "svg",
        { key: `${key}__svg`, width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        svgChildren
      );

      const labelText =
        (props.label as string | undefined) ?? (props.showValue === true ? `${pct}%` : undefined);
      const sublabel = props.sublabel as string | undefined;

      const overlay: ReactNode[] = [];
      if (labelText || sublabel) {
        const labelNodes: ReactNode[] = [];
        if (labelText) {
          labelNodes.push(
            createElement(
              "div",
              {
                key: `${key}__lbl`,
                style: cleanStyle({
                  display: "flex",
                  fontFamily: FONT_FAMILY,
                  fontSize: Math.round(size * 0.2),
                  fontWeight: 700,
                  color: (props.labelColor as string | undefined) ?? "#18181b",
                  lineHeight: 1,
                }),
              },
              labelText
            )
          );
        }
        if (sublabel) {
          labelNodes.push(
            createElement(
              "div",
              {
                key: `${key}__sub`,
                style: cleanStyle({
                  display: "flex",
                  fontFamily: FONT_FAMILY,
                  fontSize: Math.round(size * 0.09),
                  color: (props.sublabelColor as string | undefined) ?? "#52525b",
                  lineHeight: 1,
                  marginTop: 4,
                }),
              },
              sublabel
            )
          );
        }
        overlay.push(
          createElement(
            "div",
            {
              key: `${key}__center`,
              style: cleanStyle({
                position: "absolute",
                top: 0,
                left: 0,
                width: size,
                height: size,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }),
            },
            labelNodes
          )
        );
      }

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({
            display: "flex",
            position: "relative",
            width: size,
            height: size,
            flexShrink: 0,
          }),
        },
        [svg, ...overlay]
      );
    }
    case "BarChart": {
      // Vertical bars in an inline <svg>; gridlines are thin <line>s, bars are
      // rounded <rect>s cycling the resolved chart ramp. Axis + value labels are
      // div overlays (Satori has no SVG <text>), stacked around the plot.
      const width = (props.width as number | undefined) ?? 360;
      const height = (props.height as number | undefined) ?? 200;
      const values = seriesValues(props.data);
      const labels = seriesLabels(props.data);
      const ramp = resolveRamp(props.colors);
      const barColor = props.barColor as string | undefined;
      const showGrid = props.showGrid !== false;
      const showAxisLabels = props.showAxisLabels !== false && labels.some((l) => l);
      const showValueLabels = props.showValueLabels !== false;
      const gridColor = (props.gridColor as string | undefined) ?? "#e4e4e7";
      const labelColor = (props.labelColor as string | undefined) ?? "#71717a";
      const barRadius = (props.barRadius as number | undefined) ?? 3;
      const labelFont = 11;

      // Reserve a left gutter for Y labels and a bottom strip for X labels.
      const leftGutter = showValueLabels ? 34 : 0;
      const bottomStrip = showAxisLabels ? labelFont + 8 : 0;
      const svgWidth = width - leftGutter;
      const svgHeight = height - bottomStrip;
      const domain = domainFromValues(values, { zeroBaseline: true });
      const plot = plotBox(svgWidth, svgHeight, { top: 6, right: 4, bottom: 4, left: 2 });
      const ticks = axisTicks(domain, plot, 4);

      const svgChildren: ReactNode[] = [];
      if (showGrid) {
        ticks.forEach((tick, i) =>
          svgChildren.push(
            createElement("line", {
              key: `${key}__grid${i}`,
              x1: plot.x,
              y1: tick.position,
              x2: plot.x + plot.width,
              y2: tick.position,
              stroke: gridColor,
              strokeWidth: 1,
            })
          )
        );
      }
      barRects(values, domain, plot, { barRatio: (props.barRatio as number | undefined) ?? 0.62 }).forEach(
        (r) =>
          svgChildren.push(
            createElement("rect", {
              key: `${key}__bar${r.index}`,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              rx: Math.min(barRadius, r.width / 2),
              fill: barColor ?? rampColor(ramp, r.index),
            })
          )
      );

      const svg = createElement(
        "svg",
        { key: `${key}__svg`, width: svgWidth, height: svgHeight, viewBox: `0 0 ${svgWidth} ${svgHeight}` },
        svgChildren
      );

      // Plot row: [Y labels gutter][svg]. Y labels are absolute over the gutter.
      const plotRow = createElement(
        "div",
        {
          key: `${key}__plotrow`,
          style: cleanStyle({ display: "flex", flexDirection: "row", width, height: svgHeight }),
        },
        [
          leftGutter > 0
            ? createElement(
                "div",
                {
                  key: `${key}__ygutter`,
                  style: cleanStyle({
                    display: "flex",
                    position: "relative",
                    width: leftGutter,
                    height: svgHeight,
                  }),
                },
                valueTickLabels(key, ticks, labelColor, labelFont, leftGutter)
              )
            : null,
          createElement("div", { key: `${key}__svgwrap`, style: { display: "flex" } }, svg),
        ]
      );

      const rows: ReactNode[] = [plotRow];
      if (showAxisLabels) {
        rows.push(
          createElement(
            "div",
            {
              key: `${key}__xrow`,
              style: cleanStyle({ display: "flex", flexDirection: "row", width, marginTop: 6 }),
            },
            [
              leftGutter > 0
                ? createElement("div", { key: `${key}__xspace`, style: { display: "flex", width: leftGutter } })
                : null,
              createElement(
                "div",
                { key: `${key}__xwrap`, style: cleanStyle({ display: "flex", width: svgWidth }) },
                bandAxisLabels(key, labels, labelColor, labelFont)
              ),
            ]
          )
        );
      }

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({ display: "flex", flexDirection: "column", width, flexShrink: 0 }),
        },
        rows
      );
    }
    case "LineChart": {
      // One or more polylines/paths in an inline <svg> over a shared axis, with
      // optional gridlines, points, and a single-series area fill. All labels
      // are div overlays. Points align edge-to-edge across the plot width.
      const width = (props.width as number | undefined) ?? 420;
      const height = (props.height as number | undefined) ?? 220;

      // Normalize to a list of { data, color? } series (accept the `data`
      // single-series shorthand). Colors already resolved to literals.
      const rawSeries = Array.isArray(props.series)
        ? (props.series as Array<Record<string, unknown>>)
        : Array.isArray(props.data)
          ? [{ data: props.data }]
          : [];
      const ramp = resolveRamp(props.colors);
      const strokeWidth = (props.strokeWidth as number | undefined) ?? 2;
      const smooth = props.smooth === true;
      const showPoints = props.showPoints === true;
      const showArea = props.showArea === true && rawSeries.length === 1;
      const showGrid = props.showGrid !== false;
      const showValueLabels = props.showValueLabels !== false;
      const gridColor = (props.gridColor as string | undefined) ?? "#e4e4e7";
      const labelColor = (props.labelColor as string | undefined) ?? "#71717a";
      const labelFont = 11;

      const axisLabels = Array.isArray(props.axisLabels)
        ? (props.axisLabels as string[])
        : seriesLabels(rawSeries[0]?.data).map((l) => l ?? "");
      const hasAxisLabels = props.showAxisLabels !== false && axisLabels.some((l) => l);

      const leftGutter = showValueLabels ? 34 : 0;
      const bottomStrip = hasAxisLabels ? labelFont + 8 : 0;
      const svgWidth = width - leftGutter;
      const svgHeight = height - bottomStrip;

      // Domain spans every series so lines share one honest scale.
      const allValues = rawSeries.flatMap((s) => seriesValues(s.data));
      const domain = domainFromValues(allValues, { zeroBaseline: false });
      const plot = plotBox(svgWidth, svgHeight, { top: 8, right: 8, bottom: 6, left: 4 });
      const ticks = axisTicks(domain, plot, 4);
      const baselineY = linearScale(domain, { start: plot.y + plot.height, end: plot.y })(
        domain.min <= 0 && domain.max >= 0 ? 0 : domain.min
      );

      const svgChildren: ReactNode[] = [];
      if (showGrid) {
        ticks.forEach((tick, i) =>
          svgChildren.push(
            createElement("line", {
              key: `${key}__grid${i}`,
              x1: plot.x,
              y1: tick.position,
              x2: plot.x + plot.width,
              y2: tick.position,
              stroke: gridColor,
              strokeWidth: 1,
            })
          )
        );
      }

      rawSeries.forEach((series, si) => {
        const values = seriesValues(series.data);
        const points: Point[] = seriesPoints(values, domain, plot, { bandCenter: false });
        if (points.length === 0) return;
        const color = (series.color as string | undefined) ?? rampColor(ramp, si);

        if (showArea) {
          svgChildren.push(
            createElement("path", {
              key: `${key}__area${si}`,
              d: areaPath(points, round(baselineY), smooth),
              fill: color,
              fillOpacity: 0.12,
              stroke: "none",
            })
          );
        }

        svgChildren.push(
          smooth
            ? createElement("path", {
                key: `${key}__line${si}`,
                d: smoothPath(points),
                fill: "none",
                stroke: color,
                strokeWidth,
                strokeLinejoin: "round",
                strokeLinecap: "round",
              })
            : createElement("polyline", {
                key: `${key}__line${si}`,
                points: pointsToAttr(points),
                fill: "none",
                stroke: color,
                strokeWidth,
                strokeLinejoin: "round",
                strokeLinecap: "round",
              })
        );

        if (showPoints) {
          points.forEach((p, pi) =>
            svgChildren.push(
              createElement("circle", {
                key: `${key}__pt${si}_${pi}`,
                cx: p.x,
                cy: p.y,
                r: strokeWidth + 1,
                fill: color,
              })
            )
          );
        }
      });

      const svg = createElement(
        "svg",
        { key: `${key}__svg`, width: svgWidth, height: svgHeight, viewBox: `0 0 ${svgWidth} ${svgHeight}` },
        svgChildren
      );

      const plotRow = createElement(
        "div",
        {
          key: `${key}__plotrow`,
          style: cleanStyle({ display: "flex", flexDirection: "row", width, height: svgHeight }),
        },
        [
          leftGutter > 0
            ? createElement(
                "div",
                {
                  key: `${key}__ygutter`,
                  style: cleanStyle({
                    display: "flex",
                    position: "relative",
                    width: leftGutter,
                    height: svgHeight,
                  }),
                },
                valueTickLabels(key, ticks, labelColor, labelFont, leftGutter)
              )
            : null,
          createElement("div", { key: `${key}__svgwrap`, style: { display: "flex" } }, svg),
        ]
      );

      const rows: ReactNode[] = [plotRow];
      if (hasAxisLabels) {
        rows.push(
          createElement(
            "div",
            {
              key: `${key}__xrow`,
              style: cleanStyle({ display: "flex", flexDirection: "row", width, marginTop: 6 }),
            },
            [
              leftGutter > 0
                ? createElement("div", { key: `${key}__xspace`, style: { display: "flex", width: leftGutter } })
                : null,
              createElement(
                "div",
                { key: `${key}__xwrap`, style: cleanStyle({ display: "flex", width: svgWidth }) },
                bandAxisLabels(key, axisLabels, labelColor, labelFont)
              ),
            ]
          )
        );
      }

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({ display: "flex", flexDirection: "column", width, flexShrink: 0 }),
        },
        rows
      );
    }
    case "Sparkline": {
      // A bare, axis-less trend line for inline use. No gridlines/labels; just a
      // tightly-fitted polyline/path, optional area fill, and an end dot. Fits
      // its data (no forced zero) so the shape reads at small sizes.
      const width = (props.width as number | undefined) ?? 120;
      const height = (props.height as number | undefined) ?? 32;
      const values = seriesValues(props.data);
      const color = (props.color as string | undefined) ?? "#4f46e5";
      const strokeWidth = (props.strokeWidth as number | undefined) ?? 2;
      const smooth = props.smooth === true;
      const showArea = props.showArea !== false;
      const showEndDot = props.showEndDot !== false;
      const areaColor = (props.areaColor as string | undefined) ?? color;
      const endDotColor = (props.endDotColor as string | undefined) ?? color;

      const domain = domainFromValues(values, { zeroBaseline: false });
      // Inset by the stroke/dot radius so the line never clips at the edges.
      const inset = Math.max(strokeWidth, showEndDot ? strokeWidth + 2 : strokeWidth);
      const plot = plotBox(width, height, { top: inset, right: inset, bottom: inset, left: inset });
      const points: Point[] = seriesPoints(values, domain, plot, { bandCenter: false });

      const svgChildren: ReactNode[] = [];
      if (points.length > 0) {
        if (showArea) {
          svgChildren.push(
            createElement("path", {
              key: `${key}__area`,
              d: areaPath(points, plot.y + plot.height, smooth),
              fill: areaColor,
              fillOpacity: 0.15,
              stroke: "none",
            })
          );
        }
        svgChildren.push(
          smooth
            ? createElement("path", {
                key: `${key}__line`,
                d: smoothPath(points),
                fill: "none",
                stroke: color,
                strokeWidth,
                strokeLinejoin: "round",
                strokeLinecap: "round",
              })
            : createElement("polyline", {
                key: `${key}__line`,
                points: pointsToAttr(points),
                fill: "none",
                stroke: color,
                strokeWidth,
                strokeLinejoin: "round",
                strokeLinecap: "round",
              })
        );
        if (showEndDot) {
          const last = points[points.length - 1];
          svgChildren.push(
            createElement("circle", {
              key: `${key}__enddot`,
              cx: last.x,
              cy: last.y,
              r: strokeWidth + 1,
              fill: endDotColor,
            })
          );
        }
      }

      const svg = createElement(
        "svg",
        { key: `${key}__svg`, width, height, viewBox: `0 0 ${width} ${height}` },
        svgChildren
      );

      return createElement(
        "div",
        {
          key,
          style: cleanStyle({ display: "flex", width, height, flexShrink: 0 }),
        },
        svg
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
