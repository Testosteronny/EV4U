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

/* ----------------------------------------------------------------------------
   Anmelde-Hinweis. Die Merkliste gehört zum Konto — ein Herz-Klick ohne
   Anmeldung muss das erklären. Vorher tat das ein `window.confirm()`: ein
   Systemdialog mitten im Katalog, der den Browser blockiert und mit dem
   restlichen Erscheinungsbild nichts zu tun hat. Jetzt trägt der Text, warum
   es ein Konto braucht, und der Klick geht nicht verloren.
   ---------------------------------------------------------------------------- */

export const $loginPrompt = atom<string | null>(null);

/** @param reason Ein Satz: wofür wird die Anmeldung gebraucht? */
export function askToLogIn(reason: string): void {
  $loginPrompt.set(reason);
}

export function dismissLoginPrompt(): void {
  $loginPrompt.set(null);
}
