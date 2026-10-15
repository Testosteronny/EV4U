import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Compass, Search } from "lucide-react";
import VehicleFilter, { type VehicleFilterValue } from "./VehicleFilter";
import { CheckRow, Chip, Field, Select } from "../ui";
import { FahrprofilLink } from "../layout/Fahrprofil";
import {
  DC_STEPS,
  KM_STEPS,
  MONTHLY_STEPS,
  PRICE_STEPS,
  RADIUS_STEPS,
  RANGE_STEPS,
  SEAT_STEPS,
  SEGMENTS,
  SOH_STEPS,
  TRUNK_STEPS,
  YEAR_STEPS,
  isActive,
  type FilterKey,
  type Filters,
} from "../../lib/filters";
import { href } from "../../lib/url";
import { VIDEOS_ENABLED } from "../../lib/video";
import { SEGMENT_LABEL } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   FilterSidebar (Konzept §4.2) — always visible on desktop, a drawer on the
   phone. Every option shows how many listings it would leave, with all
   OTHER filters kept (facet counts). Groups open by default when one of
   their filters is set, so the whole state is visible at a glance.
   ============================================================================ */

export type FacetCount = <K extends FilterKey>(key: K, value: Filters[K]) => number;

type Props = {
  f: Filters;
  set: (patch: Partial<Filters>) => void;
  count: FacetCount;
  stockBrands: string[];
  /** PLZ the radius is measured from — from the URL or the Fahrprofil. */
  origin: { zip: string; name: string } | null;
  /** Sets `plz=` in the URL (a radius search without a Fahrprofil). */
  setOriginPlz: (plz: string) => void;
};

const GROUPS: { title: string; keys: FilterKey[] }[] = [
  { title: "Fahrzeug", keys: ["marke", "modell", "variante", "seg", "sitze"] },
  { title: "Preis & Kosten", keys: ["preis", "preisvon", "betrieb"] },
  { title: "Zustand", keys: ["jahr", "km", "unfallfrei", "video"] },
  { title: "Batterie & Reichweite", keys: ["reichweite", "soh", "garantie"] },
  { title: "Laden", keys: ["laden", "v800", "ac22", "v2l"] },
  { title: "Alltag", keys: ["ahk", "allrad", "waermepumpe", "kofferraum"] },
  { title: "Anbieter & Ort", keys: ["anbieter", "umkreis"] },
];

function FilterGroup({
  title,
  active,
  defaultOpen,
  children,
}: {
  title: string;
  active: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-line py-3 first:border-t-0" open={defaultOpen || active > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 [&::-webkit-details-marker]:hidden">
        <span className="text-body font-bold text-fg">
          {title}
          {active > 0 && (
            <span className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-micro font-bold text-on-accent tabular">
              {active}
            </span>
          )}
        </span>
        <ChevronDown size={16} aria-hidden className="text-fg3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/** A number filter as a select: "egal" plus steps, each with its count. */
function StepSelect<K extends FilterKey>({
  label,
  k,
  steps,
  format,
  f,
  set,
  count,
  any = "Egal",
}: {
  label: string;
  k: K;
  steps: number[];
  format: (n: number) => string;
  f: Filters;
  set: Props["set"];
  count: FacetCount;
  any?: string;
}) {
  const value = f[k] as number;
  return (
    <Field label={label}>
      <Select
        value={String(value)}
        onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<Filters>)}
      >
        <option value="0">{any}</option>
        {steps.map((s) => {
          const n = count(k, s as Filters[K]);
          return (
            <option key={s} value={s} disabled={n === 0 && s !== value}>
              {format(s)} ({n})
            </option>
          );
        })}
      </Select>
    </Field>
  );
}

function Check<K extends FilterKey>({
  k,
  label,
  f,
  set,
  count,
}: {
  k: K;
  label: string;
  f: Filters;
  set: Props["set"];
  count: FacetCount;
}) {
  const on = f[k] === true;
  const n = count(k, true as Filters[K]);
  return (
    <CheckRow
      checked={on}
      onChange={(v) => set({ [k]: v } as Partial<Filters>)}
      label={label}
      count={n}
      disabled={!on && n === 0}
    />
  );
}

/** Keyword field: writes the URL after a short pause, not on every key. */
function KeywordField({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onCommit(draft.trim()), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return (
    <div className="relative">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Stichwort, z. B. Wärmepumpe"
        aria-label="Stichwort"
        className="field pl-9"
      />
    </div>
  );
}

function PlzField({ origin, onSet }: { origin: Props["origin"]; onSet: (plz: string) => void }) {
  const [plz, setPlz] = useState(origin?.zip ?? "");
  useEffect(() => setPlz(origin?.zip ?? ""), [origin?.zip]);
  return (
    <Field label="Ort (PLZ)" hint={origin ? `Gemessen ab ${origin.zip} ${origin.name}, Luftlinie.` : "Ohne PLZ kein Umkreis."}>
      <input
        value={plz}
        inputMode="numeric"
        placeholder="z. B. 8004"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPlz(v);
          if (v.length === 4 || v.length === 0) onSet(v);
        }}
        className="field tabular"
        aria-label="Postleitzahl für den Umkreis"
      />
    </Field>
  );
}

export default function FilterSidebar({ f, set, count, stockBrands, origin, setOriginPlz }: Props) {
  const activeIn = (keys: FilterKey[]) => keys.filter((k) => isActive(f, k)).length;
  const vehicle: VehicleFilterValue = { marke: f.marke, modell: f.modell, variante: f.variante };
  const chf = (n: number) => `CHF ${fmtCH(n)}`;

  return (
    <div>
      <KeywordField value={f.q} onCommit={(q) => set({ q })} />

      <div className="mt-3">
        {GROUPS.map((g, gi) => (
          <FilterGroup key={g.title} title={g.title} active={activeIn(g.keys)} defaultOpen={gi < 2}>
            {g.title === "Fahrzeug" && (
              <>
                <VehicleFilter
                  value={vehicle}
                  onChange={(v) => set({ marke: v.marke, modell: v.modell, variante: v.variante })}
                  count={(key, val) => count(key, val)}
                  stockBrands={stockBrands}
                />
                <div>
                  <span className="mb-1.5 block text-small font-semibold text-fg2">Karosserie</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SEGMENTS.map((s) => (
                      <Chip
                        key={s}
                        active={f.seg === s}
                        count={count("seg", s)}
                        onClick={() => set({ seg: f.seg === s ? "" : s })}
                      >
                        {SEGMENT_LABEL[s]}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-small font-semibold text-fg2">Sitze</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SEAT_STEPS.map((s) => (
                      <Chip
                        key={s}
                        active={f.sitze === s}
                        count={count("sitze", s)}
                        onClick={() => set({ sitze: f.sitze === s ? 0 : s })}
                      >
                        ab {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}

            {g.title === "Preis & Kosten" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StepSelect label="Preis von" k="preisvon" steps={PRICE_STEPS} format={chf} any="Egal" f={f} set={set} count={count} />
                  <StepSelect label="bis" k="preis" steps={PRICE_STEPS} format={chf} any="Egal" f={f} set={set} count={count} />
                </div>
                <StepSelect
                  label="Betrieb pro Monat bis"
                  k="betrieb"
                  steps={MONTHLY_STEPS}
                  format={(n) => `${chf(n)}/Mt.`}
                  f={f}
                  set={set}
                  count={count}
                />
                <p className="text-small text-fg3">
                  Strom, Wartung und Verkehrssteuer — gerechnet mit deinem Fahrprofil. <FahrprofilLink />
                </p>
              </>
            )}

            {g.title === "Zustand" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StepSelect label="Jahrgang ab" k="jahr" steps={YEAR_STEPS} format={String} f={f} set={set} count={count} />
                  <StepSelect label="km bis" k="km" steps={KM_STEPS} format={(n) => fmtCH(n)} f={f} set={set} count={count} />
                </div>
                <Check k="unfallfrei" label="Unfallfrei" f={f} set={set} count={count} />
                {VIDEOS_ENABLED && <Check k="video" label="Mit Video-Rundgang" f={f} set={set} count={count} />}
              </>
            )}

            {g.title === "Batterie & Reichweite" && (
              <>
                <StepSelect
                  label="Reichweite (WLTP) ab"
                  k="reichweite"
                  steps={RANGE_STEPS}
                  format={(n) => `${n} km`}
                  f={f}
                  set={set}
                  count={count}
                />
                <div>
                  <span className="mb-1.5 block text-small font-semibold text-fg2">Batteriezustand (SOH) ab</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SOH_STEPS.map((s) => (
                      <Chip key={s} active={f.soh === s} count={count("soh", s)} onClick={() => set({ soh: f.soh === s ? 0 : s })}>
                        {s} %
                      </Chip>
                    ))}
                  </div>
                </div>
                <Check k="garantie" label="Batteriegarantie aktiv" f={f} set={set} count={count} />
              </>
            )}

            {g.title === "Laden" && (
              <>
                <StepSelect label="Schnellladen (DC) ab" k="laden" steps={DC_STEPS} format={(n) => `${n} kW`} f={f} set={set} count={count} />
                <Check k="v800" label="800-Volt-Technik" f={f} set={set} count={count} />
                <Check k="ac22" label="Lädt mit 22 kW AC" f={f} set={set} count={count} />
                <Check k="v2l" label="Strom zurückgeben (V2L)" f={f} set={set} count={count} />
              </>
            )}

            {g.title === "Alltag" && (
              <>
                <Check k="ahk" label="Anhängerkupplung" f={f} set={set} count={count} />
                <Check k="allrad" label="Allrad" f={f} set={set} count={count} />
                <Check k="waermepumpe" label="Wärmepumpe" f={f} set={set} count={count} />
                <StepSelect label="Kofferraum ab" k="kofferraum" steps={TRUNK_STEPS} format={(n) => `${n} Liter`} f={f} set={set} count={count} />
              </>
            )}

            {g.title === "Anbieter & Ort" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(["PRIVAT", "GARAGE"] as const).map((a) => (
                    <Chip
                      key={a}
                      active={f.anbieter === a}
                      count={count("anbieter", a)}
                      onClick={() => set({ anbieter: f.anbieter === a ? "" : a })}
                    >
                      {a === "PRIVAT" ? "Privat" : "Garage"}
                    </Chip>
                  ))}
                </div>
                <PlzField origin={origin} onSet={setOriginPlz} />
                {origin && (
                  <StepSelect label="Umkreis" k="umkreis" steps={RADIUS_STEPS} format={(n) => `${n} km`} any="Ganze Schweiz" f={f} set={set} count={count} />
                )}
              </>
            )}
          </FilterGroup>
        ))}
      </div>

      <a
        href={href("/finder")}
        className="tip mt-4 flex items-center gap-3 p-4 text-body font-semibold text-fg transition-colors hover:text-accent"
      >
        <Compass size={20} className="text-accent" aria-hidden />
        <span>
          Unsicher, was du suchst?
          <span className="block text-small font-normal text-fg2">Der E-Auto-Finder fragt sechs Dinge.</span>
        </span>
      </a>
    </div>
  );
}
