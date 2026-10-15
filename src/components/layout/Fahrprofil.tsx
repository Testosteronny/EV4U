import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { MapPin } from "lucide-react";
import { Badge, Button, ChipGroup, Field, Segmented, Sheet, Slider } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { usePlzResolver } from "../../hooks/usePlzResolver";
import { HOME_CHARGERS } from "../../lib/listingFacts";
import { $fahrprofilOpen, closeFahrprofil, openFahrprofil } from "../../stores/ui";
import { FUELS, PLUGIN_KWH_PER_100KM, type FuelType } from "../../utils/costModel";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH } from "../../utils/swiss";

/* ============================================================================
   Fahrprofil — the values every personal number on EV4U is computed with:
   PLZ (→ municipal tariff and canton), km per year, the car you drive today,
   how you would charge an EV (home charger, share on the road, solar).

   v3 replaces the sticky context bar with a chip in the header (Konzept
   §3.1). The sheet is the same one; it opens from the chip, from every
   «für dich →» link next to a number, and from /konto/einstellungen shows
   the same fields inline.
   ============================================================================ */

/** Header chip: «📍 4600 · 27.9 Rp.» — first visit: «PLZ für echte Kosten». */
export function FahrprofilChip({ compact = false }: { compact?: boolean }) {
  const { gemeinde, hydrated } = useCockpit();
  const set = hydrated && gemeinde;
  return (
    <button
      type="button"
      onClick={openFahrprofil}
      title="Fahrprofil: PLZ, km, heutiges Auto, Laden"
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-small font-semibold transition-colors ${
        set
          ? "border-line2 bg-surface text-fg hover:border-fg3"
          : "border-accent/40 bg-faint text-accent hover:border-accent"
      }`}
    >
      <MapPin size={14} aria-hidden className={set ? "text-fg3" : ""} />
      {set ? (
        <>
          <span className="tabular">{gemeinde.zip}</span>
          {!compact && (
            <span className="font-normal text-fg2 tabular">· {fmtCH(gemeinde.tariff * 100, 1)} Rp.</span>
          )}
        </>
      ) : (
        <span>{compact ? "PLZ" : "PLZ für echte Kosten"}</span>
      )}
    </button>
  );
}

/** Inline link next to a personal number: «für 4600 Olten» / «PLZ eingeben». */
export function FahrprofilLink({ className = "" }: { className?: string }) {
  const { gemeinde, hydrated } = useCockpit();
  return (
    <button type="button" onClick={openFahrprofil} className={`link text-small font-medium ${className}`}>
      {hydrated && gemeinde ? `für ${gemeinde.zip} ${gemeinde.name} →` : "mit deiner PLZ rechnen →"}
    </button>
  );
}

/** Mounted once per page (by the header); opens via $fahrprofilOpen. */
export function FahrprofilSheetHost() {
  const open = useStore($fahrprofilOpen);
  return open ? <FahrprofilSheet onClose={closeFahrprofil} /> : null;
}

function FahrprofilSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="Dein Fahrprofil"
      onClose={onClose}
      wide
      footer={
        <>
          <p className="text-micro text-fg3">Wird auf diesem Gerät gespeichert, mit Konto auf allen.</p>
          <Button variant="primary" onClick={onClose}>
            Fertig
          </Button>
        </>
      }
    >
      <FahrprofilForm />
    </Sheet>
  );
}

/** The fields themselves — in the sheet and on /konto/einstellungen. */
export function FahrprofilForm() {
  const {
    gemeinde,
    setGemeinde,
    tariff,
    annualKm,
    setAnnualKm,
    currentFuel,
    setCurrentFuel,
    currentCons,
    setCurrentCons,
    elecShare,
    setElecShare,
    publicShare,
    setPublicShare,
    pv,
    setPv,
    chargeKw,
    setChargeKw,
  } = useCockpit();

  // The field follows the stored PLZ until the visitor types — the stored
  // place can arrive a moment after mount (hydration, account sync).
  const [zip, setZip] = useState(gemeinde?.zip ?? "");
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && gemeinde?.zip) setZip(gemeinde.zip);
  }, [gemeinde?.zip]);

  // The PLZ map loads with the form; until it's there a complete PLZ is
  // "pending", not "invalid".
  const resolveZip = usePlzResolver();
  const hit = zip.length === 4 && resolveZip ? resolveZip(zip) : null;
  const invalid = zip.length === 4 && !!resolveZip && !hit;
  const fuelCfg = FUELS[currentFuel];
  const isPlugin = currentFuel === "PLUGIN";

  // Four valid digits set the tariff at once. Shortening does NOT reset:
  // the old value holds until a new one is valid; removing is explicit.
  useEffect(() => {
    if (hit && hit.zip !== gemeinde?.zip) setGemeinde(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, resolveZip]);

  return (
    <div className="space-y-7">
      <section>
        <h3 className="text-h3 font-bold text-fg">Wo du wohnst</h3>
        <p className="mt-0.5 text-small text-fg2">
          Bestimmt deinen Stromtarif, die kantonale Verkehrssteuer und die Entfernung zu jedem Auto.
        </p>
        <div className="mt-3">
          <Field label="Postleitzahl" hint={`Stromtarif: ElCom ${TARIFF_META.period}, Profil H4, exkl. MwSt.`}>
            <div className="relative">
              <MapPin
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3"
              />
              <input
                value={zip}
                onChange={(e) => {
                  touched.current = true;
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                placeholder="z. B. 4600"
                inputMode="numeric"
                autoComplete="postal-code"
                aria-label="Schweizer Postleitzahl"
                className="field pl-9 tabular"
              />
            </div>
          </Field>
        </div>

        {invalid && <p className="mt-2 text-small text-caution">Keine Schweizer PLZ — bitte prüfen.</p>}

        {gemeinde ? (
          <>
            <div className="tip mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-body font-semibold text-fg">{gemeinde.name}</div>
                <div className="text-small text-fg2">
                  {gemeinde.zip} · Kanton {gemeinde.canton}
                  {gemeinde.via && ` · Tarif von ${gemeinde.via}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gemeinde.estimated && <Badge tone="caution">geschätzt</Badge>}
                <span className="text-h3 font-bold text-accent tabular">
                  {fmtCH(gemeinde.tariff * 100, 1)}
                  <span className="ml-1 text-small font-normal text-fg2">Rp./kWh</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                touched.current = true;
                setZip("");
                setGemeinde(null);
              }}
              className="mt-2 text-small text-fg3 underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Standort entfernen
            </button>
          </>
        ) : (
          <p className="mt-3 text-small text-fg2">
            Ohne PLZ rechnen wir mit dem Schweizer Median{" "}
            <span className="tabular">{fmtCH(CH_AVG_TARIFF * 100, 1)}</span> Rp./kWh.
          </p>
        )}
      </section>

      <div className="h-px bg-line" />

      <Slider
        label="Jahresfahrleistung"
        value={annualKm}
        min={5000}
        max={40000}
        step={500}
        unit="km"
        onChange={setAnnualKm}
      />

      <div className="h-px bg-line" />

      <section>
        <h3 className="text-h3 font-bold text-fg">Dein Auto heute</h3>
        <p className="mt-0.5 text-small text-fg2">
          Der Massstab: jede Ersparnis auf EV4U wird gegen dieses Auto gerechnet.
        </p>
        <div className="mt-3">
          <ChipGroup
            label="Antrieb deines heutigen Autos"
            options={(Object.keys(FUELS) as FuelType[]).map((f) => ({
              key: f,
              label: FUELS[f].label,
              hint: FUELS[f].hint,
            }))}
            value={currentFuel}
            onChange={setCurrentFuel}
          />
          <p className="mt-1.5 text-small text-fg3">{fuelCfg.hint}</p>
        </div>
        <div className="mt-4">
          <Slider
            label={isPlugin ? "Benzin im Hybridbetrieb" : `Verbrauch ${fuelCfg.label}`}
            value={currentCons}
            min={fuelCfg.min}
            max={fuelCfg.max}
            step={0.1}
            unit={fuelCfg.unit}
            format={(v) => v.toFixed(1)}
            onChange={setCurrentCons}
          />
          {isPlugin && (
            <p className="mt-1 text-small text-fg3">
              Was er braucht, wenn die Batterie leer ist und der Motor läuft — nicht der WLTP-Mischwert
              von ein bis zwei Litern.
            </p>
          )}
        </div>
        {isPlugin && (
          <div className="mt-4">
            <Slider
              label="Davon elektrisch gefahren"
              value={elecShare}
              min={0}
              max={100}
              step={5}
              unit="%"
              format={(v) => String(v)}
              onChange={setElecShare}
            />
            <p className="mt-1 text-small text-fg3">
              {fmtCH(annualKm * (elecShare / 100))} von {fmtCH(annualKm)} km elektrisch, gerechnet mit{" "}
              {PLUGIN_KWH_PER_100KM} kWh/100 km zu deinem Heimtarif.
            </p>
          </div>
        )}
      </section>

      <div className="h-px bg-line" />

      <section>
        <h3 className="text-h3 font-bold text-fg">Wie du ein E-Auto laden würdest</h3>
        <p className="mt-0.5 text-small text-fg2">
          Gilt für jedes Inserat: Ladezeiten, Stromkosten, Betrieb pro Monat.
        </p>

        <div className="mt-4">
          <span className="mb-1.5 block text-small font-semibold text-fg2">Laden zuhause</span>
          <ChipGroup
            label="Ladeleistung zuhause"
            options={HOME_CHARGERS.map((c) => ({ key: String(c.kw), label: `${c.label} · ${c.hint}` }))}
            value={String(chargeKw)}
            onChange={(v) => setChargeKw(Number(v))}
          />
        </div>

        <div className="mt-5">
          <Slider
            label="Anteil unterwegs geladen"
            value={publicShare}
            min={0}
            max={100}
            step={5}
            unit="%"
            format={(v) => String(v)}
            onChange={setPublicShare}
          />
          <p className="mt-1 text-small text-fg3">
            {100 - publicShare} % zuhause zu {fmtCH(tariff * 100, 1)} Rp./kWh, {publicShare} % an
            öffentlichen Ladern.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-small font-semibold text-fg2">Photovoltaik zuhause</span>
            <p className="text-small text-fg3">Zeigt zusätzliches Sparpotenzial beim Heimladen.</p>
          </div>
          <Segmented
            size="sm"
            label="Photovoltaik zuhause"
            options={[
              { key: "ja" as const, label: "Ja" },
              { key: "nein" as const, label: "Nein" },
            ]}
            value={pv}
            onChange={setPv}
          />
        </div>
      </section>
    </div>
  );
}
