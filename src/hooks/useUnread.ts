import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "./useSession";

/** Count of unread messages addressed to me, across all my conversations.
 *  RLS scopes the query; polled every 60 s + on auth change.
 *
 *  Nicht, während der Tab im Hintergrund liegt: eine offene Registerkarte
 *  hätte sonst über Nacht 480 Abfragen abgesetzt, die niemand sieht. Beim
 *  Zurückkommen wird sofort einmal nachgeladen — das ist der Moment, in dem
 *  die Zahl stimmen muss. */
export function useUnread(): number {
  const { session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!supabase || !session) {
      setCount(0);
      return;
    }
    let alive = true;

    const load = async () => {
      if (document.hidden) return;
      const { count: n } = await supabase!
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender", session.user.id)
        .is("read_at", null);
      if (alive) setCount(n ?? 0);
    };

    const onVisible = () => {
      if (!document.hidden) void load();
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  return count;
}
