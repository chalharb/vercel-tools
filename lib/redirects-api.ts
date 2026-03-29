/**
 * Facade for the redirects/projects API.
 *
 * When VERCEL_TOKEN is set, delegates to the real Vercel API (lib/vercel.ts).
 * When it's missing, delegates to the in-memory demo implementation (lib/demo.ts)
 * so the app can be deployed and demoed without touching a real project.
 *
 * All consumers should import from this module instead of lib/vercel.ts directly.
 */

import * as vercel from "./vercel";
import * as demo from "./demo";

function isDemo(): boolean {
  return !process.env.VERCEL_TOKEN;
}

function impl() {
  return isDemo() ? demo : vercel;
}

// Re-export types so consumers don't need to import from vercel.ts
export type {
  VercelProject,
  Redirect,
  RedirectVersion,
  RedirectsResponse,
  VersionActionResponse,
} from "./vercel";

// ─── Delegated functions ─────────────────────────────────────────────────────

export const listProjects: typeof vercel.listProjects = (...args) =>
  impl().listProjects(...args);

export const getRedirects: typeof vercel.getRedirects = (...args) =>
  impl().getRedirects(...args);

export const stageRedirects: typeof vercel.stageRedirects = (...args) =>
  impl().stageRedirects(...args);

export const editRedirect: typeof vercel.editRedirect = (...args) =>
  impl().editRedirect(...args);

export const deleteRedirects: typeof vercel.deleteRedirects = (...args) =>
  impl().deleteRedirects(...args);

export const restoreRedirects: typeof vercel.restoreRedirects = (...args) =>
  impl().restoreRedirects(...args);

export const getVersionHistory: typeof vercel.getVersionHistory = (...args) =>
  impl().getVersionHistory(...args);

export const updateVersion: typeof vercel.updateVersion = (...args) =>
  impl().updateVersion(...args);
