import { useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import { Button, LinkButton, Sheet } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useProfile } from "../hooks/useProfile";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";
import { patchCockpit } from "../stores/cockpit";
import { $loginPrompt, dismissLoginPrompt } from "../stores/ui";
import { isFuelType } from "../utils/costModel";
import { resolveZip } from "../utils/swiss";

/* ============================================================================
   AccountSync — Konto ⇄ Kontext, ohne Oberfläche.

   War früher der sichtbare Teil von PlzGate. Das Modal ist ersatzlos
   gestrichen: die Standortfrage steht jetzt inline in der Kontextleiste und
   unterbricht niemanden mehr. Die Synchronisation dahinter bleibt:

   · angemeldet → Heim-PLZ und heutiges Auto aus dem Profil übernehmen
   · jede lokale Änderung (Kontext-Sheet, Profilpanel) zurück ins Konto

   Weil die Komponente ohnehin auf jeder Seite hängt, trägt sie auch den
   Anmelde-Hinweis: eine Fläche, die erklärt, wozu ein Konto gebraucht wird,
   statt eines blockierenden `window.confirm()` mitten im Katalog.
   ============================================================================ */

/** Erscheint, wenn eine Aktion ein Konto braucht (heute: die Merkliste). */
function LoginPrompt({ reason }: { reason: string }) {
  return (
    <Sheet
      title="Dafür brauchst du ein Konto"
      onClose={dismissLoginPrompt}
      footer={
        <>
          <Button onClick={dismissLoginPrompt} variant="ghost" size="sm">
            Später
          </Button>
          <LinkButton href={href("/konto")} variant="primary">
            Anmelden
          </LinkButton>
        </>
      }
    >
      <p className="max-w-prose text-body text-fg2">{reason}</p>
      <p className="mt-3 max-w-prose text-body text-fg2">
        Die Anmeldung läuft ohne Passwort: E-Mail eingeben, auf den Link
        klicken, fertig. Ein Registrierungsformular gibt es nicht.
      </p>
    </Sheet>
  );
}

export default function AccountSync() {
  const loginReason = useStore($loginPrompt);
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
    void resolveZip(profile.plz)
      .then((home) => home && setGemeinde(home))
      .catch((err: unknown) => console.warn("[ev4u] PLZ map failed to load:", err));
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
    // `isFuelType` schützt vor einer Profilzeile aus einer Version, die den
    // Antrieb noch anders benannt hat — ein unbekannter Wert würde sonst das
    // ganze Kostenmodell auf undefined laufen lassen.
    if (isFuelType(profile.car_fuel) && profile.car_consumption) {
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

  // Ist jemand inzwischen angemeldet, hat sich der Hinweis erledigt.
  useEffect(() => {
    if (session) dismissLoginPrompt();
  }, [session]);

  return loginReason ? <LoginPrompt reason={loginReason} /> : null;
}
