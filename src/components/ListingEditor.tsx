import { useState } from "react";
import { Button, Disclosure, Field, Sheet } from "./ui";
import { supabase, type ListingRow } from "../lib/supabase";
import { SEGMENT_LABEL } from "../utils/format";
import { REF_WEIGHT_KG } from "../utils/costModel";
import { fmtCH, resolveZip } from "../utils/swiss";
import type { Segment } from "../data/evData";

/* ============================================================================
   Inserat bearbeiten.

   Der Erfassungs-Assistent auf /verkaufen legt bewusst nur einen schmalen
   Entwurf an — Fahrzeug, Eckdaten, Preis. Alles Weitere gehört hierher, und
   ohne diese Fläche gab es das gar nicht: ein einmal gespeichertes Inserat
   liess sich nie wieder ändern. Preis falsch getippt? Neu erfassen. Auto
   inzwischen 3'000 km weiter? Pech. Beschreibung? Stand für immer auf
   «Details folgen — Entwurf.»

   Was hier steht, ist genau das, was auf der Detailseite als technische
   Daten erscheint. Nichts wird erfunden: leere Felder bleiben leer, und der
   SOH-Wert ist ausdrücklich optional (siehe unten).
   ============================================================================ */

export type EditableListing = Pick<
  ListingRow,
  | "id"
  | "slug"
  | "brand"
  | "model"
  | "segment"
  | "year"
  | "km"
  | "price"
  | "price_new"
  | "range_km"
  | "consumption"
  | "charge_min"
  | "dc_kw"
  | "battery_kwh"
  | "weight_kg"
  | "soh"
  | "bidi"
  | "seats"
  | "ort"
  | "note"
>;

/** Feld-Definition: Beschriftung, Einheit, erlaubter Bereich. Der Bereich ist
 *  keine Schikane — er hält Tippfehler («18000 kWh Batterie») aus dem
 *  Kostenmodell, das mit diesen Zahlen rechnet. */
type NumField = {
  key: keyof EditableListing;
  label: string;
  unit?: string;
  min: number;
  max: number;
  /** Darf leer bleiben — gespeichert wird dann NULL. */
  optional?: boolean;
  hint?: string;
};

// Die Bereiche decken den ganzen Fahrzeugkatalog ab — vom Leichtfahrzeug mit
// 5,5 kWh und einem Sitz bis zum Hypercar über 2 Mio. Franken.
const CORE: NumField[] = [
  { key: "price", label: "Preis", unit: "CHF", min: 1, max: 3000000 },
  { key: "year", label: "Jahrgang", min: 2010, max: new Date().getFullYear() + 1 },
  { key: "km", label: "Kilometerstand", unit: "km", min: 0, max: 500000 },
  {
    key: "price_new",
    label: "Neupreis",
    unit: "CHF",
    min: 0,
    max: 3000000,
    optional: true,
    hint: "Optional — daraus entsteht der «günstiger als neu»-Hinweis.",
  },
];

const SPECS: NumField[] = [
  { key: "range_km", label: "WLTP-Reichweite", unit: "km", min: 50, max: 1200 },
  { key: "consumption", label: "Verbrauch", unit: "kWh/100 km", min: 4, max: 40 },
  { key: "battery_kwh", label: "Batterie netto", unit: "kWh", min: 4, max: 250 },
  {
    key: "dc_kw",
    label: "DC-Spitzenleistung",
    unit: "kW",
    min: 10,
    max: 1500,
    optional: true,
    hint: "Leer lassen, wenn das Auto nicht schnellladen kann.",
  },
  { key: "charge_min", label: "Laden 10–80 %", unit: "min", min: 5, max: 180, optional: true },
  { key: "seats", label: "Sitze", min: 1, max: 9 },
  {
    key: "weight_kg",
    label: "Leergewicht",
    unit: "kg",
    min: 300,
    max: 4000,
    optional: true,
    hint: `Bestimmt die kantonale Verkehrssteuer. Ohne Angabe rechnen wir mit ${fmtCH(REF_WEIGHT_KG)} kg.`,
  },
];

export default function ListingEditor({
  listing,
  onClose,
  onSaved,
}: {
  listing: EditableListing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...CORE, ...SPECS].map((f) => [f.key, listing[f.key] == null ? "" : String(listing[f.key])]),
    ),
  );
  const [note, setNote] = useState(listing.note ?? "");
  const [ort, setOrt] = useState(listing.ort ?? "");
  const [segment, setSegment] = useState<Segment>(listing.segment);
  const [bidi, setBidi] = useState(Boolean(listing.bidi));
  const [soh, setSoh] = useState(String(listing.soh ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (key: string) => Number(String(form[key] ?? "").replace(",", "."));
  const invalid = (f: NumField) => {
    const raw = String(form[f.key] ?? "").trim();
    if (raw === "") return !f.optional;
    const v = num(f.key as string);
    return !Number.isFinite(v) || v < f.min || v > f.max;
  };
  const sohNum = Number(soh);
  const sohInvalid = !Number.isFinite(sohNum) || sohNum < 50 || sohNum > 100;

  const problems = [...CORE, ...SPECS].filter(invalid);
  const canSave = problems.length === 0 && !sohInvalid && note.trim().length > 0;

  const set = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setError(null);
  };

  const save = async () => {
    if (!supabase || !canSave) return;
    setBusy(true);
    setError(null);
    const optional = (key: string) =>
      String(form[key] ?? "").trim() === "" ? null : num(key);

    const { error: err } = await supabase
      .from("listings")
      .update({
        segment,
        price: num("price"),
        year: num("year"),
        km: num("km"),
        price_new: optional("price_new"),
        range_km: num("range_km"),
        consumption: num("consumption"),
        battery_kwh: num("battery_kwh"),
        dc_kw: optional("dc_kw"),
        charge_min: optional("charge_min"),
        seats: num("seats"),
        weight_kg: optional("weight_kg"),
        soh: sohNum,
        bidi,
        ort: ort.trim(),
        note: note.trim(),
      })
      .eq("id", listing.id);

    setBusy(false);
    if (err) setError(err.message);
    else {
      onSaved();
      onClose();
    }
  };

  const numberInput = (f: NumField) => (
    <Field key={String(f.key)} label={f.unit ? `${f.label} (${f.unit})` : f.label} hint={f.hint}>
      <input
        value={form[f.key] ?? ""}
        onChange={(e) => set(String(f.key), e.target.value.replace(/[^0-9.,]/g, ""))}
        inputMode="decimal"
        placeholder={`${f.min}–${f.max}`}
        aria-invalid={invalid(f) || undefined}
        className={`field tabular ${invalid(f) ? "border-caution" : ""}`}
      />
    </Field>
  );

  return (
    <Sheet
      title={`${listing.brand} ${listing.model} bearbeiten`}
      onClose={onClose}
      wide
      footer={
        <>
          <p className="text-micro text-fg3">
            {canSave
              ? "Änderungen sind sofort im Katalog sichtbar."
              : "Beschreibung und alle Pflichtwerte ausfüllen."}
          </p>
          <Button onClick={() => void save()} disabled={!canSave || busy} variant="primary">
            {busy ? "Speichert…" : "Speichern"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <div className="eyebrow mb-3">Angebot</div>
          <div className="grid gap-4 sm:grid-cols-2">{CORE.map(numberInput)}</div>
        </section>

        <section>
          <Field
            label="Beschreibung"
            hint="Was ein Foto nicht zeigt: Zustand, Ausstattung, Servicehistorie, Grund des Verkaufs."
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1200}
              placeholder="Erstbesitz, Service lückenlos bei der Vertretung, Winterräder auf Felgen dabei…"
              className="field resize-y"
            />
          </Field>
          <p className="mt-1 text-micro text-fg3 tabular">{note.length}/1200</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Standort" hint="Wird auf dem Inserat angezeigt.">
            <input
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              onBlur={() => {
                // «4617» allein ist kein Ort. Auflösen, wenn möglich.
                const plz = ort.trim();
                if (!/^\d{4}$/.test(plz)) return;
                void resolveZip(plz)
                  .then((hit) => {
                    // Nur übernehmen, wenn in der Zwischenzeit niemand weitergetippt hat.
                    if (hit && !hit.estimated) setOrt((cur) => (cur.trim() === plz ? `${hit.zip} ${hit.name}` : cur));
                  })
                  .catch(() => {});
              }}
              maxLength={60}
              placeholder="4600 Olten"
              className="field"
            />
          </Field>
          <Field label="Karosserie">
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as Segment)}
              className="field"
            >
              {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section>
          <div className="eyebrow mb-3">Batterie</div>
          <Field
            label="Batterie-SOH (%)"
            hint="Aus dem Batteriezertifikat oder dem Bordcomputer. Der Wert steht als Angabe des Anbieters am Inserat — erst ein Partner-Check macht daraus ein «gemessen»."
          >
            <input
              value={soh}
              onChange={(e) => setSoh(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="z. B. 94"
              aria-invalid={sohInvalid || undefined}
              className={`field tabular ${sohInvalid ? "border-caution" : ""}`}
            />
          </Field>
          {sohInvalid && (
            <p className="mt-1 text-small text-caution">
              Plausible Werte liegen zwischen 50 und 100 %.
            </p>
          )}
        </section>

        <Disclosure summary="Technische Daten">
          <div className="grid gap-4 sm:grid-cols-2">
            {SPECS.map(numberInput)}
            <label className="flex items-center gap-2.5 self-end pb-2 text-body text-fg">
              <input
                type="checkbox"
                checked={bidi}
                onChange={(e) => setBidi(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--c-accent))]"
              />
              Kann rückspeisen (V2H/V2L/V2G)
            </label>
          </div>
          <p className="mt-3 max-w-prose text-micro text-fg3">
            Diese Werte tragen die Kostenrechnung, die Käufer auf deinem
            Inserat sehen — Verbrauch und Gewicht bestimmen Energiekosten und
            Verkehrssteuer. Zu optimistisch angesetzt fällt spätestens bei der
            Probefahrt auf.
          </p>
        </Disclosure>

        {error && <p className="text-small text-caution">{error}</p>}
      </div>
    </Sheet>
  );
}
