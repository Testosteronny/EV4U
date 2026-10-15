import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import type { Session } from "@supabase/supabase-js";
import { $session, $sessionReady, ensureSession } from "../stores/session";

/** Current Supabase auth session. One fetch and one subscription per page —
 *  see stores/session.ts; this hook is only the read side. */
export function useSession(): { session: Session | null; ready: boolean } {
  const session = useStore($session);
  const ready = useStore($sessionReady);

  useEffect(() => {
    ensureSession();
  }, []);

  return { session, ready };
}
