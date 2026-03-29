"use client";

import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileUp, AlertCircle, X, GlobeIcon } from "lucide-react";

interface ParsedRedirect {
  source: string;
  destination: string;
  statusCode: number;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
}

interface ParseError {
  row: number;
  message: string;
}

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (redirects: ParsedRedirect[], overwrite: boolean) => void;
  loading?: boolean;
}

const VALID_STATUS_CODES = [301, 302, 303, 307, 308];

function parseCSV(text: string, includeOrigin = false): {
  redirects: ParsedRedirect[];
  errors: ParseError[];
} {
  const redirects: ParsedRedirect[] = [];
  const errors: ParseError[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    errors.push({ row: 0, message: "File is empty" });
    return { redirects, errors };
  }

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("source") || firstLine.includes("destination");
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const rowNum = i + 1;
    const line = lines[i];

    // Parse CSV respecting quoted fields
    const fields = parseCSVLine(line);

    if (fields.length < 2) {
      errors.push({
        row: rowNum,
        message: `Expected at least 2 columns (source, destination), got ${fields.length}`,
      });
      continue;
    }

    const source = fields[0].trim();
    const destination = fields[1].trim();
    const statusCodeStr = fields[2]?.trim();
    const caseSensitiveStr = fields[3]?.trim().toLowerCase();
    const preserveQueryStr = fields[4]?.trim().toLowerCase();

    if (!source) {
      errors.push({ row: rowNum, message: "Source is empty" });
      continue;
    }

    // Strip scheme and domain when includeOrigin is off
    let finalSource = source;
    if (!includeOrigin && !source.startsWith("/")) {
      try {
        const url = new URL(source);
        finalSource = url.pathname + url.search + url.hash;
      } catch {
        errors.push({
          row: rowNum,
          message: `Source must start with / or be a valid URL (got "${source}")`,
        });
        continue;
      }
    }

    if (includeOrigin && !source.startsWith("/") && !source.startsWith("http")) {
      errors.push({
        row: rowNum,
        message: `Source must start with / or http(s):// (got "${source}")`,
      });
      continue;
    }

    if (!destination) {
      errors.push({ row: rowNum, message: "Destination is empty" });
      continue;
    }

    let statusCode = 301;
    if (statusCodeStr) {
      statusCode = parseInt(statusCodeStr, 10);
      if (!VALID_STATUS_CODES.includes(statusCode)) {
        errors.push({
          row: rowNum,
          message: `Invalid status code: ${statusCodeStr} (must be ${VALID_STATUS_CODES.join(", ")})`,
        });
        continue;
      }
    }

    const redirect: ParsedRedirect = {
      source: finalSource,
      destination,
      statusCode,
    };

    if (caseSensitiveStr === "true" || caseSensitiveStr === "1") {
      redirect.caseSensitive = true;
    }
    if (preserveQueryStr === "true" || preserveQueryStr === "1") {
      redirect.preserveQueryParams = true;
    }

    redirects.push(redirect);
  }

  return { redirects, errors };
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  onUpload,
  loading,
}: CsvUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [includeOrigin, setIncludeOrigin] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Derive redirects + errors from rawText + includeOrigin (no effect needed)
  const { redirects, errors } = useMemo(() => {
    if (rawText === null) return { redirects: [] as ParsedRedirect[], errors: [] as ParseError[] };
    return parseCSV(rawText, includeOrigin);
  }, [rawText, includeOrigin]);

  function reset() {
    setFile(null);
    setParsed(false);
    setRawText(null);
    setIncludeOrigin(false);
    setOverwrite(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleFile(f: File) {
    setFile(f);
    const text = await f.text();
    setRawText(text);
    setParsed(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      handleFile(f);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  const previewRedirects = redirects.slice(0, 100);
  const hasMore = redirects.length > 100;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Redirects</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: source, destination, statusCode
            (optional), caseSensitive (optional), preserveQueryParams (optional)
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FileUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag and drop a CSV file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supported format: .csv
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file?.name}</span>
                <Badge variant="secondary">
                  {redirects.length} redirect{redirects.length !== 1 && "s"}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.length} error{errors.length !== 1 && "s"} found
                </div>
                <ul className="text-xs text-destructive/90 space-y-0.5 ml-6 list-disc">
                  {errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li>...and {errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview table */}
            {redirects.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Destination</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRedirects.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">
                          {r.source}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.statusCode === 301 || r.statusCode === 308
                                ? "default"
                                : "secondary"
                            }
                          >
                            {r.statusCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-[300px] truncate">
                          {r.destination}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasMore && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/50">
                    Showing first 100 of {redirects.length} redirects
                  </div>
                )}
              </div>
            )}

            {/* Full URL option */}
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={includeOrigin}
                onCheckedChange={(v) => setIncludeOrigin(v === true)}
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

            {/* Overwrite option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="overwrite"
                checked={overwrite}
                onCheckedChange={(checked) => setOverwrite(checked === true)}
              />
              <Label htmlFor="overwrite" className="text-sm font-normal">
                Replace all existing redirects (overwrite mode)
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onUpload(redirects, overwrite)}
            disabled={!parsed || redirects.length === 0 || loading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading
              ? "Uploading..."
              : `Stage ${redirects.length} Redirect${redirects.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
