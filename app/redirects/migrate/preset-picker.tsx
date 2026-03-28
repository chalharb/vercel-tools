import { ChevronDownIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CSV_PRESETS, type CsvPreset } from "./csv-presets";

interface PresetPickerProps {
  activePreset: CsvPreset | null;
  onSelect: (preset: CsvPreset | null) => void;
}

export function PresetPicker({ activePreset, onSelect }: PresetPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-56 justify-between">
          <ZapIcon data-icon="inline-start" />
          {activePreset ? activePreset.name : "CSV Format"}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Quick-set CSV format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {CSV_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onSelect(preset)}
            >
              <div className="flex flex-col">
                <span className="font-medium">{preset.name}</span>
                <span className="text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {activePreset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onSelect(null)}>
                Clear format
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
