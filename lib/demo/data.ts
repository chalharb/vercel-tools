/**
 * This file is used for seeding the project with fake data for demonstrating app functionality
 */

import type { VercelProject, Redirect, RedirectVersion } from "@/lib/vercel";

interface ProjectState {
  versions: RedirectVersion[];
  redirectsByVersion: Map<string, Redirect[]>;
}

const now = Date.now();
const hour = 3_600_000;
const day = 24 * hour;

export const DEMO_PROJECTS: VercelProject[] = [
  {
    id: "demo-project-acme",
    name: "acme-storefront",
    framework: "Next.js",
    updatedAt: now - 2 * day,
  },
  {
    id: "demo-project-docs",
    name: "acme-docs",
    framework: "Next.js",
    updatedAt: now - 5 * day,
  },
  {
    id: "demo-project-blog",
    name: "acme-blog",
    framework: "Astro",
    updatedAt: now - 10 * day,
  },
];

function makeVersion(
  id: string,
  overrides: Partial<RedirectVersion> = {},
): RedirectVersion {
  return {
    id,
    key: `versions/${id}`,
    lastModified: now,
    createdBy: "demo-user",
    ...overrides,
  };
}

const ACME_PRODUCTION_REDIRECTS: Redirect[] = [
  { source: "/old-home", destination: "/", statusCode: 301 },
  { source: "/blog-old", destination: "/blog", statusCode: 301 },
  { source: "/about-us", destination: "/about", statusCode: 301 },
  { source: "/careers", destination: "/jobs", statusCode: 302 },
  { source: "/contact-us", destination: "/contact", statusCode: 301 },
  { source: "/pricing-old", destination: "/pricing", statusCode: 301 },
  { source: "/features-v1", destination: "/features", statusCode: 301 },
  { source: "/signup", destination: "/register", statusCode: 308 },
  { source: "/login-old", destination: "/login", statusCode: 308 },
  { source: "/docs-legacy", destination: "/docs", statusCode: 301 },
  { source: "/support-old", destination: "/support", statusCode: 301 },
  { source: "/terms-old", destination: "/terms", statusCode: 301 },
  { source: "/privacy-old", destination: "/privacy", statusCode: 301 },
  { source: "/faq-old", destination: "/faq", statusCode: 301 },
  { source: "/shop", destination: "/store", statusCode: 301 },
  { source: "/catalogue", destination: "/catalog", statusCode: 301 },
  { source: "/help", destination: "/support", statusCode: 302 },
  { source: "/news", destination: "/blog", statusCode: 301 },
  { source: "/partners-old", destination: "/partners", statusCode: 301 },
  { source: "/events-2023", destination: "/events", statusCode: 302 },
  { source: "/webinar-old", destination: "/webinars", statusCode: 301 },
  { source: "/sale", destination: "/offers", statusCode: 302 },
  { source: "/demo-old", destination: "/demo", statusCode: 301 },
  {
    source: "/whitepaper",
    destination: "/resources/whitepapers",
    statusCode: 301,
  },
];

const ACME_STAGING_REDIRECTS: Redirect[] = [
  // Modified modified
  { source: "/old-home", destination: "/home", statusCode: 308 },
  // Unchanged
  { source: "/blog-old", destination: "/blog", statusCode: 301 },
  { source: "/about-us", destination: "/about", statusCode: 301 },
  { source: "/careers", destination: "/jobs", statusCode: 302 },
  { source: "/contact-us", destination: "/contact", statusCode: 301 },
  { source: "/pricing-old", destination: "/pricing", statusCode: 301 },
  { source: "/features-v1", destination: "/features", statusCode: 301 },
  { source: "/signup", destination: "/register", statusCode: 308 },
  { source: "/login-old", destination: "/login", statusCode: 308 },
  { source: "/docs-legacy", destination: "/docs", statusCode: 301 },
  { source: "/support-old", destination: "/support", statusCode: 301 },
  { source: "/terms-old", destination: "/terms", statusCode: 301 },
  { source: "/privacy-old", destination: "/privacy", statusCode: 301 },
  { source: "/faq-old", destination: "/faq", statusCode: 301 },
  { source: "/shop", destination: "/store", statusCode: 301 },
  { source: "/catalogue", destination: "/catalog", statusCode: 301 },
  { source: "/help", destination: "/support", statusCode: 302 },
  { source: "/news", destination: "/blog", statusCode: 301 },
  { source: "/partners-old", destination: "/partners", statusCode: 301 },
  { source: "/events-2023", destination: "/events", statusCode: 302 },
  { source: "/webinar-old", destination: "/webinars", statusCode: 301 },
  { source: "/sale", destination: "/offers", statusCode: 302 },
  { source: "/demo-old", destination: "/demo", statusCode: 301 },
  {
    source: "/whitepaper",
    destination: "/resources/whitepapers",
    statusCode: 301,
  },
  // Added
  { source: "/new-feature", destination: "/features/new", statusCode: 301 },
  { source: "/launch", destination: "/products/launch", statusCode: 302 },
];

const DOCS_REDIRECTS: Redirect[] = [
  {
    source: "/v1/getting-started",
    destination: "/docs/quickstart",
    statusCode: 301,
  },
  { source: "/v1/api-reference", destination: "/docs/api", statusCode: 301 },
  { source: "/v1/tutorials", destination: "/docs/guides", statusCode: 301 },
  { source: "/old-sdk", destination: "/docs/sdk", statusCode: 301 },
  { source: "/changelog-old", destination: "/changelog", statusCode: 301 },
];

const BLOG_REDIRECTS: Redirect[] = [
  {
    source: "/2022-roundup",
    destination: "/archive/2022-roundup",
    statusCode: 301,
  },
  { source: "/categories", destination: "/topics", statusCode: 301 },
];

const stateByProject = new Map<string, ProjectState>();

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function initProjectState(projectId: string): ProjectState {
  if (stateByProject.has(projectId)) {
    return stateByProject.get(projectId)!;
  }

  let prodRedirects: Redirect[];
  let stagingRedirects: Redirect[] | null = null;

  switch (projectId) {
    case "demo-project-acme":
      prodRedirects = deepClone(ACME_PRODUCTION_REDIRECTS);
      stagingRedirects = deepClone(ACME_STAGING_REDIRECTS);
      break;
    case "demo-project-docs":
      prodRedirects = deepClone(DOCS_REDIRECTS);
      break;
    case "demo-project-blog":
      prodRedirects = deepClone(BLOG_REDIRECTS);
      break;
    default:
      prodRedirects = [];
  }

  const prodVersion = makeVersion(`${projectId}-v-prod`, {
    name: "Initial release",
    isLive: true,
    isStaging: false,
    lastModified: now - 7 * day,
    redirectCount: prodRedirects.length,
  });

  const versions: RedirectVersion[] = [prodVersion];
  const redirectsByVersion = new Map<string, Redirect[]>();

  redirectsByVersion.set(prodVersion.id, prodRedirects);

  // Historical version
  const histVersion = makeVersion(`${projectId}-v-hist-1`, {
    name: "Pre-launch cleanup",
    isLive: false,
    isStaging: false,
    lastModified: now - 14 * day,
    redirectCount: Math.max(0, prodRedirects.length - 3),
  });

  versions.push(histVersion);

  redirectsByVersion.set(
    histVersion.id,
    prodRedirects.slice(0, Math.max(0, prodRedirects.length - 3)),
  );

  // Staging version for acme
  if (stagingRedirects) {
    const stagingVersion = makeVersion(`${projectId}-v-staging`, {
      name: "Q1 redirect updates",
      isLive: false,
      isStaging: true,
      lastModified: now - 2 * hour,
      redirectCount: stagingRedirects.length,
    });
    versions.push(stagingVersion);
    redirectsByVersion.set(stagingVersion.id, stagingRedirects);
  }

  versions.sort((a, b) => b.lastModified - a.lastModified);

  const state: ProjectState = { versions, redirectsByVersion };

  stateByProject.set(projectId, state);

  return state;
}

export function getProjectState(projectId: string): ProjectState {
  return initProjectState(projectId);
}

export function getAllProjects(): VercelProject[] {
  return deepClone(DEMO_PROJECTS);
}
