"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnFieldSpec } from "./csv-presets";
import {
  appendColumn,
  removeColumn,
  updateSeparator,
} from "./column-mapping-utils";

interface ColumnFieldEditorProps {
  label: string;
  required?: boolean;
  spec: ColumnFieldSpec;
  rawHeaders: string[];
  onChange: (spec: ColumnFieldSpec) => void;
}

export function ColumnFieldEditor({
  label,
  required,
  spec,
  rawHeaders,
  onChange,
}: ColumnFieldEditorProps) {
  const [isCombining, setIsCombining] = useState(spec.columns.length > 1);

  // Sync isCombining when spec changes externally (e.g. preset applied)
  const [prevColCount, setPrevColCount] = useState(spec.columns.length);
  if (spec.columns.length !== prevColCount) {
    setPrevColCount(spec.columns.length);
    if (spec.columns.length <= 1) setIsCombining(false);
  }

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
        <Select
          value={spec.columns[0] ?? ""}
          onValueChange={handleSingleSelect}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick column…" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {rawHeaders.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
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
                <span className="text-xs font-mono font-medium flex-1">
                  {col}
                </span>
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
                  <span className="text-xs text-muted-foreground shrink-0 w-16">
                    separator
                  </span>
                  <Input
                    value={spec.separators?.[idx] ?? ""}
                    onChange={(e) =>
                      onChange(updateSeparator(spec, idx, e.target.value))
                    }
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
              <Select
                value=""
                onValueChange={(col) => onChange(appendColumn(spec, col))}
              >
                <SelectTrigger className="h-7 w-full text-xs border-dashed">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <PlusIcon className="size-3" />
                    Add column…
                  </span>
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {availableHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
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
