import { useEffect, useState } from "react";

/** False during prerendering and the first client render, true after mount.
 *  Anything read from localStorage (Merkliste, Fahrprofil, compare tray) is
 *  rendered only once this is true — the static HTML can't know it, and a
 *  first render that disagreed with it would break hydration. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
