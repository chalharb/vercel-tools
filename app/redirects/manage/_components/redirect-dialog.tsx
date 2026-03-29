"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
}

interface RedirectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (redirect: Redirect) => void;
  redirect?: Redirect | null;
  loading?: boolean;
}

export function RedirectDialog({
  open,
  onOpenChange,
  onSave,
  redirect,
  loading,
}: RedirectDialogProps) {
  const isEditing = !!redirect;
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [statusCode, setStatusCode] = useState("301");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [preserveQueryParams, setPreserveQueryParams] = useState(false);

  useEffect(() => {
    if (redirect) {
      setSource(redirect.source);
      setDestination(redirect.destination);
      setStatusCode(String(redirect.statusCode ?? 301));
      setCaseSensitive(redirect.caseSensitive ?? false);
      setPreserveQueryParams(redirect.preserveQueryParams ?? false);
    } else {
      setSource("");
      setDestination("");
      setStatusCode("301");
      setCaseSensitive(false);
      setPreserveQueryParams(false);
    }
  }, [redirect, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      source,
      destination,
      statusCode: Number(statusCode),
      caseSensitive,
      preserveQueryParams,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Redirect" : "Create Redirect"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              placeholder="/old-path"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isEditing}
              required
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Source cannot be changed. Delete and recreate to change.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              placeholder="/new-path or https://example.com"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statusCode">Status Code</Label>
            <Select value={statusCode} onValueChange={(v) => { if (v) setStatusCode(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="301">301 - Permanent</SelectItem>
                <SelectItem value="302">302 - Temporary</SelectItem>
                <SelectItem value="303">303 - See Other</SelectItem>
                <SelectItem value="307">307 - Temporary (strict)</SelectItem>
                <SelectItem value="308">308 - Permanent (strict)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="caseSensitive"
                checked={caseSensitive}
                onCheckedChange={(checked) =>
                  setCaseSensitive(checked === true)
                }
              />
              <Label htmlFor="caseSensitive" className="text-sm font-normal">
                Case sensitive
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="preserveQueryParams"
                checked={preserveQueryParams}
                onCheckedChange={(checked) =>
                  setPreserveQueryParams(checked === true)
                }
              />
              <Label
                htmlFor="preserveQueryParams"
                className="text-sm font-normal"
              >
                Preserve query params
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Redirect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
