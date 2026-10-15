import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import type { Session } from "@supabase/supabase-js";
import { $session, $sessionReady, ensureSession } from "../stores/session";
import { useHydrated } from "./useHydrated";

/** Current Supabase auth session. One fetch and one subscription per page —
 *  see stores/session.ts; this hook is only the read side.
 *  The first client render reports «not ready» like the prerendered HTML:
 *  an island that hydrates after the header has resolved the session would
 *  otherwise render different markup and break hydration. */
export function useSession(): { session: Session | null; ready: boolean } {
  const session = useStore($session);
  const ready = useStore($sessionReady);
  const hydrated = useHydrated();

  useEffect(() => {
    ensureSession();
  }, []);

  return hydrated ? { session, ready } : { session: null, ready: false };
}
