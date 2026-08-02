import { useEffect, useRef } from "react";
import { useCockpit } from "../hooks/useCockpit";
import { useProfile } from "../hooks/useProfile";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { patchCockpit } from "../stores/cockpit";
import { resolveZip } from "../utils/swiss";

/* ============================================================================
   AccountSync — Konto ⇄ Kontext, ohne Oberfläche.

   War früher der sichtbare Teil von PlzGate. Das Modal ist ersatzlos
   gestrichen: die Standortfrage steht jetzt inline in der Kontextleiste und
   unterbricht niemanden mehr. Die Synchronisation dahinter bleibt:

   · angemeldet → Heim-PLZ und heutiges Auto aus dem Profil übernehmen
   · jede lokale Änderung (Kontext-Sheet, Profilpanel) zurück ins Konto
   ============================================================================ */

export default function AccountSync() {
  const { session } = useSession();
  const { profile, loaded } = useProfile(session?.user.id);
  const { gemeinde, setGemeinde, currentFuel, currentCons, hydrated } = useCockpit();
  const adoptedPlz = useRef(false);
  const adoptedCar = useRef(false);

  // Heim-PLZ übernehmen — nur wenn lokal noch keine gesetzt ist. Wartet auf
  // die Hydration: eine persistierte PLZ darf nie überschrieben werden.
  useEffect(() => {
    if (!hydrated || gemeinde || adoptedPlz.current) return;
    if (!loaded || !profile?.plz) return;
    adoptedPlz.current = true;
    const home = resolveZip(profile.plz);
    if (home) setGemeinde(home);
  }, [hydrated, loaded, profile, gemeinde, setGemeinde]);

  // Jede Fixierung wird zur Heim-PLZ des Kontos (eigene Zeile via RLS).
  useEffect(() => {
    if (!supabase || !session || !loaded || !profile || !gemeinde) return;
    if (profile.plz === gemeinde.zip) return;
    void supabase.from("profiles").update({ plz: gemeinde.zip }).eq("id", session.user.id);
  }, [gemeinde, session, loaded, profile]);

  // Heutiges Auto einmal pro Besuch aus dem Profil übernehmen.
  useEffect(() => {
    if (!loaded || !profile || adoptedCar.current) return;
    adoptedCar.current = true;
    if (profile.car_fuel && profile.car_consumption) {
      patchCockpit({ fuel: profile.car_fuel, ice: Number(profile.car_consumption) });
    }
  }, [loaded, profile]);

  // Lokale Änderungen zurückschreiben — entprellt, Slider feuern beim Ziehen
  // fortlaufend.
  useEffect(() => {
    if (!supabase || !session || !loaded || !profile) return;
    if (
      profile.car_fuel === currentFuel &&
      Number(profile.car_consumption) === currentCons
    )
      return;
    const t = setTimeout(() => {
      void supabase
        ?.from("profiles")
        .update({ car_fuel: currentFuel, car_consumption: currentCons })
        .eq("id", session.user.id);
    }, 800);
    return () => clearTimeout(t);
  }, [currentFuel, currentCons, session, loaded, profile]);

  return null;
}
