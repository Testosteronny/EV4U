import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, HeartPulse, Radio, Zap } from "lucide-react";
import { SectionHeader, Stamp } from "../ui";
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
   /verkaufen — the supply side. A marketplace lives on listings: clear
   pitch, three steps, two honest price panels (Privat / Garage) and a mock
   capture form (no backend yet — the draft is acknowledged with a stamp).
   ============================================================================ */

const STEPS = [
  {
    icon: Camera,
    title: "Erfassen",
    text: "Marke, Modell, Bilder, Preis. Eckdaten wie Reichweite und Ladezeit füllt EV4U aus der Modell-Datenbank vor.",
  },
  {
    icon: HeartPulse,
    title: "SOH messen",
    text: "Ein zertifizierter Batterie-Check (State of Health) macht dein Inserat glaubwürdig — gemessen, nicht behauptet.",
  },
  {
    icon: Radio,
    title: "Live auf der Tafel",
    text: "Dein Inserat erscheint mit Energiekosten-Rechnung für jeden Besucher — in dessen Gemeinde. Käufer sehen den Wert, nicht nur den Preis.",
  },
];

const FIELDS = ["JAHRGANG", "KM-STAND", "PLZ", "PREIS CHF"] as const;

/** Sentinel for "my model isn't in the catalog" — frees the manual inputs. */
const MANUAL = "__manual__";

export default function Verkaufen() {
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const models = useVehicleModels();
  const [form, setForm] = useState<Record<string, string>>({});
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brands = useMemo(
    () => [...new Set(models.map((m) => m.brand))],
    [models],
  );
  const brandModels = useMemo(
    () => models.filter((m) => m.brand === brand),
    [models, brand],
  );
  const manual = brand === MANUAL || models.length === 0;
  const selected: VehicleModel | null =
    (!manual && models.find((m) => m.id === modelId)) || null;

  const brandName = manual ? (form["MARKE"] ?? "") : brand;
  const modelName = manual ? (form["MODELL"] ?? "") : (selected?.model ?? "");
  const complete = brandName.trim() !== "" && modelName.trim() !== "";

  /** Insert the draft. Specs come prefilled from the vehicle catalog when a
   *  model is picked; the seller completes/corrects them on /konto before
   *  publishing. Manual entries fall back to mid-size placeholders. */
  const submit = async () => {
    setError(null);
    if (!supabase || !session || !complete) return;
    const slugBase = `${brandName}-${modelName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const { error: err } = await supabase.from("listings").insert({
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
      owner: session.user.id,
      brand: brandName.toUpperCase(),
      model: modelName.toUpperCase(),
      segment: selected ? toListingSegment(selected.segment) : "LIMOUSINE",
      year: Number(form["JAHRGANG"]) || new Date().getFullYear(),
      km: Number(form["KM-STAND"]) || 0,
      price: Number(form["PREIS CHF"]) || 1,
      range_km: selected?.range_km_max ?? 400,
      consumption: selected?.consumption_min ?? 16.8,
      charge_min: 30,
      dc_kw: 150,
      battery_kwh: 60,
      // Curb weight comes with the variant-level enrichment; until then the
      // mid-size reference drives the cantonal tax model.
      weight_kg: 1900,
      soh: 95,
      seats: selected?.seats_max ?? 5,
      seller_name:
        profile?.name || session.user.email?.split("@")[0] || "Privat",
      seller_type: profile?.type ?? "PRIVAT",
      ort: form["PLZ"] ?? "",
      status: "ENTWURF",
      note: "Details folgen — Entwurf.",
      price_new: selected?.price_from_chf ?? null,
      model_id: selected?.id ?? null,
    });
    if (err) setError(err.message);
    else setSaved(true);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Verkaufen"
        claim="Privat oder Garage · Inserat mit Messwerten"
      />

      {/* Three steps */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="panel p-6"
          >
            <div className="flex items-center justify-between">
              <s.icon size={20} strokeWidth={1.5} className="text-signal" />
              <span className="font-mono text-xs tracking-[0.25em] text-signal">
                0{i + 1}
              </span>
            </div>
            <h3 className="stretch-wide mt-4 text-lg font-extrabold uppercase text-ink">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
          </motion.div>
        ))}
      </div>

      {/* Pricing */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="panel p-6"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Privat
          </div>
          <div className="stretch-wide mt-2 text-4xl font-black text-ink tabular">
            0.<span className="text-xl">—</span>
            <span className="ml-2 text-sm font-normal text-muted">/ Basisinserat</span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            <li><span className="text-signal">—</span> 90 Tage online, unbegrenzt Fotos</li>
            <li><span className="text-signal">—</span> SOH-Check beim Partner: CHF 79.—</li>
            <li><span className="text-signal">—</span> Boost auf die Startseite: CHF 29.—</li>
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="panel border-signal/40 p-6"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Garage
          </div>
          <div className="stretch-wide mt-2 text-4xl font-black text-ink tabular">
            ab 290.<span className="text-xl">—</span>
            <span className="ml-2 text-sm font-normal text-muted">/ Monat, Flotten-Abo</span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            <li><span className="text-signal">—</span> Unbegrenzte Inserate, Garagen-Profil</li>
            <li><span className="text-signal">—</span> SOH-Zertifikate inklusive</li>
            <li><span className="text-signal">—</span> Leads direkt ins eigene CRM</li>
          </ul>
        </motion.div>
      </div>

      {/* Mock capture form */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="panel bg-blueprint mt-6 p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Inserat erfassen — Entwurf
          </span>
          {saved && <Stamp>Entwurf gespeichert</Stamp>}
        </div>
        {/* Model picker — the vehicle catalog prefills the specs */}
        <div className="grid gap-3 sm:grid-cols-2">
          {models.length > 0 && (
            <>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                  Marke
                </span>
                <select
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setModelId("");
                    setSaved(false);
                  }}
                  className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:border-signal focus:outline-none"
                >
                  <option value="">— WÄHLEN —</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b.toUpperCase()}
                    </option>
                  ))}
                  <option value={MANUAL}>ANDERE MARKE (MANUELL)</option>
                </select>
              </label>
              {!manual && (
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                    Modell ({brandModels.length})
                  </span>
                  <select
                    value={modelId}
                    onChange={(e) => {
                      setModelId(e.target.value);
                      setSaved(false);
                    }}
                    disabled={!brand}
                    className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:border-signal focus:outline-none disabled:opacity-50"
                  >
                    <option value="">— WÄHLEN —</option>
                    {brandModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.model.toUpperCase()}
                        {m.status === "AUSLAUF" ? " · AUSLAUF" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {manual &&
            (["MARKE", "MODELL"] as const).map((f) => (
              <label key={f} className="block">
                <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                  {f} (manuell)
                </span>
                <input
                  value={form[f] ?? ""}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, [f]: e.target.value }));
                    setSaved(false);
                  }}
                  className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:border-signal focus:outline-none"
                />
              </label>
            ))}
        </div>

        {/* What the catalog will prefill for this model */}
        {selected && (
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em]">
            <span className="flex items-center gap-1.5 text-signal">
              <Zap size={11} /> Vorbefüllt:
            </span>
            {[
              selected.range_km_max && `${selected.range_km_max} KM WLTP`,
              selected.consumption_min && `${selected.consumption_min} KWH/100KM`,
              selected.seats_max && `${selected.seats_max} SITZE`,
              selected.price_from_chf && `NEUPREIS AB CHF ${fmtCH(selected.price_from_chf)}`,
              toListingSegment(selected.segment),
            ]
              .filter(Boolean)
              .map((c) => (
                <span key={String(c)} className="border border-signal/40 bg-signal/[0.07] px-2 py-1 text-signal">
                  {c}
                </span>
              ))}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {FIELDS.map((f) => (
            <label key={f} className="block">
              <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                {f}
              </span>
              <input
                value={form[f] ?? ""}
                onChange={(e) => {
                  setForm((p) => ({ ...p, [f]: e.target.value }));
                  setSaved(false);
                }}
                inputMode="numeric"
                className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:border-signal focus:outline-none"
              />
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-4 font-mono text-[10px] tracking-[0.12em] text-warn">
            {error.toUpperCase()}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {!supabase ? (
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted/70">
              BACKEND NICHT KONFIGURIERT — ENTWURF WIRD NUR LOKAL BESTÄTIGT.
            </p>
          ) : !session ? (
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted/70">
              ZUM SPEICHERN ANMELDEN —{" "}
              <a href={href("/konto")} className="text-signal hover:underline">
                LOGIN-LINK AUF /KONTO
              </a>
              . DEIN ENTWURF BLEIBT PRIVAT, BIS DU IHN PUBLIZIERST.
            </p>
          ) : saved ? (
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted/70">
              GESPEICHERT ALS ENTWURF —{" "}
              <a href={href("/konto")} className="text-signal hover:underline">
                AUF /KONTO VERVOLLSTÄNDIGEN & PUBLIZIEREN
              </a>
              .
            </p>
          ) : (
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted/70">
              GESPEICHERT WIRD ALS PRIVATER ENTWURF — PUBLIZIEREN AUF /KONTO.
            </p>
          )}
          <button
            onClick={() => {
              if (supabase && session) void submit();
              else if (!supabase) setSaved(true);
            }}
            disabled={Boolean(supabase) && (!session || !complete)}
            className="border border-signal bg-signal px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-nacht transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
          >
            Entwurf speichern
          </button>
        </div>
      </motion.div>
    </section>
  );
}
