import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================================
   The logged-in user's public profile (auto-created on signup by a
   trigger) — what buyers see as the seller: name, type, and for garages the
   public garage page. `verified` is set by EV4U only (trigger-protected).
   The admin flag lives in user_roles (readable only for one's own row —
   every admin capability is enforced by RLS, the flag only shapes the UI).

   The private Fahrprofil and notification settings are NOT here: they live
   in account_settings (useAccountSettings), which only the owner can read.
   ============================================================================ */

export type Profile = {
  id: string;
  type: "PRIVAT" | "GARAGE";
  name: string;
  verified: boolean;
  company_uid: string | null;
  website: string | null;
  /** Public garage page /garagen/[slug]. */
  slug: string | null;
  address: string;
  phone: string;
  opening_hours: string;
  about: string;
  logo_path: string | null;
};

export const PROFILE_COLUMNS =
  "id,type,name,verified,company_uid,website,slug,address,phone,opening_hours,about,logo_path";

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // True once the fetch for THIS user finished (profile may still be null).
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      setIsAdmin(false);
      setLoaded(!userId);
      return;
    }
    setLoaded(false);
    const [{ data: p }, { data: role }] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    setProfile((p as Profile) ?? null);
    setIsAdmin(role?.role === "ADMIN");
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (fields: Partial<Omit<Profile, "id" | "verified">>): Promise<string | null> => {
      if (!supabase || !userId) return "Nicht angemeldet.";
      const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
      if (error) {
        return error.code === "23505"
          ? "Diese Adresse für die Garagenseite ist schon vergeben."
          : error.message;
      }
      await load();
      return null;
    },
    [userId, load],
  );

  return { profile, isAdmin, loaded, update, reload: load };
}
