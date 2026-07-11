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
import type { Spec, UIElement } from "@json-render/core";
import type { z } from "zod";

export interface ValidationSuccess {
  ok: true;
  tree: Spec;
}

export interface ValidationError {
  ok: false;
  error: {
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
    error: { path, message },
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

  return undefined;
}

export function validateSpec(spec: unknown): ValidationResult {
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
  for (const [key, element] of Object.entries(parsed.elements)) {
    const propsError = validateElementProps(key, element);
    if (propsError) {
      return propsError;
    }
  }

  return { ok: true, tree: parsed };
}
