import { supabase } from "./supabase";
import { href } from "./url";

/* ============================================================================
   KI-Suche — Client-Seite.

   Ruft die Edge Function `suche` auf, die eine Beschreibung in Filterparameter
   übersetzt. Die Funktion gibt genau die Parameter zurück, die /inserate
   ohnehin aus der URL liest — das Ergebnis ist damit eine ganz normale,
   teilbare, nachjustierbare Suche. Nichts an dieser Stelle ist «magisch»:
   was die KI gesetzt hat, steht danach als entfernbarer Chip auf der Seite.

   Fällt still aus, wenn kein Backend konfiguriert ist, die Funktion nicht
   deployt wurde oder der Aufruf scheitert — die Aufrufer weichen dann auf die
   lokale Sofortsuche aus. Die Seite funktioniert ohne diese Datei vollständig.
   ============================================================================ */

export type AiSearchResult = {
  /** URL-fertige Filterparameter, bereits serverseitig validiert. */
  params: Record<string, string>;
  /** Ein Satz auf Deutsch: wonach wurde gefiltert. */
  reply: string;
  /** Wünsche, für die es kein Filterfeld gibt (z. B. «Anhängerkupplung»). */
  unsupported: string[];
};

/** True, wenn ein Backend konfiguriert ist. Sagt nichts darüber aus, ob die
 *  Funktion deployt ist — das zeigt sich erst beim Aufruf. */
export const aiSearchPossible = (): boolean => Boolean(supabase);

/** Übersetzt Freitext in Filter. `null` heisst: nicht verfügbar oder
 *  fehlgeschlagen — dann normal weitersuchen. */
export async function aiSearch(query: string): Promise<AiSearchResult | null> {
  if (!supabase || query.trim().length < 2) return null;
  try {
    const { data, error } = await supabase.functions.invoke("suche", {
      body: { query: query.trim() },
    });
    if (error || !data || typeof data !== "object") return null;
    const result = data as Partial<AiSearchResult>;
    if (!result.params || typeof result.params !== "object") return null;
    return {
      params: result.params,
      reply: typeof result.reply === "string" ? result.reply : "",
      unsupported: Array.isArray(result.unsupported) ? result.unsupported : [],
    };
  } catch {
    return null;
  }
}

/** Zielt auf /inserate mit den gefundenen Filtern. `ai=1` markiert die
 *  Herkunft, damit die Seite die Antwort einmalig einblenden kann. */
export function aiSearchUrl(result: AiSearchResult, query: string): string {
  const sp = new URLSearchParams(result.params);
  sp.set("ai", "1");
  if (result.reply) sp.set("airx", result.reply.slice(0, 200));
  if (result.unsupported.length) sp.set("aino", result.unsupported.join("|").slice(0, 200));
  if (!sp.get("q") && !hasRealFilter(result.params)) sp.set("q", query.trim());
  return `${href("/inserate")}?${sp.toString()}`;
}

/** Hat die KI überhaupt etwas gesetzt? Wenn nicht, ist der Freitext das
 *  Beste, was wir haben. */
function hasRealFilter(params: Record<string, string>): boolean {
  return Object.keys(params).some((k) => k !== "q");
}
