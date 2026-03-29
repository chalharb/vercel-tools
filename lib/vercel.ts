const VERCEL_API_BASE = "https://api.vercel.com";

function getHeaders(): HeadersInit {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("VERCEL_TOKEN environment variable is not set");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function vercelFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${VERCEL_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${body}`);
  }
  return res;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
}

export async function listProjects(): Promise<VercelProject[]> {
  const projects: VercelProject[] = [];
  let from: string | undefined;

  // Paginate through all projects
  while (true) {
    const params = new URLSearchParams();
    const teamId = process.env.VERCEL_TEAM_ID;
    if (teamId) params.set("teamId", teamId);
    params.set("limit", "100");
    if (from) params.set("from", from);

    const res = await vercelFetch(`/v10/projects?${params.toString()}`);
    const data = await res.json();

    const batch = data.projects ?? data;
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const p of batch) {
      projects.push({
        id: p.id,
        name: p.name,
        framework: p.framework ?? null,
        updatedAt: p.updatedAt,
      });
    }

    // Vercel uses pagination.next or the last item's updatedAt
    if (data.pagination?.next) {
      from = String(data.pagination.next);
    } else {
      break;
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Redirects ───────────────────────────────────────────────────────────────

export interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  caseSensitive?: boolean;
  preserveQueryParams?: boolean;
  query?: boolean;
  /** Present only when fetched with diff=true. "+" = added, "-" = deleted, "~" = modified */
  action?: string;
}

export interface RedirectVersion {
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

export interface RedirectsResponse {
  version: RedirectVersion;
  redirects: Redirect[];
  pagination: {
    page: number;
    per_page: number;
    numPages: number;
  };
}

export interface VersionActionResponse {
  version: RedirectVersion;
}

export async function getRedirects(
  projectId: string,
  options: {
    versionId?: string;
    diff?: boolean;
    page?: number;
    perPage?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}
): Promise<RedirectsResponse> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);
  if (options.versionId) params.set("versionId", options.versionId);
  if (options.diff) params.set("diff", "true");
  if (options.page) params.set("page", String(options.page));
  if (options.perPage) params.set("per_page", String(options.perPage));
  if (options.search) params.set("q", options.search);
  if (options.sortBy) params.set("sort_by", options.sortBy);
  if (options.sortOrder) params.set("sort_order", options.sortOrder);

  const res = await vercelFetch(`/v1/bulk-redirects?${params.toString()}`);
  return res.json();
}

export async function stageRedirects(
  projectId: string,
  redirects: Redirect[],
  options: { overwrite?: boolean; name?: string } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const teamId = process.env.VERCEL_TEAM_ID;
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", teamId);

  const res = await vercelFetch(`/v1/bulk-redirects?${params.toString()}`, {
    method: "PUT",
    body: JSON.stringify({
      projectId,
      teamId,
      redirects,
      overwrite: options.overwrite ?? false,
      name: options.name,
    }),
  });
  return res.json();
}

export async function editRedirect(
  projectId: string,
  redirect: Redirect,
  options: { name?: string; restore?: boolean } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);

  const res = await vercelFetch(`/v1/bulk-redirects?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      redirect,
      name: options.name,
      restore: options.restore,
    }),
  });
  return res.json();
}

export async function deleteRedirects(
  projectId: string,
  sources: string[],
  options: { name?: string } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);

  const res = await vercelFetch(`/v1/bulk-redirects?${params.toString()}`, {
    method: "DELETE",
    body: JSON.stringify({
      redirects: sources,
      name: options.name,
    }),
  });
  return res.json();
}

export async function restoreRedirects(
  projectId: string,
  sources: string[],
  options: { name?: string } = {}
): Promise<{
  version: RedirectVersion;
  restored: string[];
  failedToRestore: string[];
}> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);

  const res = await vercelFetch(
    `/v1/bulk-redirects/restore?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({
        redirects: sources,
        name: options.name,
      }),
    }
  );
  return res.json();
}

// ─── Versions ────────────────────────────────────────────────────────────────

export async function getVersionHistory(
  projectId: string
): Promise<{ versions: RedirectVersion[] }> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);

  const res = await vercelFetch(
    `/v1/bulk-redirects/versions?${params.toString()}`
  );
  return res.json();
}

export async function updateVersion(
  projectId: string,
  versionId: string,
  action: "promote" | "restore" | "discard",
  options: { name?: string } = {}
): Promise<VersionActionResponse> {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  params.set("projectId", projectId);

  const res = await vercelFetch(
    `/v1/bulk-redirects/versions?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({
        id: versionId,
        action,
        name: options.name,
      }),
    }
  );
  return res.json();
}
