import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  CANTON_TAXES_FALLBACK,
  CANTON_TAX_YEAR_FALLBACK,
  type CantonTax,
} from "../utils/costModel";

/* ============================================================================
   useCantonTaxes — the cantonal Verkehrssteuer config (CURRENT-YEAR values).
   Live data comes from the operator-editable `canton_taxes` table (public
   read, writes only via dashboard/SQL) including the tax_year shown in the
   UI — switch the values + year in the backend when cantons change rules.
   Fetched once per session (module-level cache); bundled fallback first.
   ============================================================================ */

export type CantonTaxConfig = {
  taxes: Record<string, CantonTax>;
  year: number;
};

const FALLBACK: CantonTaxConfig = {
  taxes: CANTON_TAXES_FALLBACK,
  year: CANTON_TAX_YEAR_FALLBACK,
};

let cache: CantonTaxConfig | null = null;
let pending: Promise<CantonTaxConfig> | null = null;

async function fetchConfig(): Promise<CantonTaxConfig> {
  if (!supabase) return FALLBACK;
  const { data, error } = await supabase
    .from("canton_taxes")
    .select("canton,ice_tax,ev_tax,tax_year");
  if (error || !data?.length) return FALLBACK;
  return {
    taxes: Object.fromEntries(
      data.map((r) => [
        r.canton as string,
        { ice: r.ice_tax as number, ev: r.ev_tax as number },
      ]),
    ),
    year: (data[0].tax_year as number) ?? CANTON_TAX_YEAR_FALLBACK,
  };
}

export function useCantonTaxes(): CantonTaxConfig {
  const [config, setConfig] = useState(cache ?? FALLBACK);

  useEffect(() => {
    if (cache) return;
    pending ??= fetchConfig();
    let alive = true;
    void pending.then((c) => {
      cache = c;
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  return config;
}
