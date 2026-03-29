"use client";

import {
  CheckIcon,
  GlobeIcon,
  InfoIcon,
  SaveIcon,
  ZapIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { CSV_PRESETS, type PresetOptionDef } from "./csv-presets";
import {
  type ColumnMappingDialogProps,
  NO_COLUMN,
  STATUS_CODE_OPTIONS,
} from "./column-mapping-types";
import { savedMappingLabel } from "./column-mapping-utils";
import { ColumnFieldEditor } from "./column-field-editor";
import { useColumnMappingDialog } from "../_hooks/use-column-mapping-dialog";

export type { ResolvedMapping } from "./column-mapping-types";
export type { ColumnMappingDialogProps } from "./column-mapping-types";

export function ColumnMappingDialog({
  open,
  rawHeaders,
  rawPreview,
  rawText,
  fileName,
  savedMappings,
  presetHint,
  onCancel,
  onConfirm,
}: ColumnMappingDialogProps) {
  const state = useColumnMappingDialog({
    open,
    rawHeaders,
    rawPreview,
    rawText,
    savedMappings,
    presetHint,
  });

  function handleConfirm() {
    if (!state.resolvedMapping || !state.canConfirm) return;
    onConfirm(
      state.resolvedMapping,
      {
        shouldSave: state.shouldSave,
        name: state.saveName.trim() || "Custom Mapping",
      },
      { includeOrigin: state.includeOrigin },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl top-[10vh] translate-y-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Column Mapping</DialogTitle>
          <DialogDescription>
            Map columns from{" "}
            <span className="font-medium text-foreground">{fileName}</span> to
            the fields Vercel Bulk Redirects expect.
          </DialogDescription>
          <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
            <InfoIcon />
            <AlertTitle>Functionality Limitation</AlertTitle>
            <AlertDescription>
              Vercel&apos;s Bulk Redirects does not currently support{" "}
              <a href="https://vercel.com/docs/routing/redirects/bulk-redirects#limits-and-pricing">
                wildcards or pattern matching
              </a>
              .
            </AlertDescription>
          </Alert>
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
            <Select
              value={state.quickMapValue}
              onValueChange={state.handleQuickMapChange}
            >
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
                        <SelectPrimitive.ItemText>
                          {preset.name}
                        </SelectPrimitive.ItemText>
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
                            <SelectPrimitive.ItemText>
                              {saved.name}
                            </SelectPrimitive.ItemText>
                            <span className="text-xs text-muted-foreground">
                              {savedMappingLabel(saved.mapping)}
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
          {state.isComplexPreset ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-500" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {state.activePreset?.name} selected
                  </span>
                  <span className="text-muted-foreground">
                    This format uses special parsing logic (comment stripping,
                    directive conversion, or multi-path expansion). Columns will
                    be mapped automatically — no manual selection needed.
                  </span>
                </div>
              </div>

              {/* Per-preset option controls */}
              {(state.activePreset?.optionDefs ?? []).map(
                (def: PresetOptionDef) =>
                  def.type === "boolean" ? (
                    <label
                      key={def.key}
                      className="flex cursor-pointer items-start gap-2.5 text-sm"
                    >
                      <Checkbox
                        checked={state.presetOptions[def.key] !== false}
                        onCheckedChange={(v) =>
                          state.handlePresetOptionChange(def.key, v === true)
                        }
                      />
                      <div className="flex flex-col gap-0.5">
                        <span>{def.label}</span>
                        {def.description && (
                          <span className="text-xs text-muted-foreground">
                            {def.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ) : null,
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Map Columns</span>
              <p className="text-xs text-muted-foreground -mt-1">
                Detected {rawHeaders.length} column
                {rawHeaders.length !== 1 ? "s" : ""} in your file. Use
                &ldquo;Combine columns&rdquo; to concatenate multiple columns
                into a single field.
              </p>
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
                <ColumnFieldEditor
                  label="source"
                  required
                  spec={state.sourceSpec}
                  rawHeaders={rawHeaders}
                  onChange={state.handleSourceChange}
                />
                <ColumnFieldEditor
                  label="destination"
                  required
                  spec={state.destSpec}
                  rawHeaders={rawHeaders}
                  onChange={state.handleDestChange}
                />

                {/* Status Code — stays as a single-column select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    status code
                  </label>
                  <Select
                    value={state.manualStatusCode}
                    onValueChange={state.handleStatusCodeChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (use default)" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value={NO_COLUMN}>
                          <span className="text-muted-foreground">
                            None — use default
                          </span>
                        </SelectItem>
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>From column</SelectLabel>
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Default status code picker */}
              {state.manualStatusCode === NO_COLUMN && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Default status code:
                  </span>
                  <div className="flex gap-1.5">
                    {STATUS_CODE_OPTIONS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => state.setManualDefaultStatus(code)}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={
                            state.manualDefaultStatus === code
                              ? "default"
                              : "outline"
                          }
                        >
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
                      {state.previewHeaders.map((h) => (
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
                    {state.previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {state.previewHeaders.map((h) => (
                          <td
                            key={h}
                            className="max-w-[220px] truncate px-3 py-2 text-muted-foreground"
                            title={row[h] ?? ""}
                          >
                            {row[h] ?? (
                              <span className="italic text-muted-foreground/50">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!state.canConfirm && rawPreview.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Map at least <span className="font-medium">source</span> and{" "}
                  <span className="font-medium">destination</span> columns to
                  see the mapped preview.
                </p>
              )}
            </div>
          )}

          {/* ---- Full URL option ---- */}
          {state.canConfirm && (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={state.includeOrigin}
                onCheckedChange={(v) => state.setIncludeOrigin(v === true)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <GlobeIcon className="size-3.5" />
                  Keep full URLs in source
                  <span className="text-xs text-muted-foreground/60">
                    (beta)
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Preserve scheme and domain (e.g. https://example.com/path
                  instead of /path)
                </span>
              </div>
            </label>
          )}

          {/* ---- Save mapping ---- */}
          {!state.isComplexPreset && (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={state.shouldSave}
                  onCheckedChange={(v) => state.setShouldSave(v === true)}
                />
                Save this mapping for future imports
              </label>
              {state.shouldSave && (
                <div className="flex items-center gap-2 pl-6">
                  <SaveIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={state.saveName}
                    onChange={(e) => state.setSaveName(e.target.value)}
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
          <Button onClick={handleConfirm} disabled={!state.canConfirm}>
            Apply Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
