"use client";

import { useCallback, useState } from "react";
import {
  CSV_PRESETS,
  type ColumnFieldSpec,
  type ColumnMapping,
  type CsvPreset,
} from "../_components/csv-presets";

const STORAGE_KEY = "vercel-tools:saved-column-mappings";

export interface SavedMapping {
  id: string;
  name: string;
  mapping: ColumnMapping;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a single header string into a ColumnFieldSpec. */
export function singleSpec(column: string): ColumnFieldSpec {
  return { columns: [column] };
}

/** True when a ColumnFieldSpec refers to exactly one column. */
export function isSingleColumn(spec: ColumnFieldSpec): boolean {
  return spec.columns.length === 1;
}

/** Return the first column of a spec (or "" if empty). */
export function firstColumn(spec: ColumnFieldSpec): string {
  return spec.columns[0] ?? "";
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadSavedMappings(): SavedMapping[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedMapping[];
  } catch {
    return [];
  }
}

function persistSavedMappings(mappings: SavedMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch {
    // storage quota exceeded or private-browsing restriction — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

/**
 * Fuzzy-match a raw CSV header name to one of the three standard redirect fields.
 * Returns `"source" | "destination" | "statusCode" | null`.
 */
function fuzzyMatchField(
  header: string,
): "source" | "destination" | "statusCode" | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^(source|from|src|origin|oldpath|oldurl|frompath|fromurl)$/.test(h))
    return "source";
  if (
    /^(destination|to|dest|target|newpath|newurl|topath|tourl|redirecturl|redirect)$/.test(
      h,
    )
  )
    return "destination";
  if (
    /^(statuscode|status|code|httpcode|responsecode|redirectcode|type)$/.test(h)
  )
    return "statusCode";
  return null;
}

export interface DetectionResult {
  /** A built-in preset whose expected columns were found in the headers */
  matchedPreset: CsvPreset | null;
  /** A saved custom mapping whose columns were found in the headers */
  matchedSavedMapping: SavedMapping | null;
  /**
   * A column mapping derived from fuzzy-matching the raw headers.
   * May be partial — fields with no match are omitted.
   */
  suggestedMapping: Partial<ColumnMapping>;
}

/**
 * Inspect a set of raw CSV headers and return the best auto-detection result.
 * Priority: saved custom mappings > built-in presets > fuzzy heuristics.
 */
export function detectMapping(
  rawHeaders: string[],
  savedMappings: SavedMapping[],
): DetectionResult {
  const headerSet = new Set(rawHeaders);

  // 1. Check saved custom mappings (all referenced columns must exist)
  for (const saved of savedMappings) {
    const { source, destination, statusCode } = saved.mapping;
    const sourceOk = source.columns.every((c) => headerSet.has(c));
    const destOk = destination.columns.every((c) => headerSet.has(c));
    const statusOk = statusCode === null || headerSet.has(statusCode);
    if (sourceOk && destOk && statusOk) {
      return {
        matchedPreset: null,
        matchedSavedMapping: saved,
        suggestedMapping: saved.mapping,
      };
    }
  }

  // 2. Check built-in presets
  for (const preset of CSV_PRESETS) {
    // Transform-based presets (Akamai, htaccess) — check expectedColumns
    if (preset.transform || preset.preprocess) {
      const expected = preset.expectedColumns ?? [];
      if (expected.length > 0 && expected.every((c) => headerSet.has(c))) {
        return {
          matchedPreset: preset,
          matchedSavedMapping: null,
          suggestedMapping: {},
        };
      }
      continue;
    }
    // Simple column-mapping presets (Standard CSV)
    if (preset.columns) {
      const { source, destination } = preset.columns;
      if (headerSet.has(source) && headerSet.has(destination)) {
        return {
          matchedPreset: preset,
          matchedSavedMapping: null,
          suggestedMapping: {
            source: singleSpec(source),
            destination: singleSpec(destination),
            statusCode: preset.columns.statusCode ?? null,
          },
        };
      }
    }
  }

  // 3. Fuzzy heuristics
  const suggested: Partial<ColumnMapping> = {};
  for (const header of rawHeaders) {
    const field = fuzzyMatchField(header);
    if (field && field !== "statusCode" && !(field in suggested)) {
      suggested[field] = singleSpec(header);
    } else if (field === "statusCode" && !("statusCode" in suggested)) {
      suggested.statusCode = header;
    }
  }

  return {
    matchedPreset: null,
    matchedSavedMapping: null,
    suggestedMapping: suggested,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSavedMappings() {
  const [savedMappings, setSavedMappings] =
    useState<SavedMapping[]>(loadSavedMappings);

  const saveMapping = useCallback((name: string, mapping: ColumnMapping) => {
    setSavedMappings((prev) => {
      const id = `custom-${Date.now()}`;
      const existing = prev.findIndex((m) => m.name === name);
      const next =
        existing >= 0
          ? prev.map((m, i) => (i === existing ? { ...m, mapping } : m))
          : [...prev, { id, name, mapping }];
      persistSavedMappings(next);
      return next;
    });
  }, []);

  const deleteMapping = useCallback((id: string) => {
    setSavedMappings((prev) => {
      const next = prev.filter((m) => m.id !== id);
      persistSavedMappings(next);
      return next;
    });
  }, []);

  return { savedMappings, saveMapping, deleteMapping };
}
