import { atom } from "nanostores";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/* ============================================================================
   Auth-Session als geteilter Atom.

   Vorher hielt jeder `useSession()`-Aufruf seinen eigenen State, rief
   `getSession()` selbst auf und meldete eine eigene `onAuthStateChange`-
   Subscription an. Weil `useFavorites` intern `useSession` benutzt und jede
   Inseratskarte `useFavorites` benutzt, öffnete eine Katalogseite mit zwölf
   Karten ein Dutzend Subscriptions und ein Dutzend Netzwerkaufrufe für
   dieselbe Antwort. Jetzt: ein Aufruf, eine Subscription, ein Wert.
   ============================================================================ */

export const $session = atom<Session | null>(null);
/** False, bis die erste Antwort da ist — davor ist «nicht angemeldet» nur
 *  eine Vermutung, und die Oberfläche darf daraus nichts ableiten. */
export const $sessionReady = atom(!supabase);

let started = false;

export function ensureSession(): void {
  if (started || typeof window === "undefined" || !supabase) return;
  started = true;

  void supabase.auth.getSession().then(({ data }) => {
    $session.set(data.session);
    $sessionReady.set(true);
  });

  // Läuft für die Lebensdauer der Seite — es gibt genau einen Abnehmer, und
  // der ist das Modul selbst. Kein Abmelden nötig, kein Leck möglich.
  supabase.auth.onAuthStateChange((_event, session) => {
    $session.set(session);
    $sessionReady.set(true);
  });
}
