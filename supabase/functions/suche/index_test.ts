import { assertEquals } from "jsr:@std/assert@1";
import { coerce, outputText } from "./index.ts";

/* ============================================================================
   Tests für die reine Logik der Suchfunktion — den Teil, der auch dann noch
   stimmen muss, wenn das Modell etwas Unerwartetes liefert.

   Ausgeführt mit:  deno test supabase/functions/suche/index_test.ts
   ============================================================================ */

const D = { brands: ["TESLA", "VW", "KIA"], count: 13, minPrice: 9900, maxPrice: 57900 };

/* ---- outputText: Antwortform der Interactions API ----------------------- */

Deno.test("outputText liest steps → model_output → text", () => {
  const body = {
    steps: [
      { type: "reasoning", content: [{ type: "text", text: "IGNORIEREN" }] },
      { type: "model_output", content: [{ type: "text", text: '{"reply":"ok"}' }] },
    ],
  };
  assertEquals(outputText(body), '{"reply":"ok"}');
});

Deno.test("outputText fügt mehrere Textblöcke zusammen", () => {
  const body = {
    steps: [{ type: "model_output", content: [{ type: "text", text: '{"a":' }, { type: "text", text: "1}" }] }],
  };
  assertEquals(outputText(body), '{"a":1}');
});

Deno.test("outputText gibt bei unbekannter Form leer zurück statt zu werfen", () => {
  assertEquals(outputText(null), "");
  assertEquals(outputText({}), "");
  assertEquals(outputText({ steps: "kaputt" }), "");
  assertEquals(outputText({ steps: [{ type: "model_output" }] }), "");
});

/* ---- coerce: der Schutzwall ------------------------------------------- */

Deno.test("übernimmt eine saubere Modellantwort", () => {
  const { params, unsupported } = coerce(
    { seg: "KOMBI", sitze: "5", preis: 40000, reichweite: 500, reply: "x", unsupported: [] },
    D,
  );
  assertEquals(params, { seg: "KOMBI", sitze: "5", preis: "40000", reichweite: "500" });
  assertEquals(unsupported, []);
});

Deno.test("erfundene Marke wird Freitext statt Filter", () => {
  // Das Schema sollte das verhindern — falls doch, darf es nicht zu garantiert
  // null Treffern führen.
  const { params } = coerce({ marke: "VOLKSWAGEN" }, D);
  assertEquals(params.marke, undefined);
  assertEquals(params.q, "VOLKSWAGEN");
});

Deno.test("echte Marke aus dem Bestand wird übernommen", () => {
  assertEquals(coerce({ marke: "tesla" }, D).params.marke, "TESLA");
});

Deno.test("Preis wird auf die Reglerstufe gerundet und begrenzt", () => {
  assertEquals(coerce({ preis: 37500 }, D).params.preis, "40000"); // auf 5000er
  assertEquals(coerce({ preis: 500 }, D).params.preis, "10000"); // Untergrenze
  assertEquals(coerce({ preis: 999999 }, D).params.preis, undefined); // = kein Filter
});

Deno.test("Reichweite und Ladeleistung rasten auf erlaubte Stufen ein", () => {
  assertEquals(coerce({ reichweite: 470 }, D).params.reichweite, "500");
  assertEquals(coerce({ laden: 120 }, D).params.laden, "100");
  assertEquals(coerce({ reichweite: 0 }, D).params.reichweite, undefined);
});

Deno.test("Müll in Enum-Feldern wird verworfen, nicht übernommen", () => {
  const { params, unsupported } = coerce({ seg: "CABRIO", anbieter: "HÄNDLER", sitze: "9" }, D);
  assertEquals(params.seg, undefined);
  assertEquals(params.anbieter, undefined);
  assertEquals(params.sitze, undefined);
  assertEquals(unsupported.includes("Karosserie «CABRIO»"), true);
});

Deno.test("Standardsortierung erzeugt keinen Parameter", () => {
  assertEquals(coerce({ sort: "neu" }, D).params.sort, undefined);
  assertEquals(coerce({ sort: "reichweite" }, D).params.sort, "reichweite");
  assertEquals(coerce({ sort: "range" }, D).params.sort, undefined); // alter Schlüssel
});

Deno.test("Ja/Nein-Filter nur bei echtem true", () => {
  assertEquals(coerce({ v2l: true }, D).params.v2l, "1");
  assertEquals(coerce({ v2l: false }, D).params.v2l, undefined);
  assertEquals(coerce({ ahk: "true", allrad: true }, D).params, { ahk: "1", allrad: "1" });
});

Deno.test("Stufenfilter rasten ein, Jahrgang bleibt im Rahmen", () => {
  const { params } = coerce({ km: 60000, soh: 92, kofferraum: 450, betrieb: 180, jahr: 2021 }, D);
  assertEquals(params, { km: "50000", soh: "90", kofferraum: "400", betrieb: "200", jahr: "2021" });
  assertEquals(coerce({ jahr: 1999 }, D).params.jahr, undefined);
});

Deno.test("leere Modellantwort ergibt leere Filter statt Fehler", () => {
  const { params, unsupported } = coerce({}, D);
  assertEquals(params, {});
  assertEquals(unsupported, []);
});

Deno.test("nicht abbildbare Wünsche kommen durch", () => {
  const { unsupported } = coerce({ unsupported: ["Anhängerkupplung", "Allrad"] }, D);
  assertEquals(unsupported, ["Anhängerkupplung", "Allrad"]);
});
