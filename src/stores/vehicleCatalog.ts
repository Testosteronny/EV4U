import { atom, map } from "nanostores";
import { supabase } from "../lib/supabase";
import {
  byEntryLevel,
  byName,
  type CatalogBrand,
  type CatalogVariant,
} from "../lib/vehicleCatalog";

/* ============================================================================
   Fahrzeugkatalog — Marke → Modell → Variante, geteilt über alle Inseln.

   Zwei Stufen, weil sie verschieden gross sind: Marken und Modelle (rund
   360 Zeilen, wenige Spalten) kommen in EINER Abfrage, sobald jemand den
   Katalog braucht; die technischen Daten der Varianten erst für das Modell,
   das gewählt wurde. Beides ist pro Seitenaufruf statisch.

   Ein Store statt Zustand pro Hook: Picker und Assistent lesen denselben
   Katalog, und ein «Nochmals laden» im Picker muss auch die Vorschau
   daneben erreichen — mit getrenntem Zustand blieb die nach einem Fehler
   leer, obwohl der Picker längst geladen hatte.
   ============================================================================ */

export type LoadStatus = "loading" | "ready" | "error" | "offline";

const MODEL_COLUMNS =
  "id,slug,name,segment,body_type,availability,market_launch,launch_year,end_year,remark";

const VARIANT_COLUMNS =
  "id,slug,name,vehicle_class,seats,drive,motors,power_kw,power_ps,accel_0_100_s,top_speed_kmh," +
  "battery_gross_kwh,battery_net_kwh,cell_chemistry,system_voltage_v,range_wltp_km," +
  "consumption_kwh_100km,dc_max_kw,dc_10_80_min,ac_max_kw,charge_port,v2l,trunk_l,frunk_l," +
  "towing_kg,curb_weight_kg,battery_warranty_years,battery_warranty_km," +
  "battery_warranty_conditional,battery_warranty_soh_pct,price_new_chf";

/** `numeric` kann je nach Treiber als String kommen. */
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/* ---------- Marken + Modelle ---------------------------------------------- */

export const $vehicleCatalog = atom<{ brands: CatalogBrand[]; status: LoadStatus }>({
  brands: [],
  status: supabase ? "loading" : "offline",
});

let catalogRequest: Promise<void> | null = null;

/** Lädt Marken und Modelle — einmal pro Seite; nach einem Fehler fragt der
 *  nächste Aufruf neu. Gleichzeitige Aufrufe teilen sich die Anfrage. */
export function loadVehicleCatalog(): void {
  const client = supabase;
  if (!client || catalogRequest || $vehicleCatalog.get().status === "ready") return;
  $vehicleCatalog.set({ brands: [], status: "loading" });
  catalogRequest = (async () => {
    const { data, error } = await client
      .from("vehicle_brands")
      .select(`id,slug,name,models:vehicle_models(${MODEL_COLUMNS})`);
    if (error) throw error;
    const brands = (data as CatalogBrand[])
      .map((b) => ({ ...b, models: [...b.models].sort(byName) }))
      .sort(byName);
    $vehicleCatalog.set({ brands, status: "ready" });
  })()
    .catch((err: unknown) => {
      console.warn("[ev4u] vehicle catalog failed to load:", err);
      $vehicleCatalog.set({ brands: [], status: "error" });
    })
    .finally(() => {
      catalogRequest = null;
    });
}

/* ---------- Varianten je Modell ------------------------------------------- */

export type VariantsEntry = { rows: CatalogVariant[]; status: LoadStatus };

/** Modell-Id → geladene Varianten, eingangs nach Einstiegsversion sortiert. */
export const $vehicleVariants = map<Record<string, VariantsEntry>>({});

const variantRequests = new Set<string>();

/** Lädt die Varianten eines Modells — einmal; nach einem Fehler erneut. */
export function loadVehicleVariants(modelId: string): void {
  const client = supabase;
  if (!client || variantRequests.has(modelId)) return;
  if ($vehicleVariants.get()[modelId]?.status === "ready") return;
  variantRequests.add(modelId);
  $vehicleVariants.setKey(modelId, { rows: [], status: "loading" });
  void (async () => {
    const { data, error } = await client
      .from("vehicle_variants")
      .select(VARIANT_COLUMNS)
      .eq("model_id", modelId);
    if (error) throw error;
    const rows = (data as unknown as CatalogVariant[]).map((v) => ({
      ...v,
      accel_0_100_s: num(v.accel_0_100_s),
      battery_gross_kwh: num(v.battery_gross_kwh),
      battery_net_kwh: num(v.battery_net_kwh),
      consumption_kwh_100km: num(v.consumption_kwh_100km),
      ac_max_kw: Number(v.ac_max_kw),
    }));
    rows.sort(byEntryLevel);
    $vehicleVariants.setKey(modelId, { rows, status: "ready" });
  })()
    .catch((err: unknown) => {
      console.warn("[ev4u] vehicle variants failed to load:", err);
      $vehicleVariants.setKey(modelId, { rows: [], status: "error" });
    })
    .finally(() => {
      variantRequests.delete(modelId);
    });
}
