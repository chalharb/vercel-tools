"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { CSV_PRESETS } from "./csv-presets";
import { CsvDropzone } from "./csv-dropzone";
import { SummaryCard } from "./summary-card";
import { BulkActionsMenu } from "./bulk-actions-menu";
import { ColumnMappingDialog, type ResolvedMapping } from "./column-mapping-dialog";
import type { CsvExample } from "./examples";
import {
  useCsvParser,
  useRedirectAnalysis,
  useIssueFilterOptions,
  useTableColumns,
  useActiveMappingLabel,
} from "./use-migrate";
import { useSavedMappings } from "./use-column-mapping";

export function MigrateClient() {
  // Resolved mapping (set after the dialog is confirmed)
  const [resolvedMapping, setResolvedMapping] = useState<ResolvedMapping | null>(null);

  // Controls whether the Column Mapping dialog is open
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  // Hint passed to the dialog (e.g. from example loader) for pre-selection
  const [mappingDialogHint, setMappingDialogHint] = useState<ResolvedMapping | undefined>(undefined);

  // Pending file/text kept while dialog is open
  const pendingFileRef = useRef<{ text: string; name: string; preset?: ResolvedMapping } | null>(null);
  // Original raw text stored so the dialog can be re-opened to change the mapping
  const originalTextRef = useRef<{ text: string; name: string } | null>(null);

  const csv = useCsvParser();
  const analysis = useRedirectAnalysis(csv.rawData, csv.rawHeaders, resolvedMapping);
  const { savedMappings, saveMapping } = useSavedMappings();

  const issueFilterOptions = useIssueFilterOptions(analysis.stats);
  const columns = useTableColumns(analysis.headers, analysis.canAnalyze);
  const mappingLabel = useActiveMappingLabel(resolvedMapping);

  const reset = useCallback(() => {
    csv.reset();
    setResolvedMapping(null);
    setMappingDialogOpen(false);
    setMappingDialogHint(undefined);
    pendingFileRef.current = null;
    originalTextRef.current = null;
    analysis.resetActions();
  }, [csv, analysis]);

  // ------------------------------------------------------------------
  // After a file/text is loaded into rawData/rawHeaders, open the dialog
  // ------------------------------------------------------------------
  function openMappingDialog(text: string, name: string, presetHint?: ResolvedMapping) {
    pendingFileRef.current = { text, name, preset: presetHint };
    setMappingDialogHint(presetHint);
    setMappingDialogOpen(true);
  }

  // ------------------------------------------------------------------
  // Dialog: user confirmed a mapping
  // ------------------------------------------------------------------
  const handleMappingConfirm = useCallback(
    (resolved: ResolvedMapping, save: { shouldSave: boolean; name: string }, options: { includeOrigin: boolean }) => {
      setResolvedMapping(resolved);
      setMappingDialogOpen(false);
      analysis.setIncludeOrigin(options.includeOrigin);

      // If it's a preset with preprocess, re-parse with preprocessing applied
      if (resolved.kind === "preset" && resolved.preset.preprocess && pendingFileRef.current) {
        const { text, name } = pendingFileRef.current;
        csv.loadText(text, name, resolved.preset);
      }

      if (save.shouldSave && resolved.kind === "custom") {
        saveMapping(save.name, resolved.mapping);
      }

      pendingFileRef.current = null;
    },
    [csv, saveMapping, analysis]
  );

  // ------------------------------------------------------------------
  // Dialog: user cancelled
  // ------------------------------------------------------------------
  const handleMappingCancel = useCallback(() => {
    setMappingDialogOpen(false);
    // Also clear the parsed raw data so we go back to the dropzone
    csv.reset();
    pendingFileRef.current = null;
  }, [csv]);

  // ------------------------------------------------------------------
  // File upload from dropzone
  // ------------------------------------------------------------------
  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (
        !name.endsWith(".csv") &&
        !name.endsWith(".htaccess") &&
        !name.endsWith(".txt") &&
        !name.endsWith(".tsv")
      ) {
        // Let useCsvParser set the error via handleFile
        csv.handleFile(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        // Load raw (no preset preprocessing yet) so dialog can show raw headers
        csv.loadText(text, file.name);
        originalTextRef.current = { text, name: file.name };
        openMappingDialog(text, file.name);
      };
      reader.onerror = () => csv.handleFile(file); // fallback, triggers error state
      reader.readAsText(file);
    },
    [csv]
  );

  // ------------------------------------------------------------------
  // Example loading
  // ------------------------------------------------------------------
  const handleLoadExample = useCallback(
    (example: CsvExample) => {
      const text = example.toCsv ? example.toCsv(example.content) : example.content;

      let presetHint: ResolvedMapping | undefined;
      if (example.mappingHint) {
        presetHint = example.mappingHint;
      } else if (example.presetId) {
        const preset = CSV_PRESETS.find((p) => p.id === example.presetId) ?? null;
        if (preset) presetHint = { kind: "preset", preset };
      }

      // For complex presets (preprocess + transform), load the raw text first
      // so we can show the unprocessed headers in the dialog.
      // The dialog will re-trigger preprocessing on confirm.
      csv.loadText(text, example.fileName);
      originalTextRef.current = { text, name: example.fileName };
      openMappingDialog(text, example.fileName, presetHint);
    },
    [csv]
  );

  // ------------------------------------------------------------------
  // Import
  // ------------------------------------------------------------------
  const importingRef = useRef(false);

  const handleImport = useCallback(() => {
    if (importingRef.current) return;
    importingRef.current = true;

    const rowCount = analysis.data.length;

    toast.promise(
      new Promise<{ count: number }>((resolve) => {
        setTimeout(() => {
          importingRef.current = false;
          resolve({ count: rowCount });
        }, 2000);
      }),
      {
        loading: `Importing ${rowCount} redirect${rowCount !== 1 ? "s" : ""} to Vercel…`,
        success: (data) =>
          `Successfully imported ${data.count} redirect${data.count !== 1 ? "s" : ""} to Vercel.`,
        error: "Failed to import redirects.",
      }
    );
  }, [analysis.data.length]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Redirect Migration Tool</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a CSV to bulk import redirects into Vercel.
        </p>
      </div>

      {!csv.fileName ? (
        <CsvDropzone onFile={handleFile} onLoadExample={handleLoadExample} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{csv.fileName}</span>
                {" — "}
                {analysis.data.length} row{analysis.data.length !== 1 && "s"} parsed
              </p>
              {mappingLabel && (
                <p className="text-xs text-muted-foreground">
                  Mapped with{" "}
                  <button
                    className="font-medium text-foreground underline-offset-2 hover:underline cursor-pointer"
                    onClick={() => {
                      // Re-open the dialog to adjust the mapping.
                      // Restore the original raw text so complex presets can re-preprocess.
                      if (originalTextRef.current) {
                        const { text, name } = originalTextRef.current;
                        // Re-parse raw (without any preset preprocessing) so the dialog
                        // shows the original unprocessed headers.
                        csv.loadText(text, name);
                        pendingFileRef.current = { text, name };
                      }
                      setMappingDialogOpen(true);
                    }}
                  >
                    {mappingLabel}
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {analysis.stats && analysis.stats.pathsWithIssues === 0 ? (
                <Button variant="default" onClick={handleImport}>
                  <Upload data-icon="inline-start" />
                  Import to Vercel
                </Button>
              ) : analysis.stats && analysis.stats.pathsWithIssues > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <AlertTriangleIcon data-icon="inline-start" />
                      Import to Vercel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="flex flex-col gap-2">
                          <p>Unresolved issues may cause unexpected behavior</p>
                          <div className="mt-4">
                            <span className="font-bold">Identified Issues:</span>
                            <ul className="ml-6 list-disc [&>li]:mt-2">
                              {analysis.stats.pathsWithIssues > 0 && (
                                <li>
                                  <span className="font-medium text-yellow-500">
                                    {analysis.stats.pathsWithIssues} path issues
                                  </span>
                                </li>
                              )}
                              {analysis.stats.conflicts > 0 && (
                                <li>
                                  <span className="font-medium text-destructive">
                                    {analysis.stats.conflicts} conflict
                                    {analysis.stats.conflicts !== 1 ? "s" : ""}
                                  </span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleImport}>
                        Import anyway
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {analysis.canAnalyze && (
                <BulkActionsMenu
                  appliedActions={analysis.appliedActions}
                  hasManualDeletions={analysis.manuallyDeletedKeys.size > 0}
                  onToggleAction={analysis.toggleAction}
                  onResetAll={analysis.resetActions}
                />
              )}
              <Button variant="outline" onClick={reset}>
                Clear
              </Button>
            </div>
          </div>

          {analysis.stats && (
            <SummaryCard
              totalPaths={analysis.stats.totalPaths}
              pathsWithIssues={analysis.stats.pathsWithIssues}
              conflicts={analysis.stats.conflicts}
            />
          )}

          <DataTable
            columns={columns}
            data={analysis.enrichedData}
            facetFilters={
              issueFilterOptions
                ? [{ columnId: "issues", label: "Issue type", options: issueFilterOptions }]
                : undefined
            }
            onDeleteRows={analysis.handleDeleteRows}
          />
        </div>
      )}

      {csv.error && <p className="text-sm text-destructive">{csv.error}</p>}

      {/* Column Mapping Dialog — always shown post-upload */}
      <ColumnMappingDialog
        open={mappingDialogOpen}
        rawHeaders={csv.rawHeaders}
        rawPreview={csv.rawData.slice(0, 4)}
        rawText={originalTextRef.current?.text}
        fileName={csv.fileName ?? ""}
        savedMappings={savedMappings}
        presetHint={mappingDialogHint}
        onCancel={handleMappingCancel}
        onConfirm={handleMappingConfirm}
      />
    </div>
  );
}
