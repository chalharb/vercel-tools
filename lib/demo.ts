/**
 * Demo implementation of the Vercel redirects API.
 * Mirrors every export from lib/vercel.ts but backed by in-memory demo data.
 * All mutations persist for the lifetime of the server process.
 */

import type {
  VercelProject,
  Redirect,
  RedirectVersion,
  RedirectsResponse,
  VersionActionResponse,
} from "./vercel";
import { getAllProjects, getProjectState } from "./demo-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let idCounter = Date.now();
function nextId(): string {
  return `demo-${++idCounter}`;
}

function getStatusCode(r: Redirect): number {
  if (r.statusCode) return r.statusCode;
  if (r.permanent === true) return 308;
  if (r.permanent === false) return 307;
  return 307;
}

function redirectsEqual(a: Redirect, b: Redirect): boolean {
  return (
    a.source === b.source &&
    a.destination === b.destination &&
    getStatusCode(a) === getStatusCode(b)
  );
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<VercelProject[]> {
  return getAllProjects();
}

// ─── Redirects ───────────────────────────────────────────────────────────────

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
  const state = getProjectState(projectId);
  const versionId = options.versionId;

  // Find the requested version, default to the live version
  let version =
    state.versions.find((v) => v.id === versionId) ??
    state.versions.find((v) => v.isLive) ??
    state.versions[0];

  if (!version) {
    return {
      version: {
        id: "empty",
        key: "empty",
        lastModified: Date.now(),
        createdBy: "demo",
        redirectCount: 0,
      },
      redirects: [],
      pagination: { page: 1, per_page: 20, numPages: 1 },
    };
  }

  let redirects = deepClone(state.redirectsByVersion.get(version.id) ?? []);

  // Diff mode: compare staging against production
  if (options.diff && version.isStaging) {
    const prodVersion = state.versions.find((v) => v.isLive);
    const prodRedirects = prodVersion
      ? (state.redirectsByVersion.get(prodVersion.id) ?? [])
      : [];
    const prodMap = new Map(prodRedirects.map((r) => [r.source, r]));
    const stagingMap = new Map(redirects.map((r) => [r.source, r]));

    const diffed: Redirect[] = [];

    // Check staging redirects against production
    for (const r of redirects) {
      const prod = prodMap.get(r.source);
      if (!prod) {
        diffed.push({ ...r, action: "+" });
      } else if (!redirectsEqual(r, prod)) {
        diffed.push({ ...r, action: "~" });
      }
      // unchanged: don't add action, but we still include them so pagination
      // counts are correct; the client filters by action for staging tab
    }

    // Check for deleted (in production but not in staging)
    for (const r of prodRedirects) {
      if (!stagingMap.has(r.source)) {
        diffed.push({ ...r, action: "-" });
      }
    }

    // Also include unchanged for completeness (client filters these out for
    // the staging tab, but they need to be present for correct counts)
    for (const r of redirects) {
      const prod = prodMap.get(r.source);
      if (prod && redirectsEqual(r, prod)) {
        diffed.push({ ...r });
      }
    }

    redirects = diffed;
  }

  // Search
  if (options.search) {
    const q = options.search.toLowerCase();
    redirects = redirects.filter(
      (r) =>
        r.source.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
    );
  }

  // Sort
  const sortBy = options.sortBy ?? "source";
  const sortOrder = options.sortOrder ?? "asc";
  redirects.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "source") {
      cmp = a.source.localeCompare(b.source);
    } else if (sortBy === "destination") {
      cmp = a.destination.localeCompare(b.destination);
    } else if (sortBy === "statusCode") {
      cmp = getStatusCode(a) - getStatusCode(b);
    }
    return sortOrder === "desc" ? -cmp : cmp;
  });

  // Pagination
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const total = redirects.length;
  const numPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const paged = redirects.slice(start, start + perPage);

  return {
    version: deepClone(version),
    redirects: paged,
    pagination: { page, per_page: perPage, numPages },
  };
}

// ─── Stage (create / overwrite) ──────────────────────────────────────────────

function getOrCreateStagingVersion(
  projectId: string
): RedirectVersion {
  const state = getProjectState(projectId);
  let staging = state.versions.find((v) => v.isStaging);
  if (staging) return staging;

  // Clone the production redirects into a new staging version
  const prod = state.versions.find((v) => v.isLive);
  const prodRedirects = prod
    ? deepClone(state.redirectsByVersion.get(prod.id) ?? [])
    : [];

  staging = {
    id: nextId(),
    key: `versions/staging-${staging}`,
    lastModified: Date.now(),
    createdBy: "demo-user",
    name: "Staged changes",
    isStaging: true,
    isLive: false,
    redirectCount: prodRedirects.length,
  };

  state.versions.unshift(staging);
  state.redirectsByVersion.set(staging.id, prodRedirects);
  return staging;
}

export async function stageRedirects(
  projectId: string,
  redirects: Redirect[],
  options: { overwrite?: boolean; name?: string } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const state = getProjectState(projectId);
  const staging = getOrCreateStagingVersion(projectId);

  if (options.overwrite) {
    state.redirectsByVersion.set(staging.id, deepClone(redirects));
  } else {
    // Merge: add new, update existing
    const existing = state.redirectsByVersion.get(staging.id) ?? [];
    const map = new Map(existing.map((r) => [r.source, r]));
    for (const r of redirects) {
      map.set(r.source, deepClone(r));
    }
    state.redirectsByVersion.set(staging.id, Array.from(map.values()));
  }

  if (options.name) staging.name = options.name;
  staging.lastModified = Date.now();
  staging.redirectCount = (
    state.redirectsByVersion.get(staging.id) ?? []
  ).length;

  return { alias: null, version: deepClone(staging) };
}

// ─── Edit ────────────────────────────────────────────────────────────────────

export async function editRedirect(
  projectId: string,
  redirect: Redirect,
  options: { name?: string; restore?: boolean } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const state = getProjectState(projectId);
  const staging = getOrCreateStagingVersion(projectId);
  const redirects = state.redirectsByVersion.get(staging.id) ?? [];

  const idx = redirects.findIndex((r) => r.source === redirect.source);
  if (idx >= 0) {
    redirects[idx] = deepClone(redirect);
  } else {
    redirects.push(deepClone(redirect));
  }

  if (options.name) staging.name = options.name;
  staging.lastModified = Date.now();
  staging.redirectCount = redirects.length;

  return { alias: null, version: deepClone(staging) };
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteRedirects(
  projectId: string,
  sources: string[],
  options: { name?: string } = {}
): Promise<{ alias: string | null; version: RedirectVersion }> {
  const state = getProjectState(projectId);
  const staging = getOrCreateStagingVersion(projectId);
  const sourceSet = new Set(sources);
  const redirects = (state.redirectsByVersion.get(staging.id) ?? []).filter(
    (r) => !sourceSet.has(r.source)
  );
  state.redirectsByVersion.set(staging.id, redirects);

  if (options.name) staging.name = options.name;
  staging.lastModified = Date.now();
  staging.redirectCount = redirects.length;

  return { alias: null, version: deepClone(staging) };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export async function restoreRedirects(
  projectId: string,
  sources: string[],
  options: { name?: string } = {}
): Promise<{
  version: RedirectVersion;
  restored: string[];
  failedToRestore: string[];
}> {
  const state = getProjectState(projectId);
  const staging = getOrCreateStagingVersion(projectId);

  // Find redirects in production that match the sources
  const prod = state.versions.find((v) => v.isLive);
  const prodRedirects = prod
    ? (state.redirectsByVersion.get(prod.id) ?? [])
    : [];
  const prodMap = new Map(prodRedirects.map((r) => [r.source, r]));

  const stagingRedirects = state.redirectsByVersion.get(staging.id) ?? [];
  const stagingMap = new Map(stagingRedirects.map((r) => [r.source, r]));

  const restored: string[] = [];
  const failedToRestore: string[] = [];

  for (const source of sources) {
    const prod = prodMap.get(source);
    if (prod && !stagingMap.has(source)) {
      stagingRedirects.push(deepClone(prod));
      restored.push(source);
    } else {
      failedToRestore.push(source);
    }
  }

  if (options.name) staging.name = options.name;
  staging.lastModified = Date.now();
  staging.redirectCount = stagingRedirects.length;

  return {
    version: deepClone(staging),
    restored,
    failedToRestore,
  };
}

// ─── Versions ────────────────────────────────────────────────────────────────

export async function getVersionHistory(
  projectId: string
): Promise<{ versions: RedirectVersion[] }> {
  const state = getProjectState(projectId);
  return { versions: deepClone(state.versions) };
}

export async function updateVersion(
  projectId: string,
  versionId: string,
  action: "promote" | "restore" | "discard",
  options: { name?: string } = {}
): Promise<VersionActionResponse> {
  const state = getProjectState(projectId);
  const version = state.versions.find((v) => v.id === versionId);
  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  if (action === "promote") {
    // The staging version becomes the new live version.
    // The old live version becomes a historical version.
    const oldLive = state.versions.find((v) => v.isLive);
    if (oldLive) {
      oldLive.isLive = false;
    }
    version.isStaging = false;
    version.isLive = true;
    version.lastModified = Date.now();
    if (options.name) version.name = options.name;
  } else if (action === "discard") {
    // Remove the staging version entirely
    const idx = state.versions.findIndex((v) => v.id === versionId);
    if (idx >= 0) {
      state.versions.splice(idx, 1);
      state.redirectsByVersion.delete(versionId);
    }
    return {
      version: {
        id: versionId,
        key: "",
        lastModified: Date.now(),
        createdBy: "demo-user",
      },
    };
  } else if (action === "restore") {
    // Clone the historical version's redirects into a new staging version
    const existingStaging = state.versions.find((v) => v.isStaging);
    if (existingStaging) {
      // Discard existing staging first
      const idx = state.versions.findIndex(
        (v) => v.id === existingStaging.id
      );
      if (idx >= 0) {
        state.versions.splice(idx, 1);
        state.redirectsByVersion.delete(existingStaging.id);
      }
    }

    const redirects = deepClone(
      state.redirectsByVersion.get(versionId) ?? []
    );
    const newStaging: RedirectVersion = {
      id: nextId(),
      key: `versions/restored-${versionId}`,
      lastModified: Date.now(),
      createdBy: "demo-user",
      name: options.name ?? `Restored from ${version.name ?? versionId}`,
      isStaging: true,
      isLive: false,
      redirectCount: redirects.length,
    };
    state.versions.unshift(newStaging);
    state.redirectsByVersion.set(newStaging.id, redirects);

    return { version: deepClone(newStaging) };
  }

  return { version: deepClone(version) };
}
