import { atom } from "nanostores";

/* ============================================================================
   Flüchtiger UI-Zustand, den mehrere Inseln teilen (nicht persistiert).

   Die Kontextleiste liegt im Layout, geöffnet wird ihr Sheet aber auch aus
   Inseln weiter unten auf der Seite — etwa aus der Kostenrechnung eines
   Inserats («Werte anpassen») oder aus einer Fussnote an einer Zahl.
   ============================================================================ */

export const $contextSheet = atom(false);

export function openContextSheet(): void {
  $contextSheet.set(true);
}

export function closeContextSheet(): void {
  $contextSheet.set(false);
}
