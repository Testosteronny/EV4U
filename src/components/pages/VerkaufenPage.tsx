import { useMemo, useState } from "react";
import { Camera, Check, HeartPulse, Radio } from "lucide-react";
import CarGraphic from "../CarGraphic";
import { Badge, Button, EmptyState, Field, LinkButton, PageHeader } from "../ui";
import { useProfile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import {
  toListingSegment,
  useVehicleModels,
  type VehicleModel,
} from "../../hooks/useVehicleModels";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { fmtCH } from "../../utils/swiss";

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
    text: "Marke, Modell, Bilder, Preis. Reichweite und Ladezeit füllt EV4U aus der Modell-Datenbank vor.",
  },
  {
    icon: HeartPulse,
    title: "SOH messen",
    text: "Ein zertifizierter Batterie-Check macht dein Inserat glaubwürdig — gemessen statt behauptet.",
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

/** Sentinel: «meine Marke steht nicht im Katalog». */
const MANUAL = "__manual__";

const WIZARD = ["Fahrzeug", "Eckdaten", "Prüfen"] as const;

export default function VerkaufenPage() {
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const models = useVehicleModels();

  const [step, setStep] = useState(0);
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brands = useMemo(() => [...new Set(models.map((m) => m.brand))], [models]);
  const brandModels = useMemo(
    () => models.filter((m) => m.brand === brand),
    [models, brand],
  );
  const manual = brand === MANUAL || models.length === 0;
  const selected: VehicleModel | null =
    (!manual && models.find((m) => m.id === modelId)) || null;

  const brandName = manual ? (form.MARKE ?? "") : brand;
  const modelName = manual ? (form.MODELL ?? "") : (selected?.model ?? "");
  const vehicleDone = brandName.trim() !== "" && modelName.trim() !== "";
  const segment = selected ? toListingSegment(selected.segment) : "LIMOUSINE";

  const set = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const submit = async () => {
    setError(null);
    if (!supabase || !session || !vehicleDone) return;
    setBusy(true);
    const slugBase = `${brandName}-${modelName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const { error: err } = await supabase.from("listings").insert({
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
      owner: session.user.id,
      brand: brandName.toUpperCase(),
      model: modelName.toUpperCase(),
      segment,
      year: Number(form.JAHRGANG) || new Date().getFullYear(),
      km: Number(form.KM) || 0,
      price: Number(form.PREIS) || 1,
      range_km: selected?.range_km_max ?? 400,
      consumption: selected?.consumption_min ?? 16.8,
      charge_min: 30,
      dc_kw: 150,
      battery_kwh: 60,
      weight_kg: 1900,
      soh: 95,
      seats: selected?.seats_max ?? 5,
      seller_name: profile?.name || session.user.email?.split("@")[0] || "Privat",
      seller_type: profile?.type ?? "PRIVAT",
      ort: form.PLZ ?? "",
      status: "ENTWURF",
      note: "Details folgen — Entwurf.",
      price_new: selected?.price_from_chf ?? null,
      model_id: selected?.id ?? null,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSaved(true);
  };

  return (
    <div className="mx-auto max-w-[88rem] animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Dein E-Auto verkaufen"
        lead="Privat oder als Garage. Ein Inserat mit gemessenen Werten — Käufer sehen nicht nur den Preis, sondern was das Auto sie kostet."
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
                  setBrand("");
                  setModelId("");
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    {models.length > 0 && (
                      <>
                        <Field label="Marke">
                          <select
                            value={brand}
                            onChange={(e) => {
                              setBrand(e.target.value);
                              setModelId("");
                            }}
                            className="field"
                          >
                            <option value="">Bitte wählen</option>
                            {brands.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                            <option value={MANUAL}>Andere Marke (manuell)</option>
                          </select>
                        </Field>
                        {!manual && (
                          <Field label={`Modell (${brandModels.length})`}>
                            <select
                              value={modelId}
                              onChange={(e) => setModelId(e.target.value)}
                              disabled={!brand}
                              className="field"
                            >
                              <option value="">Bitte wählen</option>
                              {brandModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.model}
                                  {m.status === "AUSLAUF" ? " · Auslauf" : ""}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </>
                    )}
                    {manual && (
                      <>
                        <Field label="Marke">
                          <input
                            value={form.MARKE ?? ""}
                            onChange={(e) => set("MARKE", e.target.value)}
                            className="field"
                          />
                        </Field>
                        <Field label="Modell">
                          <input
                            value={form.MODELL ?? ""}
                            onChange={(e) => set("MODELL", e.target.value)}
                            className="field"
                          />
                        </Field>
                      </>
                    )}

                    {selected && (
                      <div className="sm:col-span-2">
                        <div className="eyebrow mb-2">Aus dem Katalog vorbefüllt</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            selected.range_km_max && `${selected.range_km_max} km WLTP`,
                            selected.consumption_min &&
                              `${selected.consumption_min} kWh/100 km`,
                            selected.seats_max && `${selected.seats_max} Sitze`,
                            selected.price_from_chf &&
                              `Neupreis ab CHF ${fmtCH(selected.price_from_chf)}`,
                            toListingSegment(selected.segment).toLowerCase(),
                          ]
                            .filter(Boolean)
                            .map((c) => (
                              <Badge key={String(c)} tone="positive">
                                {c}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Jahrgang">
                      <input
                        value={form.JAHRGANG ?? ""}
                        onChange={(e) => set("JAHRGANG", e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        placeholder="2023"
                        className="field tabular"
                      />
                    </Field>
                    <Field label="Kilometerstand">
                      <input
                        value={form.KM ?? ""}
                        onChange={(e) => set("KM", e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        placeholder="28000"
                        className="field tabular"
                      />
                    </Field>
                    <Field label="Standort-PLZ">
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
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="max-w-prose text-body text-fg2">
                      Das speichern wir als privaten Entwurf. Fotos, Beschreibung
                      und der SOH-Wert kommen auf deinem Konto dazu — publiziert
                      wird erst, wenn du es auslöst.
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
                    disabled={step === 0 && !vehicleDone}
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
                <div className="grid aspect-[16/10] place-items-center border-b border-line bg-surface2">
                  <CarGraphic segment={segment} className="h-3/5 w-3/5 text-fg3" />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-h3 font-semibold text-fg">
                    {brandName || "Marke"} {modelName || "Modell"}
                  </h3>
                  <p className="mt-1 text-small text-fg2">
                    {form.JAHRGANG || "Jahr"} ·{" "}
                    <span className="tabular">
                      {form.KM ? fmtCH(Number(form.KM)) : "—"}
                    </span>{" "}
                    km ·{" "}
                    {selected?.range_km_max ? `${selected.range_km_max} km Reichweite` : "Reichweite"}{" "}
                    · {profile?.type === "GARAGE" ? "Garage" : "Privat"}
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
