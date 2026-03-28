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
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/data-table";
import { CSV_PRESETS, type CsvPreset } from "./csv-presets";
import { CsvDropzone } from "./csv-dropzone";
import { PresetPicker } from "./preset-picker";
import { SummaryCard } from "./summary-card";
import { BulkActionsMenu } from "./bulk-actions-menu";
import type { CsvExample } from "./examples";
import {
  useCsvParser,
  useRedirectAnalysis,
  useIssueFilterOptions,
  useTableColumns,
  usePresetMismatch,
} from "./use-migrate";

export default function MigratePage() {
  const [activePreset, setActivePreset] = useState<CsvPreset | null>(null);

  const csv = useCsvParser(activePreset);
  const analysis = useRedirectAnalysis(csv.rawData, csv.rawHeaders, activePreset);

  const issueFilterOptions = useIssueFilterOptions(analysis.stats);
  const columns = useTableColumns(analysis.headers, analysis.canAnalyze);
  const presetMismatch = usePresetMismatch(activePreset, csv.rawHeaders);

  const reset = useCallback(() => {
    csv.reset();
    setActivePreset(null);
    analysis.resetActions();
  }, [csv, analysis]);

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
        success: (data) => `Successfully imported ${data.count} redirect${data.count !== 1 ? "s" : ""} to Vercel.`,
        error: "Failed to import redirects.",
      }
    );
  }, [analysis.data.length]);

  const handleLoadExample = useCallback(
    (example: CsvExample) => {
      const text = example.toCsv
        ? example.toCsv(example.content)
        : example.content;

      if (example.presetId) {
        const preset = CSV_PRESETS.find((p) => p.id === example.presetId) ?? null;
        setActivePreset(preset);
        csv.loadText(
          preset?.preprocess ? preset.preprocess(text) : text,
          example.fileName
        );
      } else {
        csv.loadText(text, example.fileName);
      }
    },
    [csv]
  );

  return (
    <main className="container mx-auto flex flex-col gap-6 py-8 px-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Redirect Migration Tool</h1>
          <p className="text-muted-foreground">
            Upload a CSV to bulk import redirects into Vercel.
          </p>
        </div>
        <PresetPicker activePreset={activePreset} onSelect={setActivePreset} />
      </div>

      {activePreset && !csv.fileName && (
        <p className="text-sm text-muted-foreground">
          Format set to{" "}
          <span className="font-medium text-foreground">{activePreset.name}</span>
          {" — "}columns will be mapped automatically on upload.
        </p>
      )}

      {!csv.fileName ? (
        <CsvDropzone activePreset={activePreset} onFile={csv.handleFile} onLoadExample={handleLoadExample} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{csv.fileName}</span>
                {" — "}
                {analysis.data.length} row{analysis.data.length !== 1 && "s"} parsed
              </p>
              {activePreset && !presetMismatch && (
                <p className="text-xs text-muted-foreground">
                  Mapped with <span className="font-medium">{activePreset.name}</span> format
                </p>
              )}
              {presetMismatch && (
                <p className="text-xs text-destructive">
                  CSV columns don&apos;t match the {activePreset!.name} format — showing raw data
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
                          <p className="mt-4">
                            <span className="font-bold">Identified Issues:</span>
                            <ul className="ml-6 list-disc [&>li]:mt-2">
                              {analysis.stats.pathsWithIssues > 0 && (
                                <li><span className="font-medium text-yellow-500">{analysis.stats.pathsWithIssues} path issues</span></li>
                              )}
                              {analysis.stats.conflicts > 0 && (
                              <li><span className="font-medium text-destructive">{analysis.stats.conflicts} conflict{analysis.stats.conflicts !== 1 ? "s" : ""}</span></li>
                              )}
                            </ul>
                          </p>
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

          {analysis.canAnalyze && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={analysis.includeOrigin}
                onCheckedChange={(checked) => analysis.setIncludeOrigin(checked === true)}
              />
              Include scheme and domain in source
            </label>
          )}

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
            facetFilters={issueFilterOptions ? [{ columnId: "issues", label: "Issue type", options: issueFilterOptions }] : undefined}
            onDeleteRows={analysis.handleDeleteRows}
          />
        </div>
      )}

      {csv.error && (
        <p className="text-sm text-destructive">{csv.error}</p>
      )}
    </main>
  );
}
