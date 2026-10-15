import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { FuelType } from "../utils/costModel";

/* ============================================================================
   account_settings — the private half of an account (owner-only RLS):
   the Fahrprofil, synced with the local cockpit by AccountSync, and the
   notification switches the alert e-mails respect.
   ============================================================================ */

export type AccountSettings = {
  user_id: string;
  plz: string | null;
  annual_km: number | null;
  car_fuel: FuelType | null;
  car_consumption: number | null;
  elec_share: number | null;
  public_share: number | null;
  pv: boolean | null;
  charge_kw: number | null;
  notify_messages: boolean;
  notify_alerts: boolean;
};

const COLUMNS =
  "user_id,plz,annual_km,car_fuel,car_consumption,elec_share,public_share,pv,charge_kw,notify_messages,notify_alerts";

/** `numeric` arrives as a string from PostgREST. */
function normalise(r: AccountSettings): AccountSettings {
  return {
    ...r,
    car_consumption: r.car_consumption === null ? null : Number(r.car_consumption),
    charge_kw: r.charge_kw === null ? null : Number(r.charge_kw),
  };
}

export function useAccountSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setSettings(null);
      setLoaded(!userId);
      return;
    }
    const { data } = await supabase.from("account_settings").select(COLUMNS).eq("user_id", userId).maybeSingle();
    if (data) {
      setSettings(normalise(data as AccountSettings));
    } else {
      // Accounts from before account_settings existed: create the row.
      const { data: created } = await supabase
        .from("account_settings")
        .insert({ user_id: userId })
        .select(COLUMNS)
        .maybeSingle();
      setSettings(created ? normalise(created as AccountSettings) : null);
    }
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (fields: Partial<Omit<AccountSettings, "user_id">>): Promise<string | null> => {
      if (!supabase || !userId) return "Nicht angemeldet.";
      const { error } = await supabase.from("account_settings").update(fields).eq("user_id", userId);
      if (error) return error.message;
      setSettings((s) => (s ? { ...s, ...fields } : s));
      return null;
    },
    [userId],
  );

  return { settings, loaded, update };
}
