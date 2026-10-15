/* ============================================================================
   Build-time garage snapshot — every garage account with a public page
   (profiles.type = GARAGE and a slug). /garagen and /garagen/[slug]
   prerender from it; garages that set their page up after the last build
   are served by the 404 fallback, which loads the same profile live.
   ============================================================================ */

export type GarageInfo = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  address: string;
  phone: string;
  opening_hours: string;
  about: string;
  website: string | null;
  logo_path: string | null;
};

export const GARAGE_COLUMNS = "id,name,slug,verified,address,phone,opening_hours,about,website,logo_path";

let cache: GarageInfo[] | null = null;

export async function fetchBuildGarages(): Promise<GarageInfo[]> {
  if (cache) return cache;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  cache = [];
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/profiles?select=${GARAGE_COLUMNS}&type=eq.GARAGE&slug=not.is.null&order=verified.desc,name.asc`,
        { headers: { apikey: key } },
      );
      if (res.ok) cache = (await res.json()) as GarageInfo[];
    } catch {
      /* offline build → no garage pages */
    }
  }
  return cache;
}
