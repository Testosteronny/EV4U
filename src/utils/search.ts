import { SEGMENT_LABEL, SELLER_LABEL } from "./format";
import type { Listing } from "../data/evData";

/* ============================================================================
   Die lokale Sofortsuche über den geladenen Bestand.

   Wohnt bewusst nicht mehr in der SearchBox: die Filterlogik von /inserate
   benutzt dieselbe Funktion, und ein Modul mit Filterprädikaten soll keine
   React-Komponente importieren müssen.
   ============================================================================ */

/** Kleinschreibung ohne diakritische Zeichen — «skoda» findet «Škoda»,
 *  «citroen» findet «Citroën». */
const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Ein Treffer, wenn jedes eingegebene Wort irgendwo im Datensatz vorkommt —
 *  «tesla 3» findet «Tesla Model 3 RWD». */
export function matchesQuery(l: Listing, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold(
    `${l.brand} ${l.model} ${SEGMENT_LABEL[l.segment]} ${SELLER_LABEL[l.sellerType]} ${l.seller} ${l.ort} ${l.year}`,
  );
  return q.split(/\s+/).every((word) => hay.includes(word));
}
