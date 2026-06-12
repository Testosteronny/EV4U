import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "./useSession";

/** Count of unread messages addressed to me, across all my conversations.
 *  RLS scopes the query; polled every 60 s + on auth change. */
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
      const { count: n } = await supabase!
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender", session.user.id)
        .is("read_at", null);
      if (alive) setCount(n ?? 0);
    };
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [session]);

  return count;
}
