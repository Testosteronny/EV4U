import { supabase, type ListingRow } from "../../lib/supabase";
import { deleteVideo } from "../../lib/video";
import type { ListingStatusFull } from "../../utils/format";

/* ============================================================================
   The account's own data — shared by Übersicht, Meine Inserate and Garage.
   RLS already limits every read to the caller's rows (or, for an admin,
   widens it — hence the explicit `owner` and `listing_id` filters).
   ============================================================================ */

export const MY_LISTING_COLUMNS =
  "id,slug,brand,model,variant,year,km,price,status,photos,video_path,video_poster,created_at,hidden_at,ort,note," +
  "variant_id,battery_warranty_until,battery_warranty_km,mfk_date,accident_free,owners,service_book,equipment";

export type MyListing = Pick<
  ListingRow,
  | "id"
  | "slug"
  | "brand"
  | "model"
  | "variant"
  | "year"
  | "km"
  | "price"
  | "photos"
  | "video_path"
  | "video_poster"
  | "created_at"
  | "hidden_at"
  | "ort"
  | "note"
  | "variant_id"
  | "battery_warranty_until"
  | "battery_warranty_km"
  | "mfk_date"
  | "accident_free"
  | "owners"
  | "service_book"
  | "equipment"
> & { status: ListingStatusFull };

export async function fetchMyListings(userId: string): Promise<MyListing[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("listings")
    .select(MY_LISTING_COLUMNS)
    .eq("owner", userId)
    .order("created_at", { ascending: false });
  return (data as unknown as MyListing[]) ?? [];
}

export type EventTotals = { VIEW: number; CONTACT: number; SAVE: number };
export const NO_EVENTS: EventTotals = { VIEW: 0, CONTACT: 0, SAVE: 0 };

/** Views, contacts and saves per listing over the last `days` days. */
export async function fetchEventTotals(listingIds: string[], days = 30): Promise<Map<string, EventTotals>> {
  const out = new Map<string, EventTotals>();
  if (!supabase || listingIds.length === 0) return out;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("listing_events")
    .select("listing_id,kind,count")
    .in("listing_id", listingIds)
    .gte("day", since);
  for (const r of (data as { listing_id: string; kind: keyof EventTotals; count: number }[]) ?? []) {
    const t = out.get(r.listing_id) ?? { ...NO_EVENTS };
    t[r.kind] += r.count;
    out.set(r.listing_id, t);
  }
  return out;
}

export function sumEvents(totals: Iterable<EventTotals>): EventTotals {
  const sum = { ...NO_EVENTS };
  for (const t of totals) {
    sum.VIEW += t.VIEW;
    sum.CONTACT += t.CONTACT;
    sum.SAVE += t.SAVE;
  }
  return sum;
}

/** Deletes a listing with its photos and video (the row cascades to price
 *  history, events, conversations and reports). */
export async function deleteListing(
  l: Pick<MyListing, "id" | "photos" | "video_path" | "video_poster">,
): Promise<string | null> {
  if (!supabase) return "Nicht verbunden.";
  const images = [...(l.photos ?? []), ...(l.video_poster ? [l.video_poster] : [])];
  if (images.length) await supabase.storage.from("listing-photos").remove(images);
  const { error } = await supabase.from("listings").delete().eq("id", l.id);
  if (error) return error.message;
  if (l.video_path) await deleteVideo(l.video_path);
  return null;
}

/** Days since an ISO timestamp, for daysAgo(). */
export const ageDays = (iso: string): number => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
