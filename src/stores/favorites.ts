import { atom } from "nanostores";
import { supabase } from "../lib/supabase";

/* ============================================================================
   Merkliste — account-backed (favorites table, RLS-scoped to the owner),
   NOT localStorage: hearts require a login and follow the user across
   devices. One shared atom so the board, the detail page and the filter
   console stay in sync within a page.
   ============================================================================ */

export const $favorites = atom<string[]>([]);

let loadedFor: string | null = null;

/** Load the user's Merkliste once per login; clears on logout. */
export async function loadFavorites(userId: string | null): Promise<void> {
  if (!supabase || loadedFor === userId) return;
  loadedFor = userId;
  if (!userId) {
    $favorites.set([]);
    return;
  }
  const { data } = await supabase.from("favorites").select("listing_slug");
  $favorites.set(((data as { listing_slug: string }[]) ?? []).map((r) => r.listing_slug));
}

/** Optimistic toggle; rolls back if the database rejects the write. */
export async function toggleFavoriteDb(slug: string, userId: string): Promise<void> {
  if (!supabase) return;
  const before = $favorites.get();
  const isFav = before.includes(slug);
  $favorites.set(isFav ? before.filter((s) => s !== slug) : [...before, slug]);
  const { error } = isFav
    ? await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("listing_slug", slug)
    : await supabase.from("favorites").insert({ user_id: userId, listing_slug: slug });
  if (error) $favorites.set(before);
}
