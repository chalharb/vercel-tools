"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RedirectsTable } from "./_components/redirects-table";
import { RedirectsTableSkeleton } from "./_components/redirects-table-skeleton";
import { RedirectDialog } from "./_components/redirect-dialog";
import { CsvUploadDialog } from "./_components/csv-upload-dialog";
import { VersionHistory } from "./_components/version-history";
import { VersionCompare } from "./_components/version-compare";
import { ProjectSelector } from "./_components/project-selector";
import { toast } from "sonner";
import type { VercelProject } from "@/lib/redirects-api";
import { Plus, History, Search, Trash2, Upload, FileUp, RotateCcw } from "lucide-react";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
  action?: string;
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
  alias?: string;
}

interface Pagination {
  page: number;
  per_page: number;
  numPages: number;
}

type TabValue = "production" | "staging";

interface RedirectsManagerProps {
  projects: VercelProject[];
  initialProjectId: string;
  initialProjectName: string;
}

export function RedirectsManager({
  projects,
  initialProjectId,
  initialProjectName,
}: RedirectsManagerProps) {
  const router = useRouter();

  // Project state
  const [projectId] = useState<string>(initialProjectId);
  const [projectName] = useState<string>(initialProjectName);

  // Tab / view state
  const [activeTab, setActiveTab] = useState<TabValue>("production");

  // Redirects state
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [version, setVersion] = useState<RedirectVersion | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("source");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);

  // Selection state
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [saving, setSaving] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Full URL (beta) option

  // Version history
  const [historyOpen, setHistoryOpen] = useState(false);

  // Version compare
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersion, setCompareVersion] = useState<RedirectVersion | null>(
    null
  );

  // We need both production and staging versions to know if staging exists
  const [productionVersion, setProductionVersion] =
    useState<RedirectVersion | null>(null);
  const [stagingVersion, setStagingVersion] = useState<RedirectVersion | null>(
    null
  );

  const perPage = 20;

  // Fetch versions to determine staging/production state
  const fetchVersions = useCallback(
    async (pid: string) => {
      try {
        const res = await fetch(
          `/api/redirects/versions?projectId=${pid}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const versions: RedirectVersion[] = data.versions ?? [];
        setProductionVersion(versions.find((v) => v.isLive) ?? null);
        setStagingVersion(versions.find((v) => v.isStaging) ?? null);
      } catch {
        // ignore
      }
    },
    []
  );

  // Fetch redirects
  const fetchRedirects = useCallback(
    async (
      pid: string,
      opts?: {
        tab?: TabValue;
        pg?: number;
        q?: string;
        sb?: string;
        so?: string;
      }
    ) => {
      setLoading(true);
      const tab = opts?.tab ?? activeTab;
      const currentPage = opts?.pg ?? page;
      const currentSearch = opts?.q ?? search;
      const currentSortBy = opts?.sb ?? sortBy;
      const currentSortOrder = opts?.so ?? sortOrder;

      try {
        // 1. Fetch version history to find staging vs production version IDs
        const versionsRes = await fetch(
          `/api/redirects/versions?projectId=${pid}`
        );
        let prodVer: RedirectVersion | null = null;
        let stagingVer: RedirectVersion | null = null;

        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          const versions: RedirectVersion[] = versionsData.versions ?? [];
          prodVer = versions.find((v) => v.isLive) ?? null;
          stagingVer = versions.find((v) => v.isStaging) ?? null;
          setProductionVersion(prodVer);
          setStagingVersion(stagingVer);
        }

        // 2. If viewing staging but no staging version exists, show empty state
        if (tab === "staging" && !stagingVer) {
          setRedirects([]);
          setVersion(null);
          setPagination(null);
          setSelectedSources(new Set());
          setLoading(false);
          return;
        }

        // 3. Build the request with the correct versionId
        const params = new URLSearchParams({
          projectId: pid,
          page: String(currentPage),
          perPage: String(perPage),
          sortBy: currentSortBy,
          sortOrder: currentSortOrder,
        });

        if (currentSearch) params.set("search", currentSearch);

        // The Vercel GET /v1/bulk-redirects endpoint returns the live version
        // by default. To get staging, we must explicitly pass the staging versionId
        // and use diff=true to only show changed/added/deleted redirects.
        if (tab === "production" && prodVer) {
          params.set("versionId", prodVer.id);
        } else if (tab === "staging" && stagingVer) {
          params.set("versionId", stagingVer.id);
          params.set("diff", "true");
        }

        const res = await fetch(`/api/redirects?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to fetch");
        }
        const data = await res.json();

        // When viewing staging with diff=true, only show redirects that have
        // an action ("+", "-", "~") — these are the actual changes.
        const allRedirects: Redirect[] = data.redirects ?? [];
        if (tab === "staging") {
          setRedirects(allRedirects.filter((r) => r.action));
        } else {
          setRedirects(allRedirects);
        }

        // Overlay isLive/isStaging from the versions list onto the version
        // object, since the redirects endpoint doesn't return those flags.
        const ver = data.version ?? null;
        if (ver) {
          if (tab === "production" && prodVer) {
            ver.isLive = true;
            ver.isStaging = false;
            ver.redirectCount = prodVer.redirectCount;
          } else if (tab === "staging" && stagingVer) {
            ver.isLive = false;
            ver.isStaging = true;
            ver.redirectCount = stagingVer.redirectCount;
          }
        }
        setVersion(ver);
        setPagination(data.pagination ?? null);
        setSelectedSources(new Set());
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load redirects"
        );
        setRedirects([]);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, page, search, sortBy, sortOrder]
  );

  // When project or tab changes
  useEffect(() => {
    if (projectId) {
      setPage(1);
      fetchRedirects(projectId, { tab: activeTab, pg: 1 });
    }
  }, [projectId, activeTab, fetchRedirects]);

  function handleProjectSelect(id: string) {
    router.push(`/redirects/manage/${id}`);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    if (projectId) {
      fetchRedirects(projectId, { q: value, pg: 1 });
    }
  }

  function handleSort(field: string) {
    const newOrder =
      sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    if (projectId) {
      fetchRedirects(projectId, { sb: field, so: newOrder });
    }
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    if (projectId) {
      fetchRedirects(projectId, { pg: newPage });
    }
  }

  // Create or edit redirect
  async function handleSaveRedirect(redirect: Redirect) {
    if (!projectId) return;
    setSaving(true);

    try {
      if (editingRedirect) {
        // Edit existing
        const res = await fetch("/api/redirects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, redirect }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to edit redirect");
        }
        toast.success("Redirect updated (staged)");
      } else {
        // Create new
        const res = await fetch("/api/redirects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, redirects: [redirect] }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create redirect");
        }
        toast.success("Redirect created (staged)");
      }

      setDialogOpen(false);
      setEditingRedirect(null);
      // Switch to staging tab to show the change
      setActiveTab("staging");
      fetchRedirects(projectId, { tab: "staging", pg: 1 });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save redirect"
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete redirects
  async function handleDelete(sources: string[]) {
    if (!projectId || sources.length === 0) return;

    try {
      const res = await fetch("/api/redirects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sources }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete");
      }
      toast.success(
        `${sources.length} redirect(s) deleted (staged)`
      );
      setSelectedSources(new Set());
      setActiveTab("staging");
      fetchRedirects(projectId, { tab: "staging", pg: 1 });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete redirects"
      );
    }
  }

  // Bulk upload redirects from CSV to staging
  async function handleBulkUpload(redirectsToUpload: Redirect[], overwrite: boolean) {
    if (!projectId || redirectsToUpload.length === 0) return;

    setUploadingCsv(true);
    try {
      const res = await fetch("/api/redirects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          redirects: redirectsToUpload,
          overwrite,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to stage CSV redirects");
      }

      toast.success(
        `${redirectsToUpload.length} redirect${redirectsToUpload.length !== 1 ? "s" : ""} uploaded to staging`
      );
      setCsvDialogOpen(false);
      setActiveTab("staging");
      fetchRedirects(projectId, { tab: "staging", pg: 1 });
      fetchVersions(projectId);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload CSV redirects"
      );
    } finally {
      setUploadingCsv(false);
    }
  }

  // Version actions (promote, discard, restore)
  async function handleVersionAction(
    versionId: string,
    action: "promote" | "restore" | "discard"
  ) {
    if (!projectId) return;

    try {
      const res = await fetch("/api/redirects/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, versionId, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `Failed to ${action}`);
      }

      const actionLabels = {
        promote: "published to production",
        restore: "restored",
        discard: "discarded",
      };
      toast.success(`Version ${actionLabels[action]}`);
      setHistoryOpen(false);

      if (action === "promote" || action === "discard") {
        setActiveTab("production");
      }
      fetchRedirects(projectId, {
        tab: action === "promote" || action === "discard" ? "production" : activeTab,
        pg: 1,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to ${action} version`
      );
    }
  }

  // Publish staging to production
  async function handlePublish() {
    if (!stagingVersion) return;
    await handleVersionAction(stagingVersion.id, "promote");
  }

  // Discard staging
  async function handleDiscardStaging() {
    if (!stagingVersion) return;

    const confirmed = window.confirm(
      "Discard all staged changes? This cannot be undone."
    );
    if (!confirmed) return;

    await handleVersionAction(stagingVersion.id, "discard");
  }

  const redirectCount =
    activeTab === "staging"
      ? (stagingVersion?.redirectCount ?? version?.redirectCount ?? 0)
      : (productionVersion?.redirectCount ?? version?.redirectCount ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProjectSelector
            projects={projects}
            selectedProjectName={projectName}
            onProjectSelect={handleProjectSelect}
          />
        </div>
      </div>

      {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabValue)}
              >
                <TabsList>
                  <TabsTrigger value="production">Production</TabsTrigger>
                  <TabsTrigger value="staging" className="relative">
                    Staging
                    {stagingVersion && (
                      <span className="ml-1.5 h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search redirects..."
                  className="pl-9 w-75"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setHistoryOpen(true)}
                title="Version history"
              >
                <History className="h-4 w-4" />
              </Button>

            </div>

            <div className="flex items-center gap-2">
              {selectedSources.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(Array.from(selectedSources))}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedSources.size})
                </Button>
              )}

              {stagingVersion && activeTab === "staging" && (
                <>
                  <Button
                  size="default"
                    onClick={handleDiscardStaging}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Discard Changes
                  </Button>
                  <Button onClick={handlePublish}>
                    <Upload className="mr-2 h-4 w-4" />
                    Publish to Production
                  </Button>
                </>
              )}

              <Button
                onClick={() => {
                  setEditingRedirect(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Redirect
              </Button>

              <Button
                variant="outline"
                onClick={() => setCsvDialogOpen(true)}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Bulk Upload CSV
              </Button>
            </div>
          </div>

          {/* Usage info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Redirects usage: {redirectCount.toLocaleString()} of 10,000
            </span>
            {version && (
              <Badge variant="outline" className="text-xs">
                {version.isStaging
                  ? "Staged"
                  : version.isLive
                    ? "Live"
                    : "Version"}
              </Badge>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <RedirectsTableSkeleton />
          ) : activeTab === "staging" && !stagingVersion ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No staged changes</p>
              <p className="mt-1 text-sm">
                Create or edit a redirect to stage changes. Staged changes can be
                reviewed and then published to production.
              </p>
            </div>
          ) : (
            <RedirectsTable
              redirects={redirects}
              selectedSources={selectedSources}
              onSelectionChange={setSelectedSources}
              onEdit={(r) => {
                setEditingRedirect(r);
                setDialogOpen(true);
              }}
              onDelete={handleDelete}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              showActions={activeTab === "staging"}
            />
          )}

          {/* Pagination */}
          {pagination && pagination.numPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Show {perPage}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {page} of {pagination.numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.numPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Dialogs */}
          <RedirectDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingRedirect(null);
            }}
            onSave={handleSaveRedirect}
            redirect={editingRedirect}
            loading={saving}
          />

          <CsvUploadDialog
            open={csvDialogOpen}
            onOpenChange={setCsvDialogOpen}
            onUpload={handleBulkUpload}
            loading={uploadingCsv}
          />

          <VersionHistory
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            projectId={projectId}
            onVersionAction={handleVersionAction}
            onCompare={(version) => {
              setCompareVersion(version);
              setCompareOpen(true);
            }}
          />

          <VersionCompare
            open={compareOpen}
            onOpenChange={setCompareOpen}
            projectId={projectId}
            compareVersion={compareVersion}
            productionVersion={productionVersion}
          />
    </div>
  );
}
