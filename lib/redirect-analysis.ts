export type RedirectIssue =
  | "trailing-slash-duplicate"
  | "conflicting-duplicate"
  | "redundant-duplicate"
  | "trailing-slash-conflict";

export const ISSUE_LABELS: Record<RedirectIssue, string> = {
  "trailing-slash-duplicate": "Trailing Slash Duplicate",
  "conflicting-duplicate": "Conflicting Duplicate",
  "redundant-duplicate": "Redundant Duplicate",
  "trailing-slash-conflict": "Trailing Slash Conflict",
};

export const ISSUE_VARIANTS: Record<RedirectIssue, "destructive" | "secondary" | "outline"> = {
  "conflicting-duplicate": "destructive",
  "trailing-slash-conflict": "destructive",
  "redundant-duplicate": "secondary",
  "trailing-slash-duplicate": "outline",
};

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function hasTrailingSlash(url: string): boolean {
  // Check path portion only — ignore query/fragment
  try {
    const u = new URL(url);
    return u.pathname.length > 1 && u.pathname.endsWith("/");
  } catch {
    // Not a full URL, treat as path
    return url.length > 1 && url.endsWith("/");
  }
}

/**
 * Analyze an array of redirect rows and return per-row issue arrays.
 *
 * Expects rows with `source` and `destination` fields (i.e. after preset mapping).
 * Returns an array parallel to the input with issues for each row.
 */
export function analyzeRedirects(
  rows: Record<string, string>[],
  sourceKey = "source",
  destKey = "destination"
): RedirectIssue[][] {
  const issues: RedirectIssue[][] = rows.map(() => []);

  // Build lookup maps: normalized source → list of row indices
  const bySource = new Map<string, number[]>();
  // Also track normalized (no trailing slash) → list of row indices
  const byNormalized = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const source = rows[i][sourceKey] ?? "";
    const normalized = stripTrailingSlash(source);

    const sourceList = bySource.get(source);
    if (sourceList) sourceList.push(i);
    else bySource.set(source, [i]);

    const normList = byNormalized.get(normalized);
    if (normList) normList.push(i);
    else byNormalized.set(normalized, [i]);
  }

  // Check each group of rows sharing the exact same source
  for (const indices of bySource.values()) {
    if (indices.length < 2) continue;

    const destinations = new Set(
      indices.map((i) => rows[i][destKey] ?? "")
    );

    if (destinations.size === 1) {
      // All go to the same destination — redundant duplicates
      for (const i of indices) {
        issues[i].push("redundant-duplicate");
      }
    } else {
      // Same source, different destinations — conflicting duplicates
      for (const i of indices) {
        issues[i].push("conflicting-duplicate");
      }
    }
  }

  // Check trailing slash relationships
  for (const [normalized, indices] of byNormalized) {
    // Find rows with and without trailing slash for the same normalized path
    const withSlash: number[] = [];
    const withoutSlash: number[] = [];

    for (const i of indices) {
      const source = rows[i][sourceKey] ?? "";
      if (hasTrailingSlash(source)) {
        withSlash.push(i);
      } else if (stripTrailingSlash(source) === normalized) {
        withoutSlash.push(i);
      }
    }

    if (withSlash.length === 0 || withoutSlash.length === 0) continue;

    // Both slash variants exist — check if destinations match
    const slashDests = new Set(withSlash.map((i) => rows[i][destKey] ?? ""));
    const noSlashDests = new Set(withoutSlash.map((i) => rows[i][destKey] ?? ""));

    // Check if any destinations overlap (trailing slash duplicate) or differ (trailing slash conflict)
    const allSame =
      slashDests.size === 1 &&
      noSlashDests.size === 1 &&
      [...slashDests][0] === [...noSlashDests][0];

    if (allSame) {
      for (const i of [...withSlash, ...withoutSlash]) {
        if (!issues[i].includes("trailing-slash-duplicate")) {
          issues[i].push("trailing-slash-duplicate");
        }
      }
    } else {
      for (const i of [...withSlash, ...withoutSlash]) {
        if (!issues[i].includes("trailing-slash-conflict")) {
          issues[i].push("trailing-slash-conflict");
        }
      }
    }
  }

  return issues;
}
