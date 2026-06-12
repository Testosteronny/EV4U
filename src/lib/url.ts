/** Prefix an internal path with Astro's base ("/" locally, "/EV4U" on
 *  GitHub Pages) — used for every <a href> in the React islands. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}` || "/";
}
