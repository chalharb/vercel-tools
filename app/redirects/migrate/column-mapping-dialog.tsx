"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, GlobeIcon, PlusIcon, SaveIcon, XIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select as SelectPrimitive } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  applyColumnMapping,
  applyPreset,
  CSV_PRESETS,
  type ColumnFieldSpec,
  type ColumnMapping,
  type CsvPreset,
  type PresetOptionDef,
  type PresetOptions,
} from "./csv-presets";
import { detectMapping, firstColumn, singleSpec, type SavedMapping } from "./use-column-mapping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The resolved mapping the dialog emits on confirm. */
export type ResolvedMapping =
  | { kind: "preset"; preset: CsvPreset; options?: PresetOptions }
  | { kind: "custom"; mapping: ColumnMapping };

interface ColumnMappingDialogProps {
  open: boolean;
  /** Raw CSV headers from the uploaded file */
  rawHeaders: string[];
  /** A sample of raw rows (used for the preview table) */
  rawPreview: Record<string, string>[];
  /** File name for display */
  fileName: string;
  /** Saved custom mappings from localStorage */
  savedMappings: SavedMapping[];
  /**
   * Optional hint from the caller (e.g. example loader already knows the preset).
   * Takes priority over auto-detection when provided.
   */
  presetHint?: ResolvedMapping;
  /** Called when the user cancels the dialog */
  onCancel: () => void;
  /** Called when the user confirms a mapping */
  onConfirm: (resolved: ResolvedMapping, save: { shouldSave: boolean; name: string }, options: { includeOrigin: boolean }) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NO_COLUMN = "__none__";
const STATUS_CODE_OPTIONS = ["301", "302", "307", "308"];

const EMPTY_SPEC: ColumnFieldSpec = { columns: [], separators: [] };

/** Build a spec with a new column appended and a blank separator slot inserted before it. */
function appendColumn(spec: ColumnFieldSpec, col: string): ColumnFieldSpec {
  return {
    columns: [...spec.columns, col],
    separators: [...(spec.separators ?? []), ""],
  };
}

/** Remove column at index and the separator that precedes it (or follows, for index 0). */
function removeColumn(spec: ColumnFieldSpec, idx: number): ColumnFieldSpec {
  const cols = spec.columns.filter((_, i) => i !== idx);
  const seps = [...(spec.separators ?? [])];
  if (idx === 0) seps.splice(0, 1);      // remove separator after first col
  else seps.splice(idx - 1, 1);          // remove separator before this col
  return { columns: cols, separators: seps };
}

/** Update the separator at position i (between columns[i] and columns[i+1]). */
function updateSeparator(spec: ColumnFieldSpec, i: number, value: string): ColumnFieldSpec {
  const seps = [...(spec.separators ?? [])];
  seps[i] = value;
  return { ...spec, separators: seps };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function buildPreviewRows(
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

function isMappingComplete(resolved: ResolvedMapping | null): boolean {
  if (!resolved) return false;
  if (resolved.kind === "preset") return true;
  return (
    resolved.mapping.source.columns.length > 0 &&
    resolved.mapping.destination.columns.length > 0
  );
}

// ---------------------------------------------------------------------------
// ColumnFieldEditor — the per-field UI (single select or combine chips)
// ---------------------------------------------------------------------------

interface ColumnFieldEditorProps {
  label: string;
  required?: boolean;
  spec: ColumnFieldSpec;
  rawHeaders: string[];
  onChange: (spec: ColumnFieldSpec) => void;
}

function ColumnFieldEditor({ label, required, spec, rawHeaders, onChange }: ColumnFieldEditorProps) {
  const [isCombining, setIsCombining] = useState(spec.columns.length > 1);

  useEffect(() => {
    if (spec.columns.length <= 1) setIsCombining(false);
  }, [spec.columns.length]);

  const availableHeaders = rawHeaders.filter((h) => !spec.columns.includes(h));

  function handleSingleSelect(col: string) {
    onChange({ columns: [col], separators: [] });
  }

  function enableCombine() {
    setIsCombining(true);
    onChange({ columns: spec.columns, separators: spec.separators ?? [] });
  }

  function disableCombine() {
    setIsCombining(false);
    onChange({ columns: spec.columns.slice(0, 1), separators: [] });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <button
          type="button"
          onClick={isCombining ? disableCombine : enableCombine}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {isCombining ? "Single column" : "Combine columns"}
        </button>
      </div>

      {!isCombining ? (
        /* ---- Single column select ---- */
        <Select value={spec.columns[0] ?? ""} onValueChange={handleSingleSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick column…" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {rawHeaders.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        /* ---- Combine mode: vertical interleaved list ---- */
        <div className="flex flex-col rounded-md border divide-y">
          {spec.columns.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">
              No columns selected — add one below.
            </p>
          )}

          {spec.columns.map((col, idx) => (
            <div key={col}>
              {/* Column row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs font-mono font-medium flex-1">{col}</span>
                <button
                  type="button"
                  onClick={() => onChange(removeColumn(spec, idx))}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>

              {/* Separator row — shown between this column and the next */}
              {idx < spec.columns.length - 1 && (
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground shrink-0 w-16">separator</span>
                  <Input
                    value={spec.separators?.[idx] ?? ""}
                    onChange={(e) => onChange(updateSeparator(spec, idx, e.target.value))}
                    placeholder='e.g. "://" or "/"'
                    className="h-6 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add column */}
          {availableHeaders.length > 0 && (
            <div className="px-2 py-1.5">
              <Select value="" onValueChange={(col) => onChange(appendColumn(spec, col))}>
                <SelectTrigger className="h-7 w-full text-xs border-dashed">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <PlusIcon className="size-3" />
                    Add column…
                  </span>
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {availableHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

export function ColumnMappingDialog({
  open,
  rawHeaders,
  rawPreview,
  fileName,
  savedMappings,
  presetHint,
  onCancel,
  onConfirm,
}: ColumnMappingDialogProps) {
  // Quick-map selector: "preset:<id>" | "saved:<id>" | ""
  const [quickMapValue, setQuickMapValue] = useState<string>("");

  // Manual mapping field specs
  const [sourceSpec, setSourceSpec] = useState<ColumnFieldSpec>(EMPTY_SPEC);
  const [destSpec, setDestSpec] = useState<ColumnFieldSpec>(EMPTY_SPEC);
  const [manualStatusCode, setManualStatusCode] = useState<string>(NO_COLUMN);
  const [manualDefaultStatus, setManualDefaultStatus] = useState<string>("308");

  // Preset options (for complex presets with optionDefs)
  const [presetOptions, setPresetOptions] = useState<PresetOptions>({});

  // Keep full URLs in source (beta feature for fully qualified redirect sources)
  const [includeOrigin, setIncludeOrigin] = useState(false);

  // Save toggle
  const [shouldSave, setShouldSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  // ------------------------------------------------------------------
  // Helpers to apply a full ColumnMapping into the manual state fields
  // ------------------------------------------------------------------
  function applyMappingToState(mapping: ColumnMapping) {
    setSourceSpec(mapping.source);
    setDestSpec(mapping.destination);
    setManualStatusCode(mapping.statusCode ?? NO_COLUMN);
    setManualDefaultStatus(mapping.defaultStatusCode ?? "308");
  }

  function clearMappingState() {
    setSourceSpec(EMPTY_SPEC);
    setDestSpec(EMPTY_SPEC);
    setManualStatusCode(NO_COLUMN);
    setManualDefaultStatus("308");
  }

  function initPresetOptions(preset: CsvPreset) {
    const defaults: PresetOptions = {};
    for (const def of preset.optionDefs ?? []) {
      defaults[def.key] = def.defaultValue;
    }
    setPresetOptions(defaults);
  }

  // ------------------------------------------------------------------
  // Auto-detect on open / when headers / hint change
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;

    setShouldSave(false);
    setSaveName("");

    // 1. Caller-supplied hint takes priority
    if (presetHint) {
      if (presetHint.kind === "preset") {
        setQuickMapValue(`preset:${presetHint.preset.id}`);
        initPresetOptions(presetHint.preset);
        if (presetHint.preset.columns) {
          applyMappingToState({
            source: singleSpec(presetHint.preset.columns.source),
            destination: singleSpec(presetHint.preset.columns.destination),
            statusCode: presetHint.preset.columns.statusCode ?? null,
            defaultStatusCode: presetHint.preset.defaultStatusCode ?? "308",
          });
        } else {
          clearMappingState();
        }
        if (presetHint.options) setPresetOptions(presetHint.options);
      } else {
        setQuickMapValue("");
        applyMappingToState(presetHint.mapping);
      }
      return;
    }

    if (rawHeaders.length === 0) return;

    // 2. Auto-detect from headers
    const result = detectMapping(rawHeaders, savedMappings);

    if (result.matchedSavedMapping) {
      setQuickMapValue(`saved:${result.matchedSavedMapping.id}`);
      applyMappingToState(result.matchedSavedMapping.mapping);
    } else if (result.matchedPreset) {
      setQuickMapValue(`preset:${result.matchedPreset.id}`);
      clearMappingState();
    } else {
      setQuickMapValue("");
      if (result.suggestedMapping.source) setSourceSpec(result.suggestedMapping.source);
      if (result.suggestedMapping.destination) setDestSpec(result.suggestedMapping.destination);
      if (result.suggestedMapping.statusCode) setManualStatusCode(result.suggestedMapping.statusCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rawHeaders, presetHint]);

  // ------------------------------------------------------------------
  // Sync manual fields when quick-map selection changes
  // ------------------------------------------------------------------
  function handleQuickMapChange(value: string) {
    setQuickMapValue(value);
    if (value.startsWith("preset:")) {
      const id = value.slice("preset:".length);
      const preset = CSV_PRESETS.find((p) => p.id === id);
      if (preset) initPresetOptions(preset);
      if (preset?.columns) {
        applyMappingToState({
          source: singleSpec(preset.columns.source),
          destination: singleSpec(preset.columns.destination),
          statusCode: preset.columns.statusCode ?? null,
          defaultStatusCode: preset.defaultStatusCode ?? "308",
        });
      } else {
        clearMappingState();
      }
    } else if (value.startsWith("saved:")) {
      const id = value.slice("saved:".length);
      const saved = savedMappings.find((m) => m.id === id);
      if (saved) applyMappingToState(saved.mapping);
    } else {
      clearMappingState();
    }
  }

  // Clear quickMapValue when manual fields change (user is doing a custom mapping)
  function handleSourceChange(spec: ColumnFieldSpec) {
    setSourceSpec(spec);
    setQuickMapValue("");
  }

  function handleDestChange(spec: ColumnFieldSpec) {
    setDestSpec(spec);
    setQuickMapValue("");
  }

  // ------------------------------------------------------------------
  // Derive the active resolved mapping for preview + confirm
  // ------------------------------------------------------------------
  const resolvedMapping = useMemo((): ResolvedMapping | null => {
    if (quickMapValue.startsWith("preset:")) {
      const id = quickMapValue.slice("preset:".length);
      const preset = CSV_PRESETS.find((p) => p.id === id);
      if (preset) return { kind: "preset", preset, options: presetOptions };
    }
    if (sourceSpec.columns.length > 0 && destSpec.columns.length > 0) {
      const mapping: ColumnMapping = {
        source: sourceSpec,
        destination: destSpec,
        statusCode: manualStatusCode === NO_COLUMN ? null : manualStatusCode,
        defaultStatusCode: manualDefaultStatus,
      };
      return { kind: "custom", mapping };
    }
    return null;
  }, [quickMapValue, sourceSpec, destSpec, manualStatusCode, manualDefaultStatus, presetOptions]);

  const isComplexPreset = useMemo(() => {
    if (!quickMapValue.startsWith("preset:")) return false;
    const id = quickMapValue.slice("preset:".length);
    const preset = CSV_PRESETS.find((p) => p.id === id);
    return !!preset && (!!preset.transform || (!!preset.preprocess && !preset.columns));
  }, [quickMapValue]);

  const previewRows = useMemo(
    () => buildPreviewRows(rawPreview, resolvedMapping, rawHeaders, includeOrigin),
    [rawPreview, resolvedMapping, rawHeaders, includeOrigin]
  );

  const previewHeaders = useMemo(() => {
    if (resolvedMapping && isMappingComplete(resolvedMapping)) {
      return ["source", "destination", "statusCode"];
    }
    return rawHeaders.slice(0, 4);
  }, [resolvedMapping, rawHeaders]);

  const canConfirm = isMappingComplete(resolvedMapping);

  function handleConfirm() {
    if (!resolvedMapping || !canConfirm) return;
    onConfirm(resolvedMapping, { shouldSave, name: saveName.trim() || "Custom Mapping" }, { includeOrigin });
  }

  // ------------------------------------------------------------------
  // Saved mapping display label
  // ------------------------------------------------------------------
  function savedMappingLabel(saved: SavedMapping): string {
    const src = saved.mapping.source.columns.join("+");
    const dst = saved.mapping.destination.columns.join("+");
    return `${src} → ${dst}`;
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-2xl top-[10vh] translate-y-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Column Mapping</DialogTitle>
          <DialogDescription>
            Map columns from{" "}
            <span className="font-medium text-foreground">{fileName}</span> to
            the fields Vercel Bulk Redirects expect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* ---- Quick Map ---- */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ZapIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quick Map</span>
              <span className="text-xs text-muted-foreground">
                — auto-fill from a known redirect export format
              </span>
            </div>
            <Select value={quickMapValue} onValueChange={handleQuickMapChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a known format (optional)..." />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectLabel>Built-in formats</SelectLabel>
                  {CSV_PRESETS.map((preset) => (
                    <SelectPrimitive.Item
                      key={preset.id}
                      value={`preset:${preset.id}`}
                      className="relative flex w-full cursor-default items-start gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <CheckIcon className="size-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <div className="flex flex-col">
                        <SelectPrimitive.ItemText>{preset.name}</SelectPrimitive.ItemText>
                        <span className="text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </div>
                    </SelectPrimitive.Item>
                  ))}
                </SelectGroup>
                {savedMappings.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Saved mappings</SelectLabel>
                      {savedMappings.map((saved) => (
                        <SelectPrimitive.Item
                          key={saved.id}
                          value={`saved:${saved.id}`}
                          className="relative flex w-full cursor-default items-start gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        >
                          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                            <SelectPrimitive.ItemIndicator>
                              <CheckIcon className="size-4" />
                            </SelectPrimitive.ItemIndicator>
                          </span>
                          <div className="flex flex-col">
                            <SelectPrimitive.ItemText>{saved.name}</SelectPrimitive.ItemText>
                            <span className="text-xs text-muted-foreground">
                              {savedMappingLabel(saved)}
                            </span>
                          </div>
                        </SelectPrimitive.Item>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* ---- Column Mapping ---- */}
          {isComplexPreset ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-500" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {CSV_PRESETS.find((p) => `preset:${p.id}` === quickMapValue)?.name} selected
                  </span>
                  <span className="text-muted-foreground">
                    This format uses special parsing logic (comment stripping,
                    directive conversion, or multi-path expansion). Columns will be
                    mapped automatically — no manual selection needed.
                  </span>
                </div>
              </div>

              {/* Per-preset option controls */}
              {(CSV_PRESETS.find((p) => `preset:${p.id}` === quickMapValue)?.optionDefs ?? []).map(
                (def: PresetOptionDef) =>
                  def.type === "boolean" ? (
                    <label
                      key={def.key}
                      className="flex cursor-pointer items-start gap-2.5 text-sm"
                    >
                      <Checkbox
                        checked={presetOptions[def.key] !== false}
                        onCheckedChange={(v) =>
                          setPresetOptions((prev) => ({ ...prev, [def.key]: v === true }))
                        }
                      />
                      <div className="flex flex-col gap-0.5">
                        <span>{def.label}</span>
                        {def.description && (
                          <span className="text-xs text-muted-foreground">{def.description}</span>
                        )}
                      </div>
                    </label>
                  ) : null
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Map Columns</span>
              <p className="text-xs text-muted-foreground -mt-1">
                Detected {rawHeaders.length} column{rawHeaders.length !== 1 ? "s" : ""} in your
                file. Use &ldquo;Combine columns&rdquo; to concatenate multiple columns into a
                single field.
              </p>
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
                <ColumnFieldEditor
                  label="source"
                  required
                  spec={sourceSpec}
                  rawHeaders={rawHeaders}
                  onChange={handleSourceChange}
                />
                <ColumnFieldEditor
                  label="destination"
                  required
                  spec={destSpec}
                  rawHeaders={rawHeaders}
                  onChange={handleDestChange}
                />

                {/* Status Code — stays as a single-column select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    status code
                  </label>
                  <Select
                    value={manualStatusCode}
                    onValueChange={(v) => { setManualStatusCode(v); setQuickMapValue(""); }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (use default)" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value={NO_COLUMN}>
                          <span className="text-muted-foreground">None — use default</span>
                        </SelectItem>
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>From column</SelectLabel>
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Default status code picker */}
              {manualStatusCode === NO_COLUMN && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Default status code:</span>
                  <div className="flex gap-1.5">
                    {STATUS_CODE_OPTIONS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setManualDefaultStatus(code)}
                        className="cursor-pointer"
                      >
                        <Badge variant={manualDefaultStatus === code ? "default" : "outline"}>
                          {code}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Preview ---- */}
          {rawPreview.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Preview</span>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {previewHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {previewHeaders.map((h) => (
                          <td
                            key={h}
                            className="max-w-[220px] truncate px-3 py-2 text-muted-foreground"
                            title={row[h] ?? ""}
                          >
                            {row[h] ?? (
                              <span className="italic text-muted-foreground/50">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!canConfirm && rawPreview.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Map at least <span className="font-medium">source</span> and{" "}
                  <span className="font-medium">destination</span> columns to see the mapped
                  preview.
                </p>
              )}
            </div>
          )}

          {/* ---- Full URL option ---- */}
          {canConfirm && (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={includeOrigin}
                onCheckedChange={(v) => setIncludeOrigin(v === true)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <GlobeIcon className="size-3.5" />
                  Keep full URLs in source
                  <span className="text-xs text-muted-foreground/60">(beta)</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Preserve scheme and domain (e.g. https://example.com/path instead of /path)
                </span>
              </div>
            </label>
          )}

          {/* ---- Save mapping ---- */}
          {!isComplexPreset && (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={shouldSave}
                  onCheckedChange={(v) => setShouldSave(v === true)}
                />
                Save this mapping for future imports
              </label>
              {shouldSave && (
                <div className="flex items-center gap-2 pl-6">
                  <SaveIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Mapping name…"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Apply Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
