import { useEffect, useMemo, useState } from "react";
import {
  CSV_PRESETS,
  type ColumnFieldSpec,
  type ColumnMapping,
  type PresetOptionDef,
  type PresetOptions,
} from "./csv-presets";
import { detectMapping, singleSpec, type SavedMapping } from "./use-column-mapping";
import { type ResolvedMapping, NO_COLUMN } from "./column-mapping-types";
import { buildPreviewRows, EMPTY_SPEC, isMappingComplete } from "./column-mapping-utils";

interface UseColumnMappingDialogArgs {
  open: boolean;
  rawHeaders: string[];
  rawPreview: Record<string, string>[];
  rawText?: string;
  savedMappings: SavedMapping[];
  presetHint?: ResolvedMapping;
}

export function useColumnMappingDialog({
  open,
  rawHeaders,
  rawPreview,
  rawText,
  savedMappings,
  presetHint,
}: UseColumnMappingDialogArgs) {
  // Quick-map selector: "preset:<id>" | "saved:<id>" | ""
  const [quickMapValue, setQuickMapValue] = useState<string>("");

  // Manual mapping field specs
  const [sourceSpec, setSourceSpec] = useState<ColumnFieldSpec>(EMPTY_SPEC);
  const [destSpec, setDestSpec] = useState<ColumnFieldSpec>(EMPTY_SPEC);
  const [manualStatusCode, setManualStatusCode] = useState<string>(NO_COLUMN);
  const [manualDefaultStatus, setManualDefaultStatus] = useState<string>("308");

  // Preset options (for complex presets with optionDefs)
  const [presetOptions, setPresetOptions] = useState<PresetOptions>({});

  // Keep full URLs in source
  const [includeOrigin, setIncludeOrigin] = useState(false);

  // Save toggle
  const [shouldSave, setShouldSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  // ------------------------------------------------------------------
  // Internal helpers
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

  function initPresetOptions(preset: { optionDefs?: PresetOptionDef[] }) {
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
  // Handlers
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

  function handleSourceChange(spec: ColumnFieldSpec) {
    setSourceSpec(spec);
    setQuickMapValue("");
  }

  function handleDestChange(spec: ColumnFieldSpec) {
    setDestSpec(spec);
    setQuickMapValue("");
  }

  function handleStatusCodeChange(v: string) {
    setManualStatusCode(v);
    setQuickMapValue("");
  }

  function handlePresetOptionChange(key: string, value: boolean) {
    setPresetOptions((prev) => ({ ...prev, [key]: value }));
  }

  // ------------------------------------------------------------------
  // Derived values
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

  const activePreset = useMemo(() => {
    if (!quickMapValue.startsWith("preset:")) return null;
    const id = quickMapValue.slice("preset:".length);
    return CSV_PRESETS.find((p) => p.id === id) ?? null;
  }, [quickMapValue]);

  const previewRows = useMemo(
    () => buildPreviewRows(rawPreview, resolvedMapping, rawHeaders, includeOrigin, rawText),
    [rawPreview, resolvedMapping, rawHeaders, includeOrigin, rawText]
  );

  const previewHeaders = useMemo(() => {
    if (resolvedMapping && isMappingComplete(resolvedMapping)) {
      return ["source", "destination", "statusCode"];
    }
    return rawHeaders.slice(0, 4);
  }, [resolvedMapping, rawHeaders]);

  const canConfirm = isMappingComplete(resolvedMapping);

  return {
    // State
    quickMapValue,
    sourceSpec,
    destSpec,
    manualStatusCode,
    manualDefaultStatus,
    presetOptions,
    includeOrigin,
    shouldSave,
    saveName,

    // Derived
    resolvedMapping,
    isComplexPreset,
    activePreset,
    previewRows,
    previewHeaders,
    canConfirm,

    // Setters
    setIncludeOrigin,
    setShouldSave,
    setSaveName,
    setManualDefaultStatus,

    // Handlers
    handleQuickMapChange,
    handleSourceChange,
    handleDestChange,
    handleStatusCodeChange,
    handlePresetOptionChange,
  };
}
