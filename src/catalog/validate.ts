import {
  alertPropsSchema,
  avatarPropsSchema,
  badgePropsSchema,
  barChartPropsSchema,
  boxPropsSchema,
  cardPropsSchema,
  dividerPropsSchema,
  framePropsSchema,
  gridPropsSchema,
  headingPropsSchema,
  iconPropsSchema,
  lineChartPropsSchema,
  listPropsSchema,
  metricPropsSchema,
  pieChartPropsSchema,
  progressPropsSchema,
  progressRingPropsSchema,
  rowPropsSchema,
  spacerPropsSchema,
  sparklinePropsSchema,
  stackPropsSchema,
  tablePropsSchema,
  textPropsSchema,
} from "./schema";
import { catalog } from "./index";
import { isIconName } from "./icons";
import type { Spec, UIElement } from "@json-render/core";
import type { z } from "zod";

export interface ValidationSuccess {
  ok: true;
  tree: Spec;
}

export interface ValidationError {
  ok: false;
  error: {
    code: "VALIDATION_ERROR";
    path: string;
    message: string;
  };
}

export type ValidationResult = ValidationSuccess | ValidationError;

const componentPropsSchemas = {
  Frame: framePropsSchema,
  Box: boxPropsSchema,
  Stack: stackPropsSchema,
  Row: rowPropsSchema,
  Text: textPropsSchema,
  Heading: headingPropsSchema,
  Icon: iconPropsSchema,
  Grid: gridPropsSchema,
  Spacer: spacerPropsSchema,
  Divider: dividerPropsSchema,
  Badge: badgePropsSchema,
  Avatar: avatarPropsSchema,
  Alert: alertPropsSchema,
  List: listPropsSchema,
  Card: cardPropsSchema,
  Table: tablePropsSchema,
  Progress: progressPropsSchema,
  BarChart: barChartPropsSchema,
  LineChart: lineChartPropsSchema,
  Sparkline: sparklinePropsSchema,
  Metric: metricPropsSchema,
  PieChart: pieChartPropsSchema,
  ProgressRing: progressRingPropsSchema,
} as const;

const catalogComponentNames = Object.freeze(
  Object.keys(componentPropsSchemas) as string[]
);

type ComponentName = keyof typeof componentPropsSchemas;

function isComponentName(type: unknown): type is ComponentName {
  return typeof type === "string" && type in componentPropsSchemas;
}

function pathToString(path: PropertyKey[]): string {
  if (path.length === 0) return ".";
  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : `.${String(segment)}`
    )
    .join("");
}

function validationError(path: string, message: string): ValidationError {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", path, message },
  };
}

function zodErrorToResult(
  error: z.ZodError<unknown>,
  basePath: string
): ValidationError {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return validationError(basePath, "Invalid component props.");
  }

  const issuePath = pathToString(firstIssue.path);
  return validationError(`${basePath}${issuePath}`, firstIssue.message);
}

function validateElementProps(
  key: string,
  element: UIElement<string, Record<string, unknown>>
): ValidationResult | undefined {
  const type = element.type;
  if (!isComponentName(type)) {
    return validationError(
      `.elements.${key}.type`,
      `Invalid option: expected one of ${catalogComponentNames
        .map((name) => `"${name}"`)
        .join("|")}`
    );
  }

  const propsSchema = componentPropsSchemas[type];
  const propsResult = propsSchema.safeParse(element.props);
  if (!propsResult.success) {
    return zodErrorToResult(propsResult.error, `.elements.${key}.props`);
  }

  const iconError = validateIconNames(key, type, element.props);
  if (iconError) return iconError;

  return undefined;
}

/**
 * Semantic icon-name validation (MH14). The Zod schema only proves `name` is a
 * string; here we confirm it resolves to a real free-tier icon so an unknown
 * name returns a structured VALIDATION_ERROR (per MH10) instead of crashing or
 * silently rendering nothing. Covers the standalone `Icon.name` prop and the
 * optional `iconName` slot on Badge/Alert/Metric (a bare string or a
 * `{ name }` object).
 */
function validateIconNames(
  key: string,
  type: ComponentName,
  props: Record<string, unknown>
): ValidationError | undefined {
  const badName = (name: string, path: string): ValidationError =>
    validationError(
      `.elements.${key}.props${path}`,
      `Unknown icon name "${name}". Icon names are kebab-case HugeIcons free-tier names (e.g. "search", "notification-03", "arrow-right-01").`
    );

  if (type === "Icon") {
    const name = props.name;
    if (typeof name === "string" && !isIconName(name)) return badName(name, ".name");
    return undefined;
  }

  const slot = props.iconName;
  if (slot === undefined || slot === null) return undefined;
  if (typeof slot === "string") {
    if (!isIconName(slot)) return badName(slot, ".iconName");
  } else if (typeof slot === "object") {
    const name = (slot as { name?: unknown }).name;
    if (typeof name === "string" && !isIconName(name)) return badName(name, ".iconName.name");
  }

  return undefined;
}

const LIMITS = {
  maxElements: 2_000,
  maxTreeDepth: 50,
  maxStringLength: 10_000,
  maxChartPoints: 1_000,
  // All arrays share the chart point ceiling. This covers every collection a
  // component can accept (including child references and composite props)
  // without making the renderer's work unbounded.
  maxArrayLength: 1_000,
} as const;

type SpecElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
};

/**
 * These ceilings leave room for substantial dashboard payloads (including the
 * existing 500-cell Grid exercise) while bounding memory and renderer work for
 * untrusted MCP inputs.
 */
function validateResourceLimits(
  elements: Record<string, SpecElement>
): ValidationError | undefined {
  if (Object.keys(elements).length > LIMITS.maxElements) {
    return validationError(
      ".elements",
      `Spec exceeds the maximum of ${LIMITS.maxElements} elements.`
    );
  }

  for (const [key, element] of Object.entries(elements)) {
    const oversizedString = findOversizedString(element.props);
    if (oversizedString) {
      return validationError(
        `.elements.${key}.props${oversizedString.path}`,
        `String exceeds the maximum length of ${LIMITS.maxStringLength} characters.`
      );
    }

    const chartDataError = findOversizedChartData(element.props);
    if (chartDataError) {
      return validationError(
        `.elements.${key}.props${chartDataError}`,
        `Chart data exceeds the maximum of ${LIMITS.maxChartPoints} points per series.`
      );
    }
  }

  return undefined;
}

/**
 * Validate collection sizes before Zod traverses component props. This is
 * deliberately iterative: MCP callers supply untrusted JSON, and deeply
 * nested objects or arrays must not consume the JavaScript call stack.
 */
function validateArrayLengths(spec: unknown): ValidationError | undefined {
  const pending: Array<{ value: unknown; path: string }> = [{ value: spec, path: "" }];
  const visited = new WeakSet<object>();

  while (pending.length > 0) {
    const current = pending.pop()!;
    const value = current.value;

    if (!value || typeof value !== "object") continue;
    if (visited.has(value)) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length > LIMITS.maxArrayLength) {
        return validationError(
          current.path || ".",
          `Array exceeds the maximum length of ${LIMITS.maxArrayLength}.`
        );
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: value[index], path: `${current.path}[${index}]` });
      }
      continue;
    }

    for (const [key, item] of Object.entries(value)) {
      pending.push({ value: item, path: `${current.path}.${key}` });
    }
  }

  return undefined;
}

function findOversizedString(value: unknown): { path: string } | undefined {
  const pending: Array<{ value: unknown; path: string }> = [{ value, path: "" }];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (typeof current.value === "string") {
      if (current.value.length > LIMITS.maxStringLength) return { path: current.path };
      continue;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((item, index) => {
        pending.push({ value: item, path: `${current.path}[${index}]` });
      });
    } else if (current.value && typeof current.value === "object") {
      for (const [key, item] of Object.entries(current.value)) {
        pending.push({ value: item, path: `${current.path}.${key}` });
      }
    }
  }

  return undefined;
}

function findOversizedChartData(props: Record<string, unknown>): string | undefined {
  const inspect = (value: unknown, path: string): string | undefined => {
    if (Array.isArray(value) && value.length > LIMITS.maxChartPoints) return path;
    return undefined;
  };

  const directData = inspect(props.data, ".data");
  if (directData) return directData;

  if (Array.isArray(props.series)) {
    if (props.series.length > LIMITS.maxChartPoints) return ".series";
    for (const [index, series] of props.series.entries()) {
      if (series && typeof series === "object") {
        const error = inspect((series as Record<string, unknown>).data, `.series[${index}].data`);
        if (error) return error;
      }
    }
  }

  if (props.sparkline && typeof props.sparkline === "object") {
    return inspect((props.sparkline as Record<string, unknown>).data, ".sparkline.data");
  }

  return undefined;
}

function elementReferences(element: SpecElement): Array<{ key: string; path: string }> {
  const references = (element.children ?? []).map((key, index) => ({
    key,
    path: `.children[${index}]`,
  }));

  if (element.type === "Card") {
    for (const region of ["header", "footer"] as const) {
      const keys = element.props[region];
      if (Array.isArray(keys)) {
        keys.forEach((key, index) => {
          if (typeof key === "string") references.push({ key, path: `.props.${region}[${index}]` });
        });
      }
    }
  }

  return references;
}

function validateElementGraph(root: string, elements: Record<string, SpecElement>): ValidationError | undefined {
  if (!elements[root]) {
    return validationError(".root", `Root element "${root}" does not exist.`);
  }

  const states = new Map<string, "visiting" | "visited">();
  const pending: Array<{ key: string; depth: number; exiting: boolean }> = [
    { key: root, depth: 1, exiting: false },
  ];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.exiting) {
      states.set(current.key, "visited");
      continue;
    }
    if (current.depth > LIMITS.maxTreeDepth) {
      return validationError(
        `.elements.${current.key}`,
        `Element tree exceeds the maximum depth of ${LIMITS.maxTreeDepth}.`
      );
    }

    const state = states.get(current.key);
    if (state === "visiting") {
      return validationError(`.elements.${current.key}`, "Element references form a cycle.");
    }
    if (state === "visited") continue;

    const element = elements[current.key];
    if (!element) {
      return validationError(".root", `Root element "${current.key}" does not exist.`);
    }

    states.set(current.key, "visiting");
    pending.push({ ...current, exiting: true });
    for (const reference of elementReferences(element).reverse()) {
      if (!elements[reference.key]) {
        return validationError(
          `.elements.${current.key}${reference.path}`,
          `Referenced element "${reference.key}" does not exist.`
        );
      }
      pending.push({ key: reference.key, depth: current.depth + 1, exiting: false });
    }
  }

  return undefined;
}

function validateFrameDimensions(
  elements: Record<string, SpecElement>
): ValidationError | undefined {
  for (const [key, element] of Object.entries(elements)) {
    if (element.type !== "Frame") continue;
    for (const dimension of ["width", "height"] as const) {
      const value = element.props[dimension];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return validationError(
          `.elements.${key}.props.${dimension}`,
          "Frame dimensions must be finite positive numbers."
        );
      }
    }
  }

  return undefined;
}

export function validateSpec(spec: unknown): ValidationResult {
  const arrayLengthError = validateArrayLengths(spec);
  if (arrayLengthError) return arrayLengthError;

  const catalogResult = catalog.validate(spec);

  if (!catalogResult.success) {
    const firstIssue = catalogResult.error?.issues[0];
    if (!firstIssue) {
      return validationError(".", "Validation failed for an unknown reason.");
    }
    return validationError(
      pathToString(firstIssue.path),
      firstIssue.message
    );
  }

  const parsed = catalogResult.data as Spec;
  const elements = parsed.elements as Record<string, SpecElement>;
  for (const [key, element] of Object.entries(elements)) {
    const propsError = validateElementProps(key, element);
    if (propsError) {
      return propsError;
    }
  }

  const limitsError = validateResourceLimits(elements);
  if (limitsError) return limitsError;

  const dimensionsError = validateFrameDimensions(elements);
  if (dimensionsError) return dimensionsError;

  const graphError = validateElementGraph(parsed.root, elements);
  if (graphError) return graphError;

  return { ok: true, tree: parsed };
}
