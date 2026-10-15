import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, Cloud, CloudOff, LogIn, Tag } from "lucide-react";
import PhotoStep from "./PhotoStep";
import VehiclePicker from "./VehiclePicker";
import {
  EMPTY_DRAFT,
  NOTE_MAX,
  STEP_VALID,
  canPersist,
  canPublish,
  catalogWarranty,
  clearLocal,
  draftQuality,
  draftToRow,
  loadLocal,
  newSlug,
  rowToDraft,
  saveLocal,
  valid,
  type Draft,
  type FullRow,
  type Vehicle,
} from "./draft";
import ListingCard from "../listing/ListingCard";
import { useVehicleSelection } from "../search/VehicleFilter";
import {
  Badge,
  Button,
  CheckRow,
  Disclosure,
  Field,
  LinkButton,
  Notice,
  QualityMeter,
  Segmented,
  Select,
  Stepper,
  Toggle,
} from "../ui";
import { useListings } from "../../hooks/useListings";
import { usePlzResolver } from "../../hooks/usePlzResolver";
import { useProfile, type Profile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import { EMPTY_CHOICE, useVehiclePick, type VehicleChoice, type VehiclePick } from "../../hooks/useVehicleCatalog";
import { rowToListing } from "../../lib/mappers";
import { EQUIPMENT_ITEMS } from "../../lib/listingFacts";
import { PRICE_METHOD, estimatePrice } from "../../lib/priceCheck";
import { listingQuality } from "../../lib/quality";
import { supabase, type ListingRow, type ListingRowStatus } from "../../lib/supabase";
import { href } from "../../lib/url";
import { listingSpecs, yearHint, type ListingSpecs } from "../../lib/vehicleCatalog";
import { refreshListings } from "../../stores/listings";
import { SEGMENT_LABEL, STATUS_LABEL } from "../../utils/format";
import { REF_WEIGHT_KG } from "../../utils/costModel";
import { fmtCH } from "../../utils/swiss";
import type { Segment } from "../../data/evData";

/* ============================================================================
   /verkaufen/neu (Konzept §4.8) — the sell wizard, seven steps:
   Fahrzeug · Zustand · Batterie · Ausstattung · Fotos · Preis · Vorschau.

   Full screen with the minimal header. The draft lives in localStorage from
   the first keystroke and becomes a private ENTWURF row as soon as the
   table has what it needs; from then on every step change saves. `?id=`
   opens an existing listing — this wizard is also the editor.
   ============================================================================ */

const STEPS = ["Fahrzeug", "Zustand", "Batterie", "Ausstattung", "Fotos", "Preis", "Vorschau"];

const EDIT_SELECT =
  "*,catalog_model:vehicle_models!listings_model_id_fkey(slug,launch_year,end_year)," +
  "catalog_variant:vehicle_variants!listings_variant_id_fkey(slug,ac_max_kw,system_voltage_v,cell_chemistry," +
  "charge_port,v2l,drive,power_kw,power_ps,accel_0_100_s,top_speed_kmh,trunk_l,frunk_l,towing_kg,length_mm," +
  "width_mm,height_mm,battery_gross_kwh,battery_warranty_years,battery_warranty_km,battery_warranty_conditional," +
  "battery_warranty_soh_pct)";

export default function SellWizard() {
  const { session, ready } = useSession();
  const { profile, loaded } = useProfile(session?.user.id);
  const [next, setNext] = useState(href("/verkaufen/neu"));
  useEffect(() => setNext(location.pathname + location.search), []);

  if (!supabase) {
    return (
      <Frame>
        <Notice>Inserieren braucht das Backend — es ist in dieser Umgebung nicht konfiguriert.</Notice>
      </Frame>
    );
  }
  if (!ready || (session && !loaded)) {
    return (
      <Frame>
        <div className="h-96 animate-pulse rounded-card bg-surface2" aria-busy="true" />
      </Frame>
    );
  }
  if (!session) {
    return (
      <Frame>
        <div className="card mx-auto max-w-lg p-6 text-center sm:p-8">
          <LogIn size={28} aria-hidden className="mx-auto text-accent" />
          <h1 className="mt-3 text-h2 font-bold text-fg">Zum Inserieren anmelden</h1>
          <p className="mt-2 text-body text-fg2">
            Ohne Passwort, per Link an deine E-Mail. Danach geht es genau hier weiter — was du schon eingegeben hast,
            bleibt.
          </p>
          <LinkButton href={`${href("/login")}?next=${encodeURIComponent(next)}`} variant="primary" className="mt-5">
            Login-Link anfordern
          </LinkButton>
          <p className="mt-4 text-small text-fg3">
            Erst schauen, was dein Auto wert ist?{" "}
            <a href={href("/verkaufen/preis-check")} className="link">
              Preis-Check ohne Konto
            </a>
          </p>
        </div>
      </Frame>
    );
  }
  return <Wizard userId={session.user.id} email={session.user.email ?? ""} profile={profile} />;
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">{children}</div>;
}

type SaveState = "local" | "saving" | "saved" | "error";

function Wizard({ userId, email, profile }: { userId: string; email: string; profile: Profile | null }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [restored, setRestored] = useState(false);
  const [save, setSave] = useState<{ state: SaveState; at?: Date; error?: string }>({ state: "local" });
  const [pending, setPending] = useState<{ marke: string; modell: string; variante: string } | null>(null);
  const [published, setPublished] = useState(false);
  const ref = useRef(draft);
  ref.current = draft;
  const top = useRef<HTMLDivElement>(null);
  const editing = draft.id !== null;

  /* ---- Start: edit an existing row, resume a local draft, or prefill ---- */
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const id = sp.get("id");
    void (async () => {
      if (id && supabase) {
        const { data } = await supabase.from("listings").select(EDIT_SELECT).eq("id", id).eq("owner", userId).maybeSingle();
        if (data) {
          setDraft(rowToDraft(data as unknown as FullRow));
          setReached(STEPS.length - 1);
          setSave({ state: "saved" });
        } else setNotFound(true);
      } else {
        const local = loadLocal();
        if (local) {
          setDraft(local.draft);
          setStep(local.step);
          setReached(local.step);
          setRestored(true);
        } else {
          const num = (k: string) => (sp.get(k) ?? "").replace(/\D/g, "");
          setDraft((d) => ({ ...d, year: num("jahr").slice(0, 4), km: num("km"), soh: num("soh").slice(0, 3) }));
          if (sp.get("marke")) setPending({ marke: sp.get("marke") ?? "", modell: sp.get("modell") ?? "", variante: sp.get("variante") ?? "" });
        }
      }
      setLoading(false);
    })();
  }, [userId]);

  // Local copy until the row exists.
  useEffect(() => {
    if (!loading && !draft.id) saveLocal(draft, step);
  }, [draft, step, loading]);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  /** Writes the row (insert on first save). Returns false on error. */
  const persist = useCallback(
    async (status?: ListingRowStatus): Promise<boolean> => {
      const d = ref.current;
      if (!supabase || !canPersist(d)) return true;
      setSave({ state: "saving" });
      const seller = {
        seller_name: profile?.name?.trim() || email.split("@")[0] || "Privat",
        seller_type: profile?.type ?? "PRIVAT",
      };
      const row = { ...draftToRow(d), ...seller, ...(status ? { status } : {}) };
      if (d.id) {
        const { error } = await supabase.from("listings").update(row).eq("id", d.id);
        if (error) {
          setSave({ state: "error", error: error.message });
          return false;
        }
        if (status) setDraft((x) => ({ ...x, status }));
      } else {
        const slug = d.slug ?? newSlug(d.vehicle!.brand, d.vehicle!.model);
        const { data, error } = await supabase
          .from("listings")
          .insert({ ...row, slug, owner: userId, status: status ?? "ENTWURF" })
          .select("id,slug,status,created_at")
          .single();
        if (error || !data) {
          setSave({ state: "error", error: error?.message });
          return false;
        }
        setDraft((x) => ({ ...x, id: data.id, slug: data.slug, status: data.status, createdAt: data.created_at }));
        clearLocal();
        const url = new URL(location.href);
        url.search = `?id=${data.id}`;
        history.replaceState(null, "", url);
      }
      setSave({ state: "saved", at: new Date() });
      return true;
    },
    [userId, email, profile],
  );

  const go = async (to: number) => {
    if (to > step && !STEP_VALID[step](draft)) return;
    // Leaving the checklist: what is not ticked is not there.
    if (step === 3 && to > step) {
      const eq = { ...ref.current.equipment };
      for (const it of EQUIPMENT_ITEMS) if (eq[it.key] === undefined) eq[it.key] = false;
      ref.current = { ...ref.current, equipment: eq };
      setDraft(ref.current);
    }
    await persist();
    setStep(to);
    setReached((r) => Math.max(r, to));
    top.current?.scrollIntoView({ block: "start" });
  };

  // Photos save right away once the row exists — the files are already up.
  const setPhotos = (photos: string[]) => {
    ref.current = { ...ref.current, photos };
    setDraft(ref.current);
    if (ref.current.id) void persist();
  };

  const publish = async () => {
    const live = draft.status === "AKTIV" || draft.status === "RESERVIERT";
    const ok = await persist(live ? undefined : "AKTIV");
    if (ok) {
      await refreshListings();
      setPublished(true);
      top.current?.scrollIntoView({ block: "start" });
    }
  };

  const restart = () => {
    clearLocal();
    setDraft(EMPTY_DRAFT);
    setStep(0);
    setReached(0);
    setRestored(false);
  };

  const quality = useMemo(() => listingQuality(draftQuality(draft)), [draft]);

  if (loading) return <Frame><div className="h-96 animate-pulse rounded-card bg-surface2" aria-busy="true" /></Frame>;
  if (notFound) {
    return (
      <Frame>
        <Notice tone="danger">
          Dieses Inserat gibt es nicht, oder es gehört zu einem anderen Konto.{" "}
          <a href={href("/konto/inserate")} className="font-semibold underline">
            Zu meinen Inseraten
          </a>
        </Notice>
      </Frame>
    );
  }
  if (published) return <Published draft={draft} />;

  const title = draft.vehicle ? `${draft.vehicle.brand} ${draft.vehicle.model}` : "Neues Inserat";
  const stepOk = STEP_VALID[step](draft);
  const last = step === STEPS.length - 1;

  return (
    <div ref={top} className="mx-auto max-w-page scroll-mt-20 px-4 pb-32 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            {editing ? `${STATUS_LABEL[draft.status]} bearbeiten` : "Inserat aufgeben"} · Schritt {step + 1} von {STEPS.length}
          </p>
          <h1 className="mt-1 truncate text-h2 font-bold text-fg sm:text-display">{title}</h1>
        </div>
        <SaveIndicator save={save} persisted={editing} />
      </div>
      <div className="mt-5">
        <Stepper steps={STEPS} current={step} reachable={reached} onSelect={(i) => void go(i)} />
      </div>
      {restored && (
        <Notice className="mt-4">
          Wir haben deinen angefangenen Entwurf wiederhergestellt.{" "}
          <button type="button" onClick={restart} className="font-semibold underline">
            Neu beginnen
          </button>
        </Notice>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="step-title" className="card min-w-0 p-5 sm:p-6">
          <h2 id="step-title" className="text-h2 font-bold text-fg">
            {STEPS[step]}
          </h2>
          <div className="mt-5">
            {step === 0 && <VehicleStep draft={draft} patch={patch} pending={pending} clearPending={() => setPending(null)} />}
            {step === 1 && <ConditionStep draft={draft} patch={patch} />}
            {step === 2 && <BatteryStep draft={draft} patch={patch} />}
            {step === 3 && <EquipmentStep draft={draft} patch={patch} />}
            {step === 4 && draft.slug && (
              <PhotoStep userId={userId} slug={draft.slug} photos={draft.photos} onChange={setPhotos} />
            )}
            {step === 5 && <PriceStep draft={draft} patch={patch} />}
            {step === 6 && <PreviewStep draft={draft} userId={userId} profile={profile} email={email} />}
          </div>
          {save.state === "error" && (
            <Notice tone="danger" className="mt-5">
              Speichern hat nicht geklappt{save.error ? `: ${save.error}` : ""}. Deine Eingaben sind auf diesem Gerät
              gesichert — bitte nochmals versuchen.
            </Notice>
          )}
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <QualityMeter score={quality.score} next={quality.next} />
            <p className="mt-3 text-micro text-fg3">
              Jeder Punkt beantwortet eine Frage, die Käufer sonst per Nachricht stellen.
            </p>
          </div>
        </aside>
      </div>

      {/* Navigation — fixed at the bottom on every screen size. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-page items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={() => void go(step - 1)} disabled={step === 0}>
            Zurück
          </Button>
          {!stepOk && <p className="hidden text-small text-fg3 sm:block">{MISSING[step]}</p>}
          {last ? (
            <div className="flex gap-2">
              {draft.status === "ENTWURF" && (
                <Button onClick={() => void persist()} disabled={!canPersist(draft) || save.state === "saving"}>
                  Entwurf speichern
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => void publish()}
                disabled={!canPublish(draft) || save.state === "saving"}
                title={canPublish(draft) ? undefined : "Für die Veröffentlichung fehlen noch Angaben oder ein Foto"}
              >
                {draft.status === "AKTIV" || draft.status === "RESERVIERT" ? "Änderungen speichern" : "Veröffentlichen"}
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => void go(step + 1)} disabled={!stepOk}>
              Weiter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const MISSING = [
  "Marke, Modell und Variante wählen",
  "Jahrgang, km-Stand und PLZ fehlen",
  "Den Batteriezustand (SOH) angeben",
  "",
  "",
  "Den Preis angeben",
  "",
];

function SaveIndicator({ save, persisted }: { save: { state: SaveState; at?: Date }; persisted: boolean }) {
  if (save.state === "saving") return <span className="text-small text-fg3">Speichert…</span>;
  if (save.state === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-small text-danger">
        <CloudOff size={15} aria-hidden /> Nicht gespeichert
      </span>
    );
  if (!persisted)
    return (
      <span className="inline-flex items-center gap-1.5 text-small text-fg3" title="Wird zum Entwurf in deinem Konto, sobald der Preis steht">
        <Cloud size={15} aria-hidden /> Auf diesem Gerät gesichert
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-small text-fg3">
      <Check size={15} aria-hidden className="text-accent" />
      Gespeichert{save.at ? ` ${save.at.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}` : ""}
    </span>
  );
}

type StepProps = { draft: Draft; patch: (p: Partial<Draft>) => void };

/* ---------- 1 Fahrzeug ----------------------------------------------------- */

const sameVehicle = (v: Vehicle | null, p: VehiclePick) =>
  Boolean(v) &&
  v!.brand === p.brand &&
  v!.model === p.model &&
  v!.variant === p.variant &&
  v!.variantId === (p.catalogVariant?.id ?? null);

function vehicleFromPick(p: VehiclePick): Vehicle {
  return {
    brand: p.brand,
    model: p.model,
    variant: p.variant,
    modelId: p.catalogModel?.id ?? null,
    variantId: p.catalogVariant?.id ?? null,
    embed: p.catalogVariant,
    modelSlug: p.catalogModel?.slug ?? null,
    launchYear: p.catalogModel?.launch_year ?? null,
    endYear: p.catalogModel?.end_year ?? null,
    warranty: catalogWarranty(p.catalogVariant),
  };
}

function VehicleStep({
  draft,
  patch,
  pending,
  clearPending,
}: StepProps & { pending: { marke: string; modell: string; variante: string } | null; clearPending: () => void }) {
  const [changing, setChanging] = useState(!draft.vehicle);
  const pick = useVehiclePick(draft.choice);
  const sel = useVehicleSelection(pending ?? { marke: "", modell: "", variante: "" }, Boolean(pending));

  // Prefill from the Preis-Check (`?marke&modell&variante`).
  useEffect(() => {
    if (!pending || sel.status !== "ready") return;
    if (!sel.brand) return clearPending();
    const choice: VehicleChoice = { ...EMPTY_CHOICE, brandId: sel.brand.id, modelId: sel.model?.id ?? "" };
    if (pending.variante && sel.model) {
      if (sel.variantStatus !== "ready") return;
      choice.variantId = sel.variant?.id ?? "";
    }
    patch({ choice });
    clearPending();
  }, [pending, sel.status, sel.brand, sel.model, sel.variant, sel.variantStatus, patch, clearPending]);

  // A complete pick becomes the vehicle — with fresh catalog values.
  useEffect(() => {
    if (!changing || !pick.complete || sameVehicle(draft.vehicle, pick)) return;
    const vehicle = vehicleFromPick(pick);
    patch({
      vehicle,
      specs: listingSpecs(pick.catalogModel, pick.catalogVariant),
      slug: draft.slug ?? newSlug(vehicle.brand, vehicle.model),
    });
  }, [changing, pick, draft.vehicle, draft.slug, patch]);

  const v = draft.vehicle;
  return (
    <div className="space-y-6">
      {changing || !v ? (
        <VehiclePicker value={draft.choice} onChange={(choice) => patch({ choice })} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface2 px-4 py-3">
          <div>
            <p className="text-h3 font-bold text-fg">
              {v.brand} {v.model}
            </p>
            <p className="text-small text-fg2">{v.variant || "Variante nicht angegeben"}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              patch({ choice: EMPTY_CHOICE });
              setChanging(true);
            }}
          >
            Anderes Fahrzeug
          </Button>
        </div>
      )}
      {v && draft.specs && <SpecsEditor draft={draft} patch={patch} />}
    </div>
  );
}

type NumSpec = {
  key: Exclude<keyof ListingSpecs, "segment" | "bidi">;
  label: string;
  unit?: string;
  min: number;
  max: number;
  optional?: boolean;
  dec?: boolean;
  hint?: string;
};

const SPEC_FIELDS: NumSpec[] = [
  { key: "range_km", label: "WLTP-Reichweite", unit: "km", min: 50, max: 1200 },
  { key: "consumption", label: "Verbrauch", unit: "kWh/100 km", min: 4, max: 40, dec: true },
  { key: "battery_kwh", label: "Batterie netto", unit: "kWh", min: 4, max: 250, dec: true },
  { key: "dc_kw", label: "DC-Ladeleistung", unit: "kW", min: 10, max: 1500, optional: true, hint: "Leer, wenn das Auto nicht schnellladen kann." },
  { key: "charge_min", label: "Laden 10–80 %", unit: "min", min: 5, max: 180, optional: true },
  { key: "seats", label: "Sitze", min: 1, max: 9 },
  {
    key: "weight_kg",
    label: "Leergewicht",
    unit: "kg",
    min: 300,
    max: 4000,
    optional: true,
    hint: `Für die Verkehrssteuer. Ohne Angabe rechnen wir mit ${fmtCH(REF_WEIGHT_KG)} kg.`,
  },
  { key: "price_new", label: "Neupreis", unit: "CHF", min: 1000, max: 3_000_000, optional: true },
];

function SpecsEditor({ draft, patch }: StepProps) {
  const s = draft.specs!;
  const placeholders = !draft.vehicle?.variantId;
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, s[f.key] === null ? "" : String(s[f.key])])),
  );
  // New vehicle → new catalog values in the fields.
  useEffect(() => {
    setText(Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, s[f.key] === null ? "" : String(s[f.key])])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.vehicle?.variantId, draft.vehicle?.model]);

  const bad = (f: NumSpec) => {
    const raw = (text[f.key] ?? "").trim();
    if (raw === "") return !f.optional;
    const n = Number(raw.replace(",", "."));
    return !Number.isFinite(n) || n < f.min || n > f.max;
  };

  const setField = (f: NumSpec, raw: string) => {
    const clean = raw.replace(f.dec ? /[^0-9.,]/g : /\D/g, "");
    const t = { ...text, [f.key]: clean };
    setText(t);
    const n = Number(clean.replace(",", "."));
    const ok = clean === "" ? f.optional : Number.isFinite(n) && n >= f.min && n <= f.max;
    // Only valid values reach the draft; invalid ones keep the last good one.
    if (ok) patch({ specs: { ...s, [f.key]: clean === "" ? null : n } });
  };

  return (
    <Disclosure
      open={placeholders}
      summary={
        <span className="flex flex-wrap items-center gap-2">
          Technische Daten
          {placeholders ? <Badge tone="caution">bitte prüfen</Badge> : <Badge tone="positive">aus dem Katalog</Badge>}
        </span>
      }
    >
      {placeholders && (
        <Notice tone="caution" className="mb-4">
          Ohne Variante aus dem Katalog stehen hier Platzhalter. Trag die Werte aus Fahrzeugausweis oder Prospekt ein —
          damit rechnen die Kosten auf deinem Inserat.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Karosserie">
          <Select value={s.segment} onChange={(e) => patch({ specs: { ...s, segment: e.target.value as Segment } })}>
            {(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => (
              <option key={k} value={k}>
                {SEGMENT_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        {SPEC_FIELDS.map((f) => (
          <Field key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label} hint={bad(f) ? `Zwischen ${fmtCH(f.min)} und ${fmtCH(f.max)}` : f.hint} optional={f.optional}>
            <input
              value={text[f.key] ?? ""}
              onChange={(e) => setField(f, e.target.value)}
              inputMode={f.dec ? "decimal" : "numeric"}
              aria-invalid={bad(f) || undefined}
              className={`field tabular ${bad(f) ? "border-caution" : ""}`}
            />
          </Field>
        ))}
        <div className="self-end pb-2">
          <Toggle label="Kann Strom abgeben (V2L/V2H)" checked={s.bidi} onChange={(bidi) => patch({ specs: { ...s, bidi } })} />
        </div>
      </div>
    </Disclosure>
  );
}

/* ---------- 2 Zustand ------------------------------------------------------ */

const digits = (s: string, n?: number) => s.replace(/\D/g, "").slice(0, n);

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-small font-semibold text-fg2">{label}</span>
      <Segmented
        label={label}
        value={value === null ? "na" : value ? "ja" : "nein"}
        onChange={(k) => onChange(k === "na" ? null : k === "ja")}
        options={[
          { key: "ja", label: "Ja" },
          { key: "nein", label: "Nein" },
          { key: "na", label: "Keine Angabe" },
        ]}
      />
    </div>
  );
}

function ConditionStep({ draft, patch }: StepProps) {
  const resolve = usePlzResolver(true);
  const hit = draft.plz.length === 4 && resolve ? resolve(draft.plz) : null;
  const v = draft.vehicle;
  const yearWarn =
    v && draft.year.length === 4
      ? yearHint({ name: v.model, launch_year: v.launchYear, end_year: v.endYear }, Number(draft.year))
      : null;

  // Four digits that resolve set the place: «4600 Olten». Until the PLZ map
  // has loaded, a stored place stays as it is.
  useEffect(() => {
    if (!resolve) return;
    const next = hit && !hit.estimated ? `${hit.zip} ${hit.name}` : "";
    if (next !== draft.ort) patch({ ort: next });
  }, [resolve, hit, draft.ort, patch]);

  const monthMax = new Date().toISOString().slice(0, 7);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Jahrgang (1. Inverkehrsetzung)" hint={yearWarn ?? undefined}>
        <input
          value={draft.year}
          onChange={(e) => patch({ year: digits(e.target.value, 4) })}
          inputMode="numeric"
          placeholder="2022"
          aria-invalid={(draft.year.length === 4 && !valid.year(draft)) || undefined}
          className="field tabular"
        />
      </Field>
      <Field label="Kilometerstand">
        <input
          value={draft.km}
          onChange={(e) => patch({ km: digits(e.target.value, 7) })}
          inputMode="numeric"
          placeholder="42000"
          className="field tabular"
        />
      </Field>
      <Field
        label="Standort (PLZ)"
        hint={
          hit && !hit.estimated
            ? `${hit.zip} ${hit.name} · Kanton ${hit.canton}`
            : draft.plz.length === 4 && resolve
              ? "Keine Schweizer PLZ — bitte prüfen."
              : "Wo Käufer das Auto ansehen können."
        }
      >
        <input
          value={draft.plz}
          onChange={(e) => patch({ plz: digits(e.target.value, 4) })}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="4600"
          className="field tabular"
        />
      </Field>
      <Field label="Letzte MFK" optional hint="Monat und Jahr der letzten Motorfahrzeugkontrolle.">
        <input type="month" value={draft.mfk} max={monthMax} onChange={(e) => patch({ mfk: e.target.value })} className="field tabular" />
      </Field>
      <YesNo label="Unfallfrei" value={draft.accidentFree} onChange={(accidentFree) => patch({ accidentFree })} />
      <YesNo label="Serviceheft gepflegt" value={draft.serviceBook} onChange={(serviceBook) => patch({ serviceBook })} />
      <Field label="Anzahl Vorbesitzer" optional hint={valid.owners(draft) ? "Inklusive dir." : "Zwischen 1 und 20."}>
        <input
          value={draft.owners}
          onChange={(e) => patch({ owners: digits(e.target.value, 2) })}
          inputMode="numeric"
          placeholder="1"
          className="field tabular"
        />
      </Field>
      <Field label="Werksgarantie (Fahrzeug) bis" optional hint="Nicht die Batteriegarantie — die kommt im nächsten Schritt.">
        <input type="month" value={draft.warrantyUntil} onChange={(e) => patch({ warrantyUntil: e.target.value })} className="field tabular" />
      </Field>
    </div>
  );
}

/* ---------- 3 Batterie ----------------------------------------------------- */

function BatteryStep({ draft, patch }: StepProps) {
  const w = draft.vehicle?.warranty;
  const year = Number(draft.year);
  const until = w && year ? year + w.years : null;
  const expired = until !== null && until < new Date().getFullYear();

  return (
    <div className="space-y-6">
      <Field
        label="Batteriezustand (SOH) in %"
        hint="Im Bordcomputer, in der App des Herstellers oder im Batteriebericht der Garage. Käufer fragen fast immer danach."
      >
        <input
          value={draft.soh}
          onChange={(e) => patch({ soh: digits(e.target.value, 3) })}
          inputMode="numeric"
          placeholder="94"
          aria-invalid={(draft.soh !== "" && !valid.soh(draft)) || undefined}
          className="field max-w-40 tabular"
        />
      </Field>
      {draft.soh !== "" && !valid.soh(draft) && <p className="-mt-4 text-small text-caution">Plausibel sind 50 bis 100 %.</p>}

      <div className="border-t border-line pt-5">
        <h3 className="text-h3 font-bold text-fg">Batteriegarantie</h3>
        <p className="mt-1 max-w-prose text-body text-fg2">
          Wie lange ist die Batterie noch abgesichert? Steht in den Garantieunterlagen oder im Serviceheft. Alles
          optional — aber die zweitwichtigste Frage nach dem SOH.
        </p>
        {w && (
          <div className="mt-3 rounded-card bg-surface2 px-4 py-3 text-small text-fg2">
            Laut Hersteller: {w.conditional ? "bis " : ""}
            {w.years} Jahre{w.km ? ` / ${fmtCH(w.km)} km` : ""}
            {w.soh ? `, mindestens ${w.soh} % Kapazität` : ""}
            {w.conditional && " (unter Bedingungen, z. B. Service beim Markenhändler)"}.
            {until && (
              <>
                {" "}
                {expired ? `Bei Jahrgang ${year} wohl abgelaufen.` : `Bei Jahrgang ${year} also etwa bis ${until}.`}
                {!expired && !draft.bwUntil && (
                  <button
                    type="button"
                    className="ml-1 font-semibold text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      patch({
                        bwUntil: `${until}-01`,
                        bwKm: w.km ? String(w.km) : draft.bwKm,
                        bwSoh: w.soh ? String(w.soh) : draft.bwSoh,
                      })
                    }
                  >
                    Übernehmen
                  </button>
                )}
              </>
            )}
            {until && !expired && <span className="block text-micro text-fg3">Den genauen Monat findest du in den Unterlagen.</span>}
          </div>
        )}
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Field label="Gültig bis" optional>
            <input type="month" value={draft.bwUntil} onChange={(e) => patch({ bwUntil: e.target.value })} className="field tabular" />
          </Field>
          <Field label="Bis km-Stand" optional hint={valid.bwKm(draft) ? undefined : "Mindestens 1'000 km"}>
            <input
              value={draft.bwKm}
              onChange={(e) => patch({ bwKm: digits(e.target.value, 7) })}
              inputMode="numeric"
              placeholder="160000"
              className="field tabular"
            />
          </Field>
          <Field label="Garantierte Kapazität (%)" optional hint={valid.bwSoh(draft) ? undefined : "Zwischen 50 und 100 %"}>
            <input
              value={draft.bwSoh}
              onChange={(e) => patch({ bwSoh: digits(e.target.value, 3) })}
              inputMode="numeric"
              placeholder="70"
              className="field tabular"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ---------- 4 Ausstattung -------------------------------------------------- */

function EquipmentStep({ draft, patch }: StepProps) {
  return (
    <div>
      <p className="max-w-prose text-body text-fg2">Was hat dein Auto? Was du nicht ankreuzt, zeigen wir als «nicht vorhanden».</p>
      <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
        {EQUIPMENT_ITEMS.map((it) => (
          <CheckRow
            key={it.key}
            label={it.label}
            checked={draft.equipment[it.key] === true}
            onChange={(v) => patch({ equipment: { ...draft.equipment, [it.key]: v } })}
          />
        ))}
      </div>
      <div className="mt-5 max-w-xs">
        <Field label="Farbe" optional>
          <input
            value={draft.equipment.color ?? ""}
            onChange={(e) => patch({ equipment: { ...draft.equipment, color: e.target.value.slice(0, 40) } })}
            placeholder="Pearl White"
            className="field"
          />
        </Field>
      </div>
    </div>
  );
}

/* ---------- 6 Preis -------------------------------------------------------- */

function PriceStep({ draft, patch }: StepProps) {
  const { listings } = useListings();
  const v = draft.vehicle;
  const estimate = useMemo(
    () =>
      v
        ? estimatePrice(listings, {
            modelSlug: v.modelSlug,
            brand: v.brand,
            model: v.model,
            year: Number(draft.year),
            km: Number(draft.km),
            soh: Number(draft.soh) || null,
            priceNew: draft.specs?.price_new ?? null,
            excludeId: draft.slug ?? undefined,
          })
        : null,
    [listings, v, draft.year, draft.km, draft.soh, draft.specs?.price_new, draft.slug],
  );

  return (
    <div className="space-y-6">
      {estimate ? (
        <div className="rounded-card bg-soft p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-accent">
            <Tag size={15} aria-hidden /> Preis-Check
          </p>
          <p className="mt-1 text-h2 font-bold text-fg tabular">
            CHF {fmtCH(estimate.low)} – {fmtCH(estimate.high)}
          </p>
          <p className="mt-1 text-small text-fg2">{PRICE_METHOD[estimate.method]}</p>
          {estimate.method === "inserate" && (
            <p className="mt-1 text-small text-fg2">{estimate.comparables.length} vergleichbare Inserate.</p>
          )}
          <Button size="sm" className="mt-3" onClick={() => patch({ price: String(estimate.mid) })}>
            CHF {fmtCH(estimate.mid)} übernehmen
          </Button>
        </div>
      ) : (
        <Notice>Für dieses Auto haben wir noch zu wenige Vergleichswerte für einen Preisvorschlag.</Notice>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Preis in CHF">
          <input
            value={draft.price}
            onChange={(e) => patch({ price: digits(e.target.value, 7) })}
            inputMode="numeric"
            placeholder="29900"
            className="field text-h3 font-bold tabular"
          />
        </Field>
        <div className="self-end pb-2">
          <Toggle label="Verhandlungsbasis" hint="Zeigt «VB» neben dem Preis." checked={draft.negotiable} onChange={(negotiable) => patch({ negotiable })} />
        </div>
      </div>

      <Field
        label="Beschreibung"
        hint={`${draft.note.trim().length} / ${NOTE_MAX} Zeichen${draft.note.trim().length < 150 ? " — ab 150 Zeichen zählt sie für die Qualität" : ""}`}
      >
        <textarea
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value.slice(0, NOTE_MAX) })}
          rows={6}
          placeholder="Erstbesitz, Service lückenlos bei der Vertretung, Winterräder auf Felgen, Grund für den Verkauf…"
          className="field resize-y py-2.5"
        />
      </Field>
    </div>
  );
}

/* ---------- 7 Vorschau ----------------------------------------------------- */

function PreviewStep({ draft, userId, profile, email }: { draft: Draft; userId: string; profile: Profile | null; email: string }) {
  const listing = useMemo(() => {
    if (!canPersist(draft)) return null;
    const row = {
      ...draftToRow(draft),
      id: draft.id ?? "vorschau",
      owner: userId,
      is_demo: false,
      slug: draft.slug ?? "vorschau",
      status: "AKTIV",
      seller_name: profile?.name?.trim() || email.split("@")[0],
      seller_type: profile?.type ?? "PRIVAT",
      created_at: draft.createdAt ?? new Date().toISOString(),
      hidden_at: null,
      catalog_model: draft.vehicle?.modelSlug ? { slug: draft.vehicle.modelSlug } : null,
      catalog_variant: draft.vehicle?.embed ?? null,
      price_history: [],
      seller_profile: { slug: profile?.slug ?? null, verified: profile?.verified ?? false },
    } as ListingRow;
    return rowToListing(row);
  }, [draft, userId, profile, email]);

  const missing = [
    !valid.vehicle(draft) && "Fahrzeug",
    !(valid.year(draft) && valid.km(draft) && valid.ort(draft)) && "Jahrgang, km-Stand oder PLZ",
    !valid.soh(draft) && "Batteriezustand",
    !valid.price(draft) && "Preis",
    draft.photos.length === 0 && "mindestens ein Foto",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-small font-semibold text-fg2">So sehen Käufer dein Inserat in der Liste</p>
        {listing ? (
          <div inert className="pointer-events-none">
            <ListingCard listing={listing} />
          </div>
        ) : (
          <div className="grid aspect-4/5 place-items-center rounded-card border border-dashed border-line2 p-6 text-center text-small text-fg3">
            Die Vorschau erscheint, sobald die Pflichtangaben stehen.
          </div>
        )}
      </div>
      <div className="space-y-4">
        {missing.length > 0 ? (
          <Notice tone="caution">Für die Veröffentlichung fehlt noch: {missing.join(", ")}.</Notice>
        ) : (
          <Notice tone="success">Alles da. Mit «Veröffentlichen» ist dein Auto sofort online.</Notice>
        )}
        <div className="rounded-card bg-surface2 p-4 text-small text-fg2">
          <p className="font-semibold text-fg">So melden sich Käufer</p>
          <p className="mt-1">
            Über das Postfach auf EV4U — deine E-Mail-Adresse sieht niemand. Neue Nachrichten melden wir dir per E-Mail
            ({email}).
          </p>
        </div>
        <p className="text-small text-fg3">
          Mit dem Veröffentlichen bestätigst du, dass die Angaben stimmen und du das Auto verkaufen darfst (
          <a href={href("/agb")} className="link" target="_blank" rel="noopener">
            Nutzungsbedingungen
          </a>
          ).
        </p>
      </div>
    </div>
  );
}

/* ---------- Fertig --------------------------------------------------------- */

function Published({ draft }: { draft: Draft }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <CheckCircle2 size={40} aria-hidden className="mx-auto text-accent" />
      <h1 className="mt-4 text-display font-bold text-fg">Dein Inserat ist online.</h1>
      <p className="mt-2 text-body text-fg2">
        Käufer finden es ab sofort in der Suche. Anfragen landen in deinem Postfach — wir melden uns per E-Mail.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton href={href(`/inserat/${draft.slug}`)} variant="primary">
          Inserat ansehen
        </LinkButton>
        <LinkButton href={href("/konto/inserate")}>Meine Inserate</LinkButton>
      </div>
    </div>
  );
}
