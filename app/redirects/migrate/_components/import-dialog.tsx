"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  framework: string | null;
}

interface ImportRedirect {
  source: string;
  destination: string;
  statusCode?: number;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirects: ImportRedirect[];
}

type ImportState =
  | { step: "select" }
  | { step: "importing" }
  | { step: "success"; projectId: string; projectName: string; count: number }
  | { step: "error"; message: string };

export function ImportDialog({
  open,
  onOpenChange,
  redirects,
}: ImportDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [overwrite, setOverwrite] = useState(false);
  const [importState, setImportState] = useState<ImportState>({
    step: "select",
  });

  // Fetch projects when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingProjects(true);
    setImportState({ step: "select" });
    setSelectedProjectId("");
    setOverwrite(false);

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list.length === 1) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [open]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleImport = useCallback(async () => {
    if (!selectedProjectId || redirects.length === 0) return;

    setImportState({ step: "importing" });

    try {
      const res = await fetch("/api/redirects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          redirects,
          overwrite,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error ?? `Failed to stage redirects (${res.status})`,
        );
      }

      setImportState({
        step: "success",
        projectId: selectedProjectId,
        projectName: selectedProject?.name ?? selectedProjectId,
        count: redirects.length,
      });
    } catch (err) {
      setImportState({
        step: "error",
        message:
          err instanceof Error ? err.message : "Failed to stage redirects",
      });
    }
  }, [selectedProjectId, redirects, overwrite, selectedProject]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {importState.step === "success" ? (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Successfully staged {importState.count} redirect
                {importState.count !== 1 ? "s" : ""} to{" "}
                <span className="font-medium text-foreground">
                  {importState.projectName}
                </span>
                . The redirects are now in staging and can be reviewed before
                publishing to production.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button asChild>
                <Link href={`/redirects/manage/${importState.projectId}`}>
                  Review in Manager
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Import to Vercel</DialogTitle>
              <DialogDescription>
                Stage {redirects.length} redirect
                {redirects.length !== 1 ? "s" : ""} into a project. Staged
                redirects can be reviewed and published from the manager.
              </DialogDescription>
            </DialogHeader>

            {loadingProjects ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No projects found. Create a project on Vercel first.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-project">Project</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(v) => {
                      if (v) setSelectedProjectId(v);
                    }}
                  >
                    <SelectTrigger id="import-project">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="import-overwrite"
                    checked={overwrite}
                    onCheckedChange={(checked) =>
                      setOverwrite(checked === true)
                    }
                  />
                  <Label
                    htmlFor="import-overwrite"
                    className="text-sm font-normal"
                  >
                    Overwrite existing staged redirects
                  </Label>
                </div>

                {importState.step === "error" && (
                  <p className="text-sm text-destructive">
                    {importState.message}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  !selectedProjectId ||
                  importState.step === "importing" ||
                  loadingProjects ||
                  projects.length === 0
                }
              >
                {importState.step === "importing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Staging...
                  </>
                ) : (
                  "Stage Redirects"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
