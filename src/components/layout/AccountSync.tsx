import { useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import { useAccountSettings, type AccountSettings } from "../../hooks/useAccountSettings";
import { useHydrated } from "../../hooks/useHydrated";
import { useSession } from "../../hooks/useSession";
import { $cockpit, patchCockpit, type CockpitData } from "../../stores/cockpit";
import { syncMerkliste } from "../../stores/merkliste";
import { isFuelType } from "../../utils/costModel";

/* ============================================================================
   AccountSync — Konto ⇄ Gerät, ohne Oberfläche. Hängt auf jeder Seite.

   · Merkliste: lokal geführt, beim Anmelden mit dem Konto zusammengeführt
     und danach gespiegelt (stores/merkliste.ts).
   · Fahrprofil: beim Anmelden gewinnt das Konto — es ist das Profil, das
     auf jedem Gerät gelten soll; Felder, die das Konto noch nicht kennt,
     bleiben lokal und werden hochgeschrieben. Jede spätere Änderung
     (Fahrprofil-Sheet, /konto/einstellungen) geht entprellt zurück.
   ============================================================================ */

type SyncedFields = Pick<
  AccountSettings,
  "plz" | "annual_km" | "car_fuel" | "car_consumption" | "elec_share" | "public_share" | "pv" | "charge_kw"
>;

function fromCockpit(c: CockpitData): SyncedFields {
  return {
    plz: c.zip,
    annual_km: c.annualKm,
    car_fuel: c.fuel,
    car_consumption: c.ice,
    elec_share: c.elecShare,
    public_share: c.publicShare,
    pv: c.pv === "ja",
    charge_kw: c.chargeKw,
  };
}

function toCockpit(s: AccountSettings, current: CockpitData): Partial<CockpitData> {
  const patch: Partial<CockpitData> = {};
  if (s.plz && s.plz !== current.zip) {
    patch.zip = s.plz;
    patch.place = null; // useCockpit resolves the new PLZ into a place
  }
  if (s.annual_km) patch.annualKm = s.annual_km;
  // `isFuelType` guards against a value from an older version.
  if (isFuelType(s.car_fuel) && s.car_consumption) {
    patch.fuel = s.car_fuel;
    patch.ice = s.car_consumption;
  }
  if (s.elec_share !== null) patch.elecShare = s.elec_share;
  if (s.public_share !== null) patch.publicShare = s.public_share;
  if (s.pv !== null) patch.pv = s.pv ? "ja" : "nein";
  if (s.charge_kw) patch.chargeKw = s.charge_kw;
  return patch;
}

const sameFields = (a: SyncedFields, b: SyncedFields): boolean =>
  (Object.keys(a) as (keyof SyncedFields)[]).every((k) => a[k] === b[k]);

export default function AccountSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { settings, loaded, update } = useAccountSettings(userId);
  const cockpit = useStore($cockpit);
  const hydrated = useHydrated();
  const adoptedFor = useRef<string | null>(null);

  useEffect(() => {
    void syncMerkliste(userId ?? null);
  }, [userId]);

  // Einmal pro Anmeldung: das Konto übernehmen.
  useEffect(() => {
    if (!hydrated || !loaded || !settings || adoptedFor.current === settings.user_id) return;
    adoptedFor.current = settings.user_id;
    const patch = toCockpit(settings, $cockpit.get());
    if (Object.keys(patch).length > 0) patchCockpit(patch);
  }, [hydrated, loaded, settings]);

  // Danach jede Änderung zurückschreiben — entprellt, Slider feuern beim
  // Ziehen fortlaufend.
  useEffect(() => {
    if (!hydrated || !settings || adoptedFor.current !== settings.user_id) return;
    const next = fromCockpit(cockpit);
    if (sameFields(next, settings)) return;
    const t = setTimeout(() => void update(next), 800);
    return () => clearTimeout(t);
  }, [hydrated, cockpit, settings, update]);

  return null;
}
