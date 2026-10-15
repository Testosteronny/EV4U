import { useEffect, useState } from "react";
import { loadPlzResolver, plzResolverIfLoaded, type ZipResolver } from "../utils/swiss";

/** The synchronous PLZ resolver for render-time lookups (a postcode field
 *  that shows its municipality while typing). Starts loading the PLZ map
 *  once `enabled` turns true; returns null until it has arrived — callers
 *  treat that as "not resolved yet", never as "invalid postcode". */
export function usePlzResolver(enabled = true): ZipResolver | null {
  const [resolve, setResolve] = useState<ZipResolver | null>(plzResolverIfLoaded);

  useEffect(() => {
    if (!enabled || resolve) return;
    let alive = true;
    loadPlzResolver()
      .then((r) => alive && setResolve(() => r))
      .catch((err: unknown) => console.warn("[ev4u] PLZ map failed to load:", err));
    return () => {
      alive = false;
    };
  }, [enabled, resolve]);

  return resolve;
}
