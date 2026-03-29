"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
}

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

type DiffType = "added" | "removed" | "modified" | "unchanged";

interface DiffEntry {
  source: string;
  type: DiffType;
  /** Redirect from the older (base) version */
  base?: Redirect;
  /** Redirect from the newer (head) version */
  head?: Redirect;
}

interface VersionCompareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  compareVersion: RedirectVersion | null;
  productionVersion: RedirectVersion | null;
}

function getStatusCode(r: Redirect): number {
  if (r.statusCode) return r.statusCode;
  if (r.permanent === true) return 308;
  if (r.permanent === false) return 307;
  return 307;
}

function redirectsEqual(a: Redirect, b: Redirect): boolean {
  return (
    a.destination === b.destination &&
    getStatusCode(a) === getStatusCode(b) &&
    (a.caseSensitive ?? false) === (b.caseSensitive ?? false) &&
    (a.preserveQueryParams ?? false) === (b.preserveQueryParams ?? false)
  );
}

async function fetchAllRedirects(
  projectId: string,
  versionId: string
): Promise<Redirect[]> {
  const all: Redirect[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({
      projectId,
      versionId,
      page: String(page),
      perPage: String(perPage),
    });
    const res = await fetch(`/api/redirects?${params.toString()}`);
    if (!res.ok) break;
    const data = await res.json();
    const redirects: Redirect[] = data.redirects ?? [];
    all.push(...redirects);
    const numPages = data.pagination?.numPages ?? 1;
    if (page >= numPages) break;
    page++;
  }

  return all;
}

function DiffBadge({ type }: { type: DiffType }) {
  const config: Record<DiffType, { label: string; className: string }> = {
    added: {
      label: "Added",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    removed: {
      label: "Removed",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    modified: {
      label: "Modified",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    unchanged: {
      label: "Unchanged",
      className: "",
    },
  };

  if (type === "unchanged") return null;

  const { label, className } = config[type];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function VersionCompare({
  open,
  onOpenChange,
  projectId,
  compareVersion,
  productionVersion,
}: VersionCompareProps) {
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffEntry[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<DiffType | "all">("all");

  // Determine which version is older (base) and which is newer (head)
  const [baseVersion, headVersion] = useMemo(() => {
    if (!compareVersion || !productionVersion) return [null, null];
    if (compareVersion.lastModified <= productionVersion.lastModified) {
      return [compareVersion, productionVersion];
    }
    return [productionVersion, compareVersion];
  }, [compareVersion, productionVersion]);

  useEffect(() => {
    if (!open || !baseVersion || !headVersion) return;

    setLoading(true);
    setSearch("");
    setFilterType("all");

    Promise.all([
      fetchAllRedirects(projectId, baseVersion.id),
      fetchAllRedirects(projectId, headVersion.id),
    ])
      .then(([baseRedirects, headRedirects]) => {
        const baseMap = new Map<string, Redirect>();
        for (const r of baseRedirects) {
          baseMap.set(r.source, r);
        }

        const headMap = new Map<string, Redirect>();
        for (const r of headRedirects) {
          headMap.set(r.source, r);
        }

        const entries: DiffEntry[] = [];
        const allSources = new Set([
          ...baseMap.keys(),
          ...headMap.keys(),
        ]);

        for (const source of allSources) {
          const b = baseMap.get(source);
          const h = headMap.get(source);

          if (b && h) {
            entries.push({
              source,
              type: redirectsEqual(b, h) ? "unchanged" : "modified",
              base: b,
              head: h,
            });
          } else if (b && !h) {
            // In base (older) but not in head (newer) — removed
            entries.push({
              source,
              type: "removed",
              base: b,
            });
          } else if (!b && h) {
            // In head (newer) but not in base (older) — added
            entries.push({
              source,
              type: "added",
              head: h,
            });
          }
        }

        // Sort: changes first (added, removed, modified), then unchanged
        const order: Record<DiffType, number> = {
          added: 0,
          removed: 1,
          modified: 2,
          unchanged: 3,
        };
        entries.sort(
          (a, b) =>
            order[a.type] - order[b.type] ||
            a.source.localeCompare(b.source)
        );

        setDiff(entries);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, baseVersion, headVersion, projectId]);

  const filtered = useMemo(() => {
    return diff.filter((entry) => {
      if (filterType !== "all" && entry.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const source = entry.source.toLowerCase();
        const dest =
          (entry.head?.destination ?? entry.base?.destination ?? "")
            .toLowerCase();
        if (!source.includes(q) && !dest.includes(q)) return false;
      }
      return true;
    });
  }, [diff, filterType, search]);

  const counts = useMemo(() => {
    const c = { added: 0, removed: 0, modified: 0, unchanged: 0 };
    for (const entry of diff) {
      c[entry.type]++;
    }
    return c;
  }, [diff]);

  function versionLabel(v: RedirectVersion | null): string {
    if (!v) return "Version";
    if (v.isLive) return "Production";
    if (v.isStaging) return "Staging";
    return v.name ?? new Date(v.lastModified).toLocaleDateString();
  }

  const baseLabel = versionLabel(baseVersion);
  const headLabel = versionLabel(headVersion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Compare: {baseLabel} &rarr; {headLabel}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Showing changes from {baseLabel} (older) to {headLabel} (newer).
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading redirects for comparison...
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
              >
                All ({diff.length})
              </Button>
              <Button
                variant={filterType === "added" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("added")}
                className={
                  counts.added > 0
                    ? "border-green-300 dark:border-green-700"
                    : ""
                }
              >
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5" />
                Added ({counts.added})
              </Button>
              <Button
                variant={filterType === "removed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("removed")}
                className={
                  counts.removed > 0
                    ? "border-red-300 dark:border-red-700"
                    : ""
                }
              >
                <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
                Removed ({counts.removed})
              </Button>
              <Button
                variant={filterType === "modified" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("modified")}
                className={
                  counts.modified > 0
                    ? "border-yellow-300 dark:border-yellow-700"
                    : ""
                }
              >
                <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1.5" />
                Modified ({counts.modified})
              </Button>
              <Button
                variant={filterType === "unchanged" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("unchanged")}
              >
                Unchanged ({counts.unchanged})
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by source or destination..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Diff table */}
            <div className="overflow-auto flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Change</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[60px]">Code</TableHead>
                    <TableHead>Destination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        {diff.length === 0
                          ? "No differences found."
                          : "No results match the current filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((entry) => (
                      <DiffRow key={entry.source} entry={entry} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const { type, source, base, head } = entry;

  if (type === "modified") {
    // Show two rows for modified: old (base) struck-through, new (head) below
    const baseCode = base ? getStatusCode(base) : null;
    const headCode = head ? getStatusCode(head) : null;
    const destChanged = base?.destination !== head?.destination;
    const codeChanged = baseCode !== headCode;

    return (
      <>
        <TableRow className="bg-red-50/50 dark:bg-red-950/20 border-b-0">
          <TableCell rowSpan={2} className="align-middle border-b">
            <DiffBadge type="modified" />
          </TableCell>
          <TableCell
            rowSpan={2}
            className="font-mono text-sm align-middle border-b"
          >
            {source}
          </TableCell>
          <TableCell>
            {baseCode && (
              <Badge
                variant="secondary"
                className={codeChanged ? "line-through opacity-60" : ""}
              >
                {baseCode}
              </Badge>
            )}
          </TableCell>
          <TableCell
            className={`font-mono text-sm max-w-[300px] truncate ${destChanged ? "line-through opacity-60" : ""}`}
          >
            {base?.destination}
          </TableCell>
        </TableRow>
        <TableRow className="bg-green-50/50 dark:bg-green-950/20">
          <TableCell>
            {headCode && (
              <Badge
                variant={
                  headCode === 301 || headCode === 308
                    ? "default"
                    : "secondary"
                }
              >
                {headCode}
              </Badge>
            )}
          </TableCell>
          <TableCell className="font-mono text-sm max-w-[300px] truncate">
            {head?.destination}
          </TableCell>
        </TableRow>
      </>
    );
  }

  const redirect = head ?? base;
  const code = redirect ? getStatusCode(redirect) : null;

  const rowClass =
    type === "added"
      ? "bg-green-50/50 dark:bg-green-950/20"
      : type === "removed"
        ? "bg-red-50/50 dark:bg-red-950/20"
        : "";

  return (
    <TableRow className={rowClass}>
      <TableCell>
        <DiffBadge type={type} />
      </TableCell>
      <TableCell
        className={`font-mono text-sm ${type === "removed" ? "line-through opacity-60" : ""}`}
      >
        {source}
      </TableCell>
      <TableCell>
        {code && (
          <Badge
            variant={
              code === 301 || code === 308 ? "default" : "secondary"
            }
          >
            {code}
          </Badge>
        )}
      </TableCell>
      <TableCell
        className={`font-mono text-sm max-w-[300px] truncate ${type === "removed" ? "line-through opacity-60" : ""}`}
      >
        {redirect?.destination}
      </TableCell>
    </TableRow>
  );
}
