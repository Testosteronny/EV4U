import { useState } from "react";
import { Camera, Check, HeartPulse, Radio } from "lucide-react";
import CarGraphic from "../CarGraphic";
import VehiclePicker from "../VehiclePicker";
import { Badge, Button, EmptyState, Field, LinkButton, PageHeader } from "../ui";
import { useProfile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import { EMPTY_CHOICE, useVehiclePick, type VehicleChoice } from "../../hooks/useVehicleCatalog";
import { listingSpecs, yearHint, type CatalogVariant } from "../../lib/vehicleCatalog";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { SEGMENT_LABEL, SELLER_LABEL } from "../../utils/format";
import { fmtCH, resolveZip } from "../../utils/swiss";
import { usePlzResolver } from "../../hooks/usePlzResolver";

/* ============================================================================
   /verkaufen — Angebotsseite plus Erfassung als Drei-Schritt-Assistent.

   Vorher ein flaches Formular mit Versal-Mono-Feldbeschriftungen. Jetzt:
   Fahrzeug → Eckdaten → Prüfen, mit einer Live-Vorschau der Inseratskarte,
   damit sichtbar ist, was Käufer sehen werden.
   ============================================================================ */

const STEPS = [
  {
    icon: Camera,
    title: "Erfassen",
    text: "Marke, Modell, Variante, Preis. Reichweite, Batterie, Ladezeit und Gewicht füllt EV4U aus dem Fahrzeugkatalog vor.",
  },
  {
    icon: HeartPulse,
    title: "SOH messen (optional)",
    text: "Ein zertifizierter Batterie-Check beim Partner macht aus deiner Angabe einen belegten Wert — das Argument, das den Preis hält.",
  },
  {
    icon: Radio,
    title: "Live im Katalog",
    text: "Dein Inserat erscheint mit Kostenrechnung für jeden Besucher, in dessen Gemeinde.",
  },
];

const PRICING = [
  {
    who: "Privat",
    price: "0.—",
    unit: "Basisinserat",
    features: [
      "90 Tage online, unbegrenzt Fotos",
      "SOH-Check beim Partner: CHF 79.—",
      "Boost auf die Startseite: CHF 29.—",
    ],
  },
  {
    who: "Garage",
    price: "ab 290.—",
    unit: "pro Monat, Flotten-Abo",
    features: [
      "Unbegrenzte Inserate, Garagen-Profil",
      "SOH-Zertifikate inklusive",
      "Leads direkt ins eigene CRM",
    ],
  },
];

const WIZARD = ["Fahrzeug", "Eckdaten", "Prüfen"] as const;

/** Die Kurzfakten, die aus der gewählten Variante ins Inserat übernommen
 *  werden — genau das, nicht mehr. */
function prefilledFacts(v: CatalogVariant): string[] {
  return [
    v.range_wltp_km !== null && `${fmtCH(v.range_wltp_km)} km WLTP`,
    v.consumption_kwh_100km !== null && `${v.consumption_kwh_100km} kWh/100 km`,
    v.battery_net_kwh !== null && `${v.battery_net_kwh} kWh netto`,
    v.dc_max_kw !== null
      ? `DC ${fmtCH(v.dc_max_kw)} kW${v.dc_10_80_min !== null ? ` · 10–80 % in ${v.dc_10_80_min} min` : ""}`
      : (v.charge_port === "Schuko" || v.charge_port === "Typ 2") && "nur AC-Laden",
    `${v.seats} ${v.seats === 1 ? "Sitz" : "Sitze"}`,
    v.curb_weight_kg !== null && `${fmtCH(v.curb_weight_kg)} kg`,
    v.v2l && "V2L",
    v.price_new_chf !== null && `Neupreis ab CHF ${fmtCH(v.price_new_chf)}`,
  ].filter((x): x is string => Boolean(x));
}

export default function VerkaufenPage() {
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<VehicleChoice>(EMPTY_CHOICE);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = useVehiclePick(choice);
  const specs = listingSpecs(pick.catalogModel, pick.catalogVariant);
  const variant = pick.catalogVariant;
  const vehicleDone = pick.complete;
  const segment = specs.segment;
  const yearWarning = yearHint(pick.catalogModel, Number(form.JAHRGANG));
  // The PLZ map loads once the seller starts typing a postcode.
  const resolvePlz = usePlzResolver((form.PLZ ?? "") !== "");
  const plzHit =
    resolvePlz && /^\d{4}$/.test(form.PLZ ?? "") ? resolvePlz(form.PLZ!) : null;
  // Die Eckdaten, ohne die ein Inserat niemandem hilft.
  const factsDone =
    Number(form.JAHRGANG) >= 2010 &&
    Number(form.JAHRGANG) <= new Date().getFullYear() + 1 &&
    Number(form.PREIS) > 0 &&
    (form.KM ?? "") !== "";

  const set = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const submit = async () => {
    setError(null);
    if (!supabase || !session || !vehicleDone) return;
    setBusy(true);
    const slugBase = `${pick.brand}-${pick.model}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Eine reine PLZ ist kein Ort. Auflösen, solange die Eingabe eindeutig
    // ist — sonst stünde auf dem Inserat «4617» neben lauter «4600 Olten».
    const plz = (form.PLZ ?? "").trim();
    const hit = /^\d{4}$/.test(plz) ? await resolveZip(plz).catch(() => null) : null;
    const ort = hit && !hit.estimated ? `${hit.zip} ${hit.name}` : plz;

    const { error: err } = await supabase.from("listings").insert({
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
      owner: session.user.id,
      // Keine Versalien mehr: der Katalog setzt Fahrzeugnamen gemischt, und
      // ein `.toUpperCase()` beim Speichern hätte diese Information für
      // immer weggeworfen.
      brand: pick.brand,
      model: pick.model,
      variant: pick.variant || null,
      year: Number(form.JAHRGANG) || new Date().getFullYear(),
      km: Number(form.KM) || 0,
      price: Number(form.PREIS) || 1,
      // Aus der gewählten Variante vorbefüllt; was der Katalog nicht kennt,
      // bleibt leer oder steht als Platzhalter (listingSpecs). Alles davon
      // ist auf /konto bearbeitbar, bevor publiziert wird.
      ...specs,
      soh: Number(form.SOH) || 100,
      seller_name: profile?.name || session.user.email?.split("@")[0] || "Privat",
      seller_type: profile?.type ?? "PRIVAT",
      ort,
      status: "ENTWURF",
      note: form.BESCHREIBUNG?.trim() || "",
      // Die Verknüpfung bleibt, auch wenn der Verkäufer die Werte später
      // korrigiert — sie sagt, WELCHES Auto es ist, nicht was es kann.
      model_id: pick.catalogModel?.id ?? null,
      variant_id: variant?.id ?? null,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSaved(true);
  };

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Dein E-Auto verkaufen"
        lead="Privat oder als Garage. Käufer sehen bei dir nicht nur den Preis, sondern was das Auto sie im Jahr kostet — mit ihrem eigenen Stromtarif gerechnet."
      />

      {/* Ablauf */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card p-5">
            <div className="flex items-center justify-between">
              <s.icon size={20} strokeWidth={1.75} className="text-fg2" aria-hidden />
              <span className="text-small text-fg3 tabular">{i + 1}</span>
            </div>
            <h3 className="mt-3 text-h3 font-semibold text-fg">{s.title}</h3>
            <p className="mt-1.5 text-body text-fg2">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Preise */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {PRICING.map((p) => (
          <div key={p.who} className="card p-5">
            <div className="eyebrow">{p.who}</div>
            <div className="mt-1.5 text-h2 font-semibold text-fg tabular">
              {p.price}
              <span className="ml-2 text-body font-normal text-fg2">{p.unit}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-body text-fg2">
                  <Check size={15} className="mt-1 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Assistent */}
      <section className="mt-10">
        <h2 className="text-h2 font-semibold text-fg">Inserat erfassen</h2>

        {saved ? (
          <div className="mt-5">
            <EmptyState
              title="Entwurf gespeichert."
              hint="Der Entwurf bleibt privat. Auf deinem Konto ergänzt du Fotos und Beschreibung — und publizierst, wenn es passt."
            >
              <LinkButton href={href("/konto")} variant="primary" size="sm">
                Fotos ergänzen & publizieren
              </LinkButton>
              <Button
                onClick={() => {
                  setSaved(false);
                  setStep(0);
                  setForm({});
                  setChoice(EMPTY_CHOICE);
                }}
                variant="secondary"
                size="sm"
              >
                Weiteres Inserat
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
            <div className="card p-5 sm:p-6">
              {/* Schritte */}
              <ol className="flex flex-wrap items-center gap-2">
                {WIZARD.map((w, i) => (
                  <li key={w} className="flex items-center gap-2">
                    <button
                      onClick={() => i < step && setStep(i)}
                      disabled={i > step}
                      className={`flex items-center gap-2 rounded-chip px-2 py-1 text-small font-medium transition-colors ${
                        i === step
                          ? "bg-accent/10 text-accent"
                          : i < step
                            ? "text-fg2 hover:bg-surface2"
                            : "text-fg3"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] tabular ${
                          i <= step ? "bg-accent text-on-accent" : "bg-surface2 text-fg3"
                        }`}
                      >
                        {i < step ? <Check size={11} /> : i + 1}
                      </span>
                      {w}
                    </button>
                    {i < WIZARD.length - 1 && (
                      <span className="text-fg3" aria-hidden>
                        ›
                      </span>
                    )}
                  </li>
                ))}
              </ol>

              <div className="mt-5">
                {step === 0 && (
                  <div className="space-y-5">
                    <VehiclePicker value={choice} onChange={setChoice} />

                    {variant && (
                      <div>
                        <div className="eyebrow mb-2">Aus dem Katalog vorbefüllt</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...prefilledFacts(variant), SEGMENT_LABEL[segment]].map((c) => (
                            <Badge key={c} tone="positive">
                              {c}
                            </Badge>
                          ))}
                        </div>
                        {(variant.range_wltp_km === null ||
                          variant.consumption_kwh_100km === null ||
                          variant.battery_net_kwh === null) && (
                          <p className="mt-2 text-small text-fg3">
                            Der Hersteller hat noch nicht alle Werte publiziert — die
                            fehlenden ergänzt du im Konto.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Field label="Jahrgang">
                        <input
                          value={form.JAHRGANG ?? ""}
                          onChange={(e) =>
                            set("JAHRGANG", e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          inputMode="numeric"
                          placeholder="2023"
                          aria-describedby={yearWarning ? "jahrgang-hinweis" : undefined}
                          className="field tabular"
                        />
                      </Field>
                      {yearWarning && (
                        <p id="jahrgang-hinweis" className="mt-1 text-small text-caution">
                          {yearWarning}
                        </p>
                      )}
                    </div>
                    <Field label="Kilometerstand">
                      <input
                        value={form.KM ?? ""}
                        onChange={(e) => set("KM", e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        placeholder="28000"
                        className="field tabular"
                      />
                    </Field>
                    <Field
                      label="Standort-PLZ"
                      hint={
                        plzHit
                          ? `${plzHit.zip} ${plzHit.name} · Kanton ${plzHit.canton}`
                          : "Vier Ziffern — daraus wird der Ort auf dem Inserat."
                      }
                    >
                      <input
                        value={form.PLZ ?? ""}
                        onChange={(e) =>
                          set("PLZ", e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        inputMode="numeric"
                        placeholder="4617"
                        className="field tabular"
                      />
                    </Field>
                    <Field label="Preis in CHF">
                      <input
                        value={form.PREIS ?? ""}
                        onChange={(e) => set("PREIS", e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        placeholder="24900"
                        className="field tabular"
                      />
                    </Field>
                    <Field
                      label="Batterie-SOH in %"
                      hint="Aus Zertifikat oder Bordcomputer. Weisst du es nicht, lass 100 stehen und trag es später nach."
                    >
                      <input
                        value={form.SOH ?? ""}
                        onChange={(e) =>
                          set("SOH", e.target.value.replace(/\D/g, "").slice(0, 3))
                        }
                        inputMode="numeric"
                        placeholder="94"
                        className="field tabular"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label="Beschreibung"
                        hint="Was ein Foto nicht zeigt: Zustand, Ausstattung, Servicehistorie."
                      >
                        <textarea
                          value={form.BESCHREIBUNG ?? ""}
                          onChange={(e) => set("BESCHREIBUNG", e.target.value)}
                          rows={3}
                          maxLength={1200}
                          placeholder="Erstbesitz, Service lückenlos, Winterräder dabei…"
                          className="field resize-y"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="max-w-prose text-body text-fg2">
                      Das speichern wir als privaten Entwurf. Fotos ergänzt du
                      auf deinem Konto, die technischen Daten prüfst du dort —
                      publiziert wird erst, wenn du es auslöst.
                    </p>
                    {!supabase ? (
                      <p className="mt-3 text-small text-caution">
                        Backend nicht konfiguriert — der Entwurf wird nur lokal
                        bestätigt.
                      </p>
                    ) : !session ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-surface2 px-4 py-3">
                        <p className="max-w-prose text-body text-fg2">
                          Zum Speichern anmelden — ohne Passwort, per Login-Link.
                        </p>
                        <LinkButton href={href("/konto")} variant="primary" size="sm">
                          Anmelden
                        </LinkButton>
                      </div>
                    ) : null}
                    {error && <p className="mt-3 text-small text-caution">{error}</p>}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                <Button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  variant="ghost"
                  size="sm"
                >
                  Zurück
                </Button>
                {step < 2 ? (
                  <Button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={(step === 0 && !vehicleDone) || (step === 1 && !factsDone)}
                    title={
                      step === 1 && !factsDone
                        ? "Jahrgang, Kilometerstand und Preis fehlen noch"
                        : undefined
                    }
                    variant="primary"
                  >
                    Weiter
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (supabase && session) void submit();
                      else if (!supabase) setSaved(true);
                    }}
                    disabled={busy || (Boolean(supabase) && (!session || !vehicleDone))}
                    variant="primary"
                  >
                    {busy ? "Speichert…" : "Entwurf speichern"}
                  </Button>
                )}
              </div>
            </div>

            {/* Live-Vorschau: was Käufer sehen werden */}
            <aside>
              <div className="eyebrow mb-2">So sehen Käufer dein Inserat</div>
              <div className="card-flush">
                <div className="grid aspect-16/10 place-items-center border-b border-line bg-surface2">
                  <CarGraphic segment={segment} className="h-3/5 w-3/5 text-fg3" />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-h3 font-semibold text-fg">
                    {pick.brand || "Marke"} {pick.model || "Modell"}
                  </h3>
                  {pick.variant && (
                    <p className="truncate text-small text-fg2">{pick.variant}</p>
                  )}
                  <p className="mt-1 text-small text-fg2">
                    {form.JAHRGANG || "Jahr"} ·{" "}
                    <span className="tabular">
                      {form.KM ? fmtCH(Number(form.KM)) : "—"}
                    </span>{" "}
                    km ·{" "}
                    {variant?.range_wltp_km
                      ? `${fmtCH(variant.range_wltp_km)} km Reichweite`
                      : "Reichweite"}{" "}
                    · {SELLER_LABEL[profile?.type ?? "PRIVAT"]}
                  </p>
                  <div className="mt-3 border-t border-line pt-3 text-h3 font-semibold text-fg tabular">
                    CHF {form.PREIS ? fmtCH(Number(form.PREIS)) : "—"}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-small text-fg3">
                Fotos ersetzen die Zeichnung, sobald du sie hochlädst.
              </p>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
