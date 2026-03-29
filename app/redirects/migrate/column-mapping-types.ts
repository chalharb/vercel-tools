import type { ColumnMapping, CsvPreset, PresetOptions } from "./csv-presets";
import type { SavedMapping } from "./use-column-mapping";

/** The resolved mapping the dialog emits on confirm. */
export type ResolvedMapping =
  | { kind: "preset"; preset: CsvPreset; options?: PresetOptions }
  | { kind: "custom"; mapping: ColumnMapping };

export interface ColumnMappingDialogProps {
  open: boolean;
  /** Raw CSV headers from the uploaded file */
  rawHeaders: string[];
  /** A sample of raw rows (used for the preview table) */
  rawPreview: Record<string, string>[];
  /** Original raw file text — needed so preprocess-only presets can re-parse for preview */
  rawText?: string;
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

export const NO_COLUMN = "__none__";
export const STATUS_CODE_OPTIONS = ["301", "302", "307", "308"];
