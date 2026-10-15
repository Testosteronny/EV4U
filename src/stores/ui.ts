import { atom } from "nanostores";

/* ============================================================================
   Flüchtiger UI-Zustand, den mehrere Inseln teilen (nicht persistiert).

   Das Fahrprofil-Sheet hängt am Chip im Header, geöffnet wird es aber auch
   aus Inseln weiter unten auf der Seite: von jeder persönlichen Zahl
   («für dich →»), aus der Kostenrechnung eines Inserats, aus dem Tipp in
   den Suchergebnissen.
   ============================================================================ */

export const $fahrprofilOpen = atom(false);

export function openFahrprofil(): void {
  $fahrprofilOpen.set(true);
}

export function closeFahrprofil(): void {
  $fahrprofilOpen.set(false);
}
