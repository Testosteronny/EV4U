import { persistentAtom } from "@nanostores/persistent";
import { supabase } from "../lib/supabase";
import type { Listing, ListingStatus } from "../data/evData";

/* ============================================================================
   Merkliste — local-first (Konzept v3, F15).

   The first heart click of a buyer must never hit a login wall. The list
   lives in localStorage; with an account it is merged into the `favorites`
   table on login and every later change goes to both, so it follows the
   buyer across devices and the price alerts (F7) know what to watch.

   Each entry remembers the price and status at saving time — that is what
   «Preis −1'500 seit du es gemerkt hast» is computed from.
   ============================================================================ */

export type SavedCar = {
  slug: string;
  /** ISO timestamp */
  savedAt: string;
  /** Asking price when saved. */
  price: number;
  status: ListingStatus;
  note: string;
};

const MAX_ITEMS = 100;

function isSavedCar(v: unknown): v is SavedCar {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.slug === "string" &&
    typeof c.savedAt === "string" &&
    typeof c.price === "number" &&
    typeof c.status === "string" &&
    typeof c.note === "string"
  );
}

export const $merkliste = persistentAtom<SavedCar[]>("ev4u.merkliste.v1", [], {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isSavedCar).slice(0, MAX_ITEMS) : [];
    } catch {
      return [];
    }
  },
});

/** The account the list is currently mirrored to (null = local only). */
let accountId: string | null = null;

const COUNTED_KEY = "ev4u.saves.counted";

/** Count a save for the listing's public «× gemerkt» and the seller's stats —
 *  once per listing and browser, so un- and re-saving doesn't inflate it. */
function trackSave(uid: string | undefined): void {
  if (!supabase || !uid) return;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COUNTED_KEY) ?? "[]");
    const counted = Array.isArray(stored) ? stored : [];
    if (counted.includes(uid)) return;
    localStorage.setItem(COUNTED_KEY, JSON.stringify([uid, ...counted].slice(0, 300)));
  } catch {
    /* storage blocked: count it anyway */
  }
  void supabase.rpc("track_listing_event", { p_listing: uid, p_kind: "SAVE" });
}

/** Heart click. Returns true when the car is now on the list. */
export function toggleSaved(l: Pick<Listing, "id" | "price" | "status" | "uid">): boolean {
  const list = $merkliste.get();
  if (list.some((c) => c.slug === l.id)) {
    removeSaved(l.id);
    return false;
  }
  const entry: SavedCar = {
    slug: l.id,
    savedAt: new Date().toISOString(),
    price: l.price,
    status: l.status,
    note: "",
  };
  $merkliste.set([entry, ...list].slice(0, MAX_ITEMS));
  trackSave(l.uid);
  if (supabase && accountId) {
    void supabase.from("favorites").upsert(
      { user_id: accountId, listing_slug: l.id, saved_price: l.price, note: "" },
      { onConflict: "user_id,listing_slug" },
    );
  }
  return true;
}

export function removeSaved(slug: string): void {
  $merkliste.set($merkliste.get().filter((c) => c.slug !== slug));
  if (supabase && accountId) {
    void supabase.from("favorites").delete().eq("user_id", accountId).eq("listing_slug", slug);
  }
}

/** Personal note per car. Callers debounce typing. */
export function setSavedNote(slug: string, note: string): void {
  const text = note.slice(0, 500);
  $merkliste.set($merkliste.get().map((c) => (c.slug === slug ? { ...c, note: text } : c)));
  if (supabase && accountId) {
    void supabase
      .from("favorites")
      .update({ note: text })
      .eq("user_id", accountId)
      .eq("listing_slug", slug);
  }
}

type FavoriteRow = {
  listing_slug: string;
  created_at: string;
  saved_price: number | null;
  note: string;
};

/** Login: merge local and account lists (union, earliest save wins, a
 *  non-empty note wins), write the local-only cars to the account, then
 *  mirror every later change. Logout: keep the local list, stop mirroring. */
export async function syncMerkliste(userId: string | null): Promise<void> {
  if (userId === accountId) return;
  accountId = userId;
  if (!supabase || !userId) return;

  const { data, error } = await supabase
    .from("favorites")
    .select("listing_slug,created_at,saved_price,note");
  if (error || accountId !== userId) return;
  const remote = (data as FavoriteRow[]) ?? [];
  const local = $merkliste.get();

  const bySlug = new Map<string, SavedCar>();
  for (const r of remote) {
    bySlug.set(r.listing_slug, {
      slug: r.listing_slug,
      savedAt: r.created_at,
      price: r.saved_price ?? 0,
      status: "AKTIV",
      note: r.note ?? "",
    });
  }
  const missingRemote: SavedCar[] = [];
  for (const c of local) {
    const r = bySlug.get(c.slug);
    if (!r) {
      bySlug.set(c.slug, c);
      missingRemote.push(c);
      continue;
    }
    bySlug.set(c.slug, {
      ...c,
      savedAt: r.savedAt < c.savedAt ? r.savedAt : c.savedAt,
      price: c.price || r.price,
      note: c.note || r.note,
    });
  }

  const merged = [...bySlug.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  $merkliste.set(merged.slice(0, MAX_ITEMS));

  if (missingRemote.length > 0) {
    await supabase.from("favorites").upsert(
      missingRemote.map((c) => ({
        user_id: userId,
        listing_slug: c.slug,
        saved_price: c.price > 0 ? c.price : null,
        note: c.note,
      })),
      { onConflict: "user_id,listing_slug" },
    );
  }
}
