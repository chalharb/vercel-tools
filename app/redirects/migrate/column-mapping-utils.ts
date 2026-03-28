import {
  applyColumnMapping,
  applyPreset,
  type ColumnFieldSpec,
} from "./csv-presets";
import type { ResolvedMapping } from "./column-mapping-types";

export const EMPTY_SPEC: ColumnFieldSpec = { columns: [], separators: [] };

/** Build a spec with a new column appended and a blank separator slot inserted before it. */
export function appendColumn(spec: ColumnFieldSpec, col: string): ColumnFieldSpec {
  return {
    columns: [...spec.columns, col],
    separators: [...(spec.separators ?? []), ""],
  };
}

/** Remove column at index and the separator that precedes it (or follows, for index 0). */
export function removeColumn(spec: ColumnFieldSpec, idx: number): ColumnFieldSpec {
  const cols = spec.columns.filter((_, i) => i !== idx);
  const seps = [...(spec.separators ?? [])];
  if (idx === 0) seps.splice(0, 1);      // remove separator after first col
  else seps.splice(idx - 1, 1);          // remove separator before this col
  return { columns: cols, separators: seps };
}

/** Update the separator at position i (between columns[i] and columns[i+1]). */
export function updateSeparator(spec: ColumnFieldSpec, i: number, value: string): ColumnFieldSpec {
  const seps = [...(spec.separators ?? [])];
  seps[i] = value;
  return { ...spec, separators: seps };
}

function stripOriginFromRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.map((row) => {
    const src = row["source"] ?? "";
    try {
      const u = new URL(src);
      return { ...row, source: u.pathname + u.search + u.hash };
    } catch {
      return row;
    }
  });
}

export function buildPreviewRows(
  rawRows: Record<string, string>[],
  resolved: ResolvedMapping | null,
  rawHeaders: string[],
  includeOrigin: boolean
): Record<string, string>[] {
  if (!resolved) return rawRows.slice(0, 4);
  let data: Record<string, string>[];
  if (resolved.kind === "preset") {
    data = applyPreset(rawRows, rawHeaders, resolved.preset, resolved.options).data;
  } else {
    data = applyColumnMapping(rawRows, resolved.mapping).data;
  }
  if (!includeOrigin) {
    data = stripOriginFromRows(data);
  }
  return data.slice(0, 4);
}

export function isMappingComplete(resolved: ResolvedMapping | null): boolean {
  if (!resolved) return false;
  if (resolved.kind === "preset") return true;
  return (
    resolved.mapping.source.columns.length > 0 &&
    resolved.mapping.destination.columns.length > 0
  );
}

export function savedMappingLabel(mapping: { source: ColumnFieldSpec; destination: ColumnFieldSpec }): string {
  const src = mapping.source.columns.join("+");
  const dst = mapping.destination.columns.join("+");
  return `${src} → ${dst}`;
}
