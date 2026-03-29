"use client";

import { useCallback, useState } from "react";
import { ChevronDownIcon, FileTextIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { CSV_EXAMPLES, type CsvExample } from "./examples";

interface CsvDropzoneProps {
  onFile: (file: File) => void;
  onLoadExample: (example: CsvExample) => void;
}

export function CsvDropzone({ onFile, onLoadExample }: CsvDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Drop a file here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Supports .csv, .htaccess, and other text formats
          </p>
        </div>
        <input
          type="file"
          accept="text/*,.csv,.tsv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
          className="sr-only"
        />
      </label>
      <div className="flex items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <FileTextIcon data-icon="inline-start" />
              or try an example
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-56">
            <DropdownMenuLabel>Load example</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {CSV_EXAMPLES.map((example) => (
                <DropdownMenuItem
                  key={example.id}
                  onSelect={() => onLoadExample(example)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{example.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {example.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
