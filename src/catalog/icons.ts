/**
 * HugeIcons free-tier icon lookup (MH14, Wave 9).
 *
 * `@hugeicons/core-free-icons` exports every icon as an `IconSvgObject` — an
 * array of `[tagName, attributes]` tuples describing the icon's SVG child
 * shapes (only `path`, `circle`, `rect`, `ellipse` are ever used, all of which
 * Satori supports). Each icon is exported three times under the SAME data
 * reference: `SearchIcon`, `SearchFreeIcons`, and the bare `Search`. We consume
 * the canonical `*Icon` exports directly — no `@hugeicons/react` component, no
 * font, no CDN fetch, no credentials — and emit the raw path data into our own
 * JSX-for-Satori element tree, exactly like the hand-authored chart components.
 *
 * ## Naming convention (the string agents reference an icon by)
 *
 * Each `<Name>Icon` export is normalized to a lowercase kebab-case name by
 * stripping the trailing `Icon` and inserting `-` at camelCase / letter↔digit /
 * acronym boundaries:
 *
 *   SearchIcon            -> "search"
 *   Notification03Icon    -> "notification-03"
 *   ArrowRight01Icon      -> "arrow-right-01"
 *   UserGroupIcon         -> "user-group"
 *   CheckmarkCircle02Icon -> "checkmark-circle-02"
 *   Pdf01Icon             -> "pdf-01"
 *
 * The map is built once at module load. Names are deterministic and stable.
 * In the rare event two exports normalize to the same string (only 2 such pairs
 * exist in the whole set, from `AZ` vs `Az` casing), the first in stable
 * alphabetical export order keeps the clean name and the second is suffixed
 * `-2`, so every icon stays uniquely reachable.
 */

import * as FreeIcons from "@hugeicons/core-free-icons";

/** One SVG child node of an icon: `[tagName, attributes]`. */
export type IconNode = [string, Record<string, unknown>];
/** The raw icon data shape exported by `@hugeicons/core-free-icons`. */
export type IconSvgObject = IconNode[];

/**
 * Normalize a `<Name>Icon` export identifier to its kebab-case lookup name.
 * Exported for tests and for the SKILL.md generation step (so the documented
 * names are derived from the exact same function that builds the runtime map).
 */
export function normalizeIconName(exportName: string): string {
  return exportName
    .replace(/Icon$/, "")
    // acronym run followed by a new word: "ABCDef" -> "ABC-Def"
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    // lower/digit -> Upper: "aB" -> "a-B"
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    // letter -> digit: "a1" -> "a-1"
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

function isIconData(value: unknown): value is IconSvgObject {
  return (
    Array.isArray(value) &&
    value.every(
      (node) =>
        Array.isArray(node) &&
        typeof node[0] === "string" &&
        typeof node[1] === "object" &&
        node[1] !== null
    )
  );
}

/**
 * Build the `name -> IconSvgObject` map once. We iterate the canonical `*Icon`
 * exports in stable (alphabetical) key order so collision resolution is
 * deterministic across runs.
 */
function buildIconMap(): Map<string, IconSvgObject> {
  const map = new Map<string, IconSvgObject>();
  const exportNames = Object.keys(FreeIcons as Record<string, unknown>)
    .filter((name) => name.endsWith("Icon") && name !== "Icon")
    .sort();

  for (const exportName of exportNames) {
    const data = (FreeIcons as Record<string, unknown>)[exportName];
    if (!isIconData(data)) continue;

    let name = normalizeIconName(exportName);
    if (map.has(name)) {
      // Deterministic de-dupe for the (2) casing collisions; keep both reachable.
      let suffix = 2;
      while (map.has(`${name}-${suffix}`)) suffix += 1;
      name = `${name}-${suffix}`;
    }
    map.set(name, data);
  }

  return map;
}

let iconMap: Map<string, IconSvgObject> | undefined;

function getMap(): Map<string, IconSvgObject> {
  iconMap ??= buildIconMap();
  return iconMap;
}

/** True if `name` resolves to a known free-tier icon. */
export function isIconName(name: string): boolean {
  return getMap().has(name);
}

/** Resolve an icon name to its raw SVG node data, or `undefined` if unknown. */
export function getIconData(name: string): IconSvgObject | undefined {
  return getMap().get(name);
}

/** The full sorted list of valid icon names. Used by validation and docs. */
export function iconNames(): string[] {
  return [...getMap().keys()].sort();
}

/** The number of distinct icons available (for discovery / diagnostics). */
export function iconCount(): number {
  return getMap().size;
}
