/**
 * Describes how to produce a single output field from one or more raw columns.
 * - When `columns` has one entry it is a direct mapping.
 * - When `columns` has multiple entries, `separators[i]` is inserted between
 *   columns[i] and columns[i+1]. Missing entries default to "".
 *   e.g. columns=["scheme","host","path"], separators=["://",""] → "https://example.com/old-page"
 */
export interface ColumnFieldSpec {
  columns: string[];
  /** Per-join separators. separators[i] goes between columns[i] and columns[i+1]. */
  separators?: string[];
}

/** Resolve a ColumnFieldSpec against a raw row into a string value. */
function resolveSpec(
  spec: ColumnFieldSpec,
  row: Record<string, string>,
): string {
  return spec.columns.reduce((acc, col, i) => {
    const sep = i === 0 ? "" : (spec.separators?.[i - 1] ?? "");
    return acc + sep + (row[col] ?? "");
  }, "");
}

/**
 * A simple column mapping created by the user in the Column Mapping dialog.
 * Each field can map to a single column or a combination of columns.
 */
export interface ColumnMapping {
  /** Column(s) to combine into the redirect source */
  source: ColumnFieldSpec;
  /** Column(s) to combine into the redirect destination */
  destination: ColumnFieldSpec;
  /** Column to use as the status code, or null to use the default */
  statusCode: string | null;
  /** Default status code when `statusCode` is null or the column value is empty */
  defaultStatusCode?: string;
}

/**
 * Applies a user-defined ColumnMapping to raw parsed data, producing rows with
 * the standard `source`, `destination`, and `statusCode` fields.
 */
export function applyColumnMapping(
  rawData: Record<string, string>[],
  mapping: ColumnMapping,
): { data: Record<string, string>[]; headers: string[] } {
  const mapped = rawData.map((row) => ({
    source: resolveSpec(mapping.source, row),
    destination: resolveSpec(mapping.destination, row),
    statusCode:
      (mapping.statusCode ? row[mapping.statusCode] : undefined) ||
      mapping.defaultStatusCode ||
      "308",
  }));
  return { data: mapped, headers: [...STANDARD_HEADERS] };
}

/** User-configurable options that modify how a preset's transform behaves. */
export type PresetOptions = Record<string, boolean | string>;

/**
 * A preset maps known CSV formats to standard redirect fields.
 *
 * Simple presets use `columns` to map field names.
 * Complex presets (like Akamai) can define `preprocess` to transform raw CSV
 * text before parsing, and `transform` to do custom row-level mapping.
 */
export interface CsvPreset {
  id: string;
  name: string;
  description: string;
  /** Strip comment lines, frontmatter, etc. before PapaParse runs. */
  preprocess?: (raw: string) => string;
  /** Custom row-level mapping. When defined, `columns` is ignored.
   *  Can return a single row, multiple rows (for expansion), or null to skip.
   *  Receives optional user-configurable options as the second argument. */
  transform?: (
    row: Record<string, string>,
    options?: PresetOptions,
  ) =>
    | { source: string; destination: string; statusCode: string }
    | { source: string; destination: string; statusCode: string }[]
    | null;
  /** Expected columns the preset checks for during mismatch detection. */
  expectedColumns?: string[];
  /** Simple column mapping — used when `transform` is not defined. */
  columns?: {
    source: string;
    destination: string;
    statusCode?: string;
  };
  defaultStatusCode?: string;
  /** Declarative option definitions shown as controls in the mapping dialog. */
  optionDefs?: PresetOptionDef[];
}

/** Describes a user-facing toggle or input shown in the mapping dialog for a preset. */
export interface PresetOptionDef {
  key: string;
  label: string;
  description?: string;
  type: "boolean";
  defaultValue: boolean;
}

function htaccessTransformRows(
  raw: string,
): { source: string; destination: string; statusCode: string }[] {
  const rows: { source: string; destination: string; statusCode: string }[] =
    [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    // RewriteRule ^old$ /new [R=301,L]
    const rewriteMatch = trimmed.match(
      /^RewriteRule\s+\^(.+?)\$\s+(\S+)\s+\[R=(\d{3})/,
    );
    if (rewriteMatch) {
      const [, source, destination, code] = rewriteMatch;
      rows.push({ source: `/${source}`, destination, statusCode: code });
      continue;
    }

    // Redirect 301 /old /new
    const redirectMatch = trimmed.match(/^Redirect\s+(\d{3})\s+(\S+)\s+(\S+)/);
    if (redirectMatch) {
      const [, code, source, destination] = redirectMatch;
      rows.push({ source, destination, statusCode: code });
    }
  }

  return rows;
}

export const CSV_PRESETS: CsvPreset[] = [
  {
    id: "standard",
    name: "Standard CSV",
    description: "source, destination, statusCode columns",
    columns: {
      source: "source",
      destination: "destination",
      statusCode: "statusCode",
    },
  },
  {
    id: "htaccess",
    name: ".htaccess",
    description: "Apache RewriteRule and Redirect directives",
    preprocess: (raw) => {
      // Convert .htaccess directives into CSV text for PapaParse
      const rows = htaccessTransformRows(raw);
      return [
        "source,destination,statusCode",
        ...rows.map((r) => `${r.source},${r.destination},${r.statusCode}`),
      ].join("\n");
    },
  },
  {
    id: "akamai",
    name: "Akamai Edge Redirector",
    description: "frontmatter + scheme/host/path columns",
    expectedColumns: ["path", "result.redirectURL", "result.statusCode"],
    preprocess: (raw) =>
      raw
        .split("\n")
        .filter((line) => !line.startsWith("#"))
        .join("\n"),
    transform: (row) => {
      const scheme = row["scheme"] || "https";
      const host = row["host"];
      const pathField = row["path"] || "";
      const matchUrl = row["matchURL"];
      const destination = row["result.redirectURL"];
      const statusCode = row["result.statusCode"] || "301";

      if (!destination) return null;

      if (matchUrl) {
        return { source: matchUrl, destination, statusCode };
      }

      if (!host || !pathField) return null;

      // Path field may contain space-separated variants (e.g. "/foo /foo/").
      // Expand each into its own row so the analysis can detect
      // trailing-slash duplicates and conflicts.
      const paths = pathField.trim().split(/\s+/);
      const buildSource = (p: string) => `${scheme}://${host}${p}`;

      if (paths.length === 1) {
        return { source: buildSource(paths[0]), destination, statusCode };
      }
      return paths.map((p) => ({
        source: buildSource(p),
        destination,
        statusCode,
      }));
    },
  },
];

export const STANDARD_HEADERS = [
  "source",
  "destination",
  "statusCode",
] as const;

export function applyPreset(
  rawData: Record<string, string>[],
  rawHeaders: string[],
  preset: CsvPreset,
  options?: PresetOptions,
): { data: Record<string, string>[]; headers: string[] } {
  // Custom transform path (Akamai, etc.)
  if (preset.transform) {
    const mapped = rawData.flatMap((row) => {
      const result = preset.transform!(row, options);
      if (!result) return [];
      return Array.isArray(result) ? result : [result];
    });
    return { data: mapped, headers: [...STANDARD_HEADERS] };
  }

  // Simple column mapping path
  const { columns, defaultStatusCode } = preset;
  if (!columns) return { data: rawData, headers: rawHeaders };

  const hasSource = rawHeaders.includes(columns.source);
  const hasDest = rawHeaders.includes(columns.destination);

  if (!hasSource || !hasDest) {
    return { data: rawData, headers: rawHeaders };
  }

  const mapped = rawData.map((row) => ({
    source: row[columns.source] ?? "",
    destination: row[columns.destination] ?? "",
    statusCode:
      (columns.statusCode ? row[columns.statusCode] : undefined) ??
      defaultStatusCode ??
      "308",
  }));

  return { data: mapped, headers: [...STANDARD_HEADERS] };
}
