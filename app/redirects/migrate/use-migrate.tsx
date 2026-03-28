"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Papa from "papaparse";
import { buildColumnsFromHeaders } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  analyzeRedirects,
  ISSUE_LABELS,
  ISSUE_VARIANTS,
  type RedirectIssue,
} from "@/lib/redirect-analysis";
import { applyPreset, type CsvPreset } from "./csv-presets";

export function useCsvParser(activePreset: CsvPreset | null) {
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string, name: string) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter: ",",
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length > 0) {
          setError(
            `Parse error on row ${results.errors[0].row}: ${results.errors[0].message}`
          );
        }
        setRawHeaders(results.meta.fields ?? []);
        setRawData(results.data);
        setFileName(name);
      },
      error(err: Error) {
        setError(err.message);
      },
    });
  }, []);

  const loadText = useCallback(
    (text: string, name: string) => {
      setError(null);
      let processed = text;
      if (activePreset?.preprocess) {
        processed = activePreset.preprocess(processed);
      }
      parseCSV(processed, name);
    },
    [activePreset, parseCSV]
  );

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const name = file.name.toLowerCase();
      if (
        !name.endsWith(".csv") &&
        !name.endsWith(".htaccess") &&
        !name.endsWith(".txt") &&
        !name.endsWith(".tsv")
      ) {
        setError("Unsupported file type. Please upload a .csv, .htaccess, or text file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        loadText(reader.result as string, file.name);
      };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file);
    },
    [loadText]
  );

  const reset = useCallback(() => {
    setRawData([]);
    setRawHeaders([]);
    setFileName(null);
    setError(null);
  }, []);

  return { rawData, rawHeaders, fileName, error, handleFile, loadText, reset };
}

export function useRedirectAnalysis(
  rawData: Record<string, string>[],
  rawHeaders: string[],
  activePreset: CsvPreset | null
) {
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());
  const [manuallyDeletedKeys, setManuallyDeletedKeys] = useState<Set<string>>(new Set());
  const [includeOrigin, setIncludeOrigin] = useState(false);

  const { data: mappedData, headers } = useMemo(() => {
    const result = !activePreset
      ? { data: rawData, headers: rawHeaders }
      : applyPreset(rawData, rawHeaders, activePreset);
    let counter = 0;
    const keyed = result.data.map((row): Record<string, string> => ({
      ...row,
      _rowKey: String(counter++),
    }));
    return { data: keyed, headers: result.headers };
  }, [rawData, rawHeaders, activePreset]);

  const canAnalyze = headers.includes("source") && headers.includes("destination");

  // Strip scheme+host from source when includeOrigin is off
  const originStripped = useMemo(() => {
    if (includeOrigin || !canAnalyze) return mappedData;
    return mappedData.map((row) => {
      const src = row["source"] ?? "";
      try {
        const u = new URL(src);
        return { ...row, source: u.pathname + u.search + u.hash };
      } catch {
        return row;
      }
    });
  }, [mappedData, includeOrigin, canAnalyze]);

  const data = useMemo(() => {
    let result = originStripped;
    if (canAnalyze && appliedActions.size > 0) {
      if (appliedActions.has("drop-trailing-slashes")) {
        result = result.filter((row) => {
          const src = row["source"] ?? "";
          try {
            const u = new URL(src);
            return u.pathname.length <= 1 || !u.pathname.endsWith("/");
          } catch {
            return src.length <= 1 || !src.endsWith("/");
          }
        });
      }
      if (appliedActions.has("drop-redundant-duplicates")) {
        const seen = new Set<string>();
        result = result.filter((row) => {
          const key = `${row["source"]}→${row["destination"]}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }
    if (manuallyDeletedKeys.size > 0) {
      result = result.filter((row) => !manuallyDeletedKeys.has(row._rowKey));
    }
    return result;
  }, [originStripped, appliedActions, canAnalyze, manuallyDeletedKeys]);

  const issuesByRow = useMemo(() => {
    if (!canAnalyze || data.length === 0) return [];
    return analyzeRedirects(data);
  }, [data, canAnalyze]);

  const stats = useMemo(() => {
    if (!canAnalyze || data.length === 0 || issuesByRow.length === 0) return null;
    const totalPaths = data.length;
    const pathsWithIssues = issuesByRow.filter((i) => i.length > 0).length;
    const issueCounts = new Map<RedirectIssue, number>();
    for (const rowIssues of issuesByRow) {
      for (const issue of rowIssues) {
        issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      }
    }
    const conflicts =
      (issueCounts.get("conflicting-duplicate") ?? 0) +
      (issueCounts.get("trailing-slash-conflict") ?? 0);
    return { totalPaths, pathsWithIssues, conflicts, issueCounts };
  }, [data, issuesByRow, canAnalyze]);

  const enrichedData = useMemo(() => {
    if (!canAnalyze || issuesByRow.length === 0) return data;
    return data.map((row, i) => ({
      ...row,
      _issues: issuesByRow[i]?.join(",") ?? "",
    }));
  }, [data, issuesByRow, canAnalyze]);

  const enrichedDataRef = useRef(enrichedData);
  useEffect(() => {
    enrichedDataRef.current = enrichedData;
  }, [enrichedData]);

  const handleDeleteRows = useCallback((indices: number[]) => {
    const currentData = enrichedDataRef.current;
    setManuallyDeletedKeys((prev) => {
      const next = new Set(prev);
      for (const idx of indices) {
        const row = currentData[idx];
        const key = row && "_rowKey" in row ? row["_rowKey"] : undefined;
        if (key) next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAction = useCallback((action: string) => {
    setAppliedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }, []);

  const resetActions = useCallback(() => {
    setAppliedActions(new Set());
    setManuallyDeletedKeys(new Set());
  }, []);

  return {
    headers,
    canAnalyze,
    data,
    enrichedData,
    stats,
    appliedActions,
    manuallyDeletedKeys,
    includeOrigin,
    setIncludeOrigin,
    handleDeleteRows,
    toggleAction,
    resetActions,
  };
}

export function useIssueFilterOptions(stats: ReturnType<typeof useRedirectAnalysis>["stats"]) {
  return useMemo(() => {
    if (!stats?.issueCounts) return undefined;
    return [
      { label: "All rows", value: "__all__" },
      { label: `Has issues (${stats.pathsWithIssues.toLocaleString()})`, value: "__any__" },
      { label: `No issues (${(stats.totalPaths - stats.pathsWithIssues).toLocaleString()})`, value: "__none__" },
      ...[...stats.issueCounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([issue, count]) => ({
          label: `${ISSUE_LABELS[issue]} (${count.toLocaleString()})`,
          value: issue,
        })),
    ];
  }, [stats]);
}

export function useTableColumns(headers: string[], canAnalyze: boolean) {
  return useMemo(() => {
    const base = buildColumnsFromHeaders(headers);
    if (!canAnalyze) return base;

    const issuesCol: ColumnDef<Record<string, string>> = {
      id: "issues",
      accessorKey: "_issues",
      header: "Issues",
      size: 280,
      minSize: 120,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom filter registered at table level
      filterFn: "facet" as any,
      cell: ({ getValue }) => {
        const raw = getValue() as string;
        if (!raw) return null;
        const issues = raw.split(",") as RedirectIssue[];
        return (
          <div className="flex flex-wrap gap-1">
            {issues.map((issue) => (
              <Badge key={issue} variant={ISSUE_VARIANTS[issue]}>
                {ISSUE_LABELS[issue]}
              </Badge>
            ))}
          </div>
        );
      },
    };

    return [...base, issuesCol];
  }, [headers, canAnalyze]);
}

export function usePresetMismatch(activePreset: CsvPreset | null, rawHeaders: string[]) {
  return useMemo(() => {
    if (!activePreset || rawHeaders.length === 0) return false;
    if (activePreset.transform) {
      const expected = activePreset.expectedColumns ?? [];
      return expected.length > 0 && !expected.every((c) => rawHeaders.includes(c));
    }
    const { columns } = activePreset;
    if (!columns) return false;
    return !rawHeaders.includes(columns.source) || !rawHeaders.includes(columns.destination);
  }, [activePreset, rawHeaders]);
}
