import type { Redirect } from "@/lib/vercel";

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export let idCounter = Date.now();

export function nextId(): string {
  return `demo-${++idCounter}`;
}

export function getStatusCode(r: Redirect): number {
  if (r.statusCode) return r.statusCode;
  if (r.permanent === true) return 308;
  if (r.permanent === false) return 307;
  return 307;
}

export function redirectsEqual(a: Redirect, b: Redirect): boolean {
  return (
    a.source === b.source &&
    a.destination === b.destination &&
    getStatusCode(a) === getStatusCode(b)
  );
}
