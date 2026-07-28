import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { FuelType } from "../utils/costModel";

/* ============================================================================
   The logged-in user's profile row (auto-created on signup by a trigger).
   type PRIVAT|GARAGE switches the Konto dashboard into garage mode; the
   admin flag lives in user_roles (readable only for one's own row — every
   actual admin capability is enforced by RLS, the flag only shapes the UI).
   ============================================================================ */

export type Profile = {
  id: string;
  type: "PRIVAT" | "GARAGE";
  name: string;
  plz: string | null;
  verified: boolean;
  company_uid: string | null;
  website: string | null;
  /** Current car for the comparison engine; null = never set (defaults). */
  car_fuel: FuelType | null;
  car_consumption: number | null;
};

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
      supabase
        .from("profiles")
        .select("id,type,name,plz,verified,company_uid,website,car_fuel,car_consumption")
        .eq("id", userId)
        .maybeSingle(),
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
    async (fields: Partial<Omit<Profile, "id" | "verified">>) => {
      if (!supabase || !userId) return "Nicht angemeldet.";
      const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
      if (error) return error.message;
      await load();
      return null;
    },
    [userId, load],
  );

  return { profile, isAdmin, loaded, update };
}
