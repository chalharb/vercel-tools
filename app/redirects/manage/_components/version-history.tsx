"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface RedirectVersion {
  id: string;
  key: string;
  lastModified: number;
  createdBy: string;
  name?: string;
  isStaging?: boolean;
  isLive?: boolean;
  redirectCount?: number;
}

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onVersionAction: (
    versionId: string,
    action: "promote" | "restore" | "discard"
  ) => void;
}

export function VersionHistory({
  open,
  onOpenChange,
  projectId,
  onVersionAction,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<RedirectVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    fetch(`/api/redirects/versions?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No version history found.
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version, index) => (
              <div key={version.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {version.name ??
                          new Date(version.lastModified).toLocaleString()}
                      </span>
                      {version.isLive && (
                        <Badge variant="default">Production</Badge>
                      )}
                      {version.isStaging && (
                        <Badge variant="secondary">Staging</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {version.redirectCount != null &&
                        `${version.redirectCount} redirects · `}
                      {new Date(version.lastModified).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {version.isStaging && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            onVersionAction(version.id, "promote")
                          }
                        >
                          Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onVersionAction(version.id, "discard")
                          }
                        >
                          Discard
                        </Button>
                      </>
                    )}
                    {!version.isStaging && !version.isLive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onVersionAction(version.id, "restore")
                        }
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                {index < versions.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
