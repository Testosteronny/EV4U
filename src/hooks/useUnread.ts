import { useEffect } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { supabase } from "../lib/supabase";
import { useHydrated } from "./useHydrated";
import { useSession } from "./useSession";

/* ============================================================================
   Unread messages addressed to me, across all my conversations. RLS scopes
   the query. One poller per page (header and tab bar share it), every 60 s
   and on returning to the tab — never while the tab is in the background:
   an open tab would otherwise fire 480 queries a night that nobody sees.
   ============================================================================ */

const $unread = atom(0);
let pollingFor: string | null = null;
let timer: number | undefined;

async function load(): Promise<void> {
  if (!supabase || !pollingFor || document.hidden) return;
  const me = pollingFor;
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender", me)
    .is("read_at", null);
  if (pollingFor === me) $unread.set(count ?? 0);
}

const onVisible = () => {
  if (!document.hidden) void load();
};

function poll(userId: string | null): void {
  if (userId === pollingFor) return;
  pollingFor = userId;
  window.clearInterval(timer);
  document.removeEventListener("visibilitychange", onVisible);
  $unread.set(0);
  if (!userId || !supabase) return;
  void load();
  timer = window.setInterval(() => void load(), 60_000);
  document.addEventListener("visibilitychange", onVisible);
}

/** Reload now — after the inbox marked messages as read. */
export function refreshUnread(): void {
  void load();
}

export function useUnread(): number {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const hydrated = useHydrated();
  // Before hydration userId is always null — polling that would reset the
  // poller another island already started.
  useEffect(() => {
    if (hydrated) poll(userId);
  }, [hydrated, userId]);
  const count = useStore($unread);
  // Shared by header and tab bar: the later island must not hydrate with
  // a count the first one already loaded.
  return hydrated ? count : 0;
}
