/** What a listing or garage slug may look like (DB check constraints).
 *  Slugs become file paths at build time — `../konto` must never pass. */
export const SAFE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Prefix an internal path with Astro's base ("/" locally, "/EV4U" on
 *  GitHub Pages) — used for every <a href> in the React islands. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}` || "/";
}
