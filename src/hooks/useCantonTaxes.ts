import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CANTON_TAXES_FALLBACK, type CantonTax } from "../utils/costModel";

/* ============================================================================
   useCantonTaxes — the cantonal Verkehrssteuer config.
   Live values come from the operator-editable `canton_taxes` table (public
   read, writes only via dashboard/SQL); the bundled fallback paints first.
   Fetched once per session (module-level cache).
   ============================================================================ */

let cache: Record<string, CantonTax> | null = null;
let pending: Promise<Record<string, CantonTax>> | null = null;

async function fetchTaxes(): Promise<Record<string, CantonTax>> {
  if (!supabase) return CANTON_TAXES_FALLBACK;
  const { data, error } = await supabase
    .from("canton_taxes")
    .select("canton,ice_tax,ev_tax");
  if (error || !data?.length) return CANTON_TAXES_FALLBACK;
  return Object.fromEntries(
    data.map((r) => [r.canton as string, { ice: r.ice_tax as number, ev: r.ev_tax as number }]),
  );
}

export function useCantonTaxes(): Record<string, CantonTax> {
  const [taxes, setTaxes] = useState(cache ?? CANTON_TAXES_FALLBACK);

  useEffect(() => {
    if (cache) return;
    pending ??= fetchTaxes();
    let alive = true;
    void pending.then((map) => {
      cache = map;
      if (alive) setTaxes(map);
    });
    return () => {
      alive = false;
    };
  }, []);

  return taxes;
}
