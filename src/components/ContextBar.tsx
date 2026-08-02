import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Field, Segmented, Sheet, Slider } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { $contextSheet, closeContextSheet, openContextSheet } from "../stores/ui";
import { FUELS, type FuelType } from "../utils/costModel";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH, resolveZip } from "../utils/swiss";

/* ============================================================================
   ContextBar — «Deine Werte».

   Der zentrale Umbau des Konzepts. Jede personalisierte Zahl auf EV4U hängt
   an fünf Eingaben (Gemeindetarif, Jahres-km, heutiges Auto, Lade-Mix, PV).
   Vorher waren die nur in einer eingebetteten Engine editierbar und sonst
   nirgends sichtbar — kompensiert durch eine Fussnote an jeder zweiten
   Komponente. Jetzt gibt es eine Leiste, die sie zeigt, und ein Sheet, das
   sie setzt. Die Fussnoten entfallen ersatzlos.

   Ersetzt: PlzGate-Modal · Hero-Tarif-Widget · TopBar-Chip ·
   Eingabespalte von /rechenwerk.
   ============================================================================ */

/** Kompakter Wert in der Leiste; auf schmalen Schirmen ausblendbar. */
function Item({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <span className={`text-fg3 ${className}`} aria-hidden>
        ·
      </span>
      <span className={className}>{children}</span>
    </>
  );
}

function ContextSheet({ onClose }: { onClose: () => void }) {
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
    publicShare,
    setPublicShare,
    pv,
    setPv,
  } = useCockpit();

  const [zip, setZip] = useState(gemeinde?.zip ?? "");
  const hit = zip.length === 4 ? resolveZip(zip) : null;
  const invalid = zip.length === 4 && !hit;
  const fuelCfg = FUELS[currentFuel];

  // Vier gültige Ziffern setzen den Tarif direkt — kein Bestätigungsschritt.
  useEffect(() => {
    if (hit && hit.zip !== gemeinde?.zip) setGemeinde(hit);
    if (zip.length < 4 && gemeinde) setGemeinde(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  return (
    <Sheet
      title="Deine Werte"
      onClose={onClose}
      wide
      footer={
        <>
          <p className="text-micro text-fg3">
            Wird lokal gespeichert und gilt für jede Zahl auf EV4U.
          </p>
          <Button variant="primary" onClick={onClose}>
            Fertig
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        {/* 1 — Standort. Der Tarif, mit dem jede Energie-Zahl rechnet. */}
        <section>
          <Field
            label="Postleitzahl"
            hint={`Quelle: ElCom ${TARIFF_META.period}, Profil H4, exkl. MwSt.`}
          >
            <div className="relative">
              <MapPin
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3"
              />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="z. B. 4617"
                inputMode="numeric"
                aria-label="Schweizer Postleitzahl"
                className="field pl-9 tabular"
              />
            </div>
          </Field>

          {invalid && (
            <p className="mt-2 text-small text-caution">
              Keine Schweizer PLZ — bitte prüfen.
            </p>
          )}

          {gemeinde ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-accent/[0.07] px-4 py-3">
              <div>
                <div className="text-body font-medium text-fg">{gemeinde.name}</div>
                <div className="text-small text-fg2">
                  {gemeinde.zip} · Kanton {gemeinde.canton}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gemeinde.estimated && <Badge tone="caution">geschätzt</Badge>}
                <span className="text-h3 font-semibold text-accent tabular">
                  {fmtCH(gemeinde.tariff * 100, 1)}
                  <span className="ml-1 text-small font-normal text-fg2">Rp./kWh</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-small text-fg2">
              Ohne PLZ rechnen wir mit dem Schweizer Median{" "}
              <span className="tabular">{fmtCH(CH_AVG_TARIFF * 100, 1)}</span> Rp./kWh.
            </p>
          )}
        </section>

        <div className="h-px bg-line" />

        {/* 2 — Fahrleistung */}
        <Slider
          label="Jahresfahrleistung"
          value={annualKm}
          min={5000}
          max={40000}
          step={500}
          unit="km"
          onChange={setAnnualKm}
        />

        {/* 3 — Das Vergleichsauto */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-small font-medium text-fg2">Dein Auto heute</span>
            <Segmented
              size="sm"
              options={(Object.keys(FUELS) as FuelType[]).map((f) => ({
                key: f,
                label: FUELS[f].label,
              }))}
              value={currentFuel}
              onChange={setCurrentFuel}
            />
          </div>
          <Slider
            label={`Verbrauch ${fuelCfg.label}`}
            value={currentCons}
            min={fuelCfg.min}
            max={fuelCfg.max}
            step={0.1}
            unit={fuelCfg.unit}
            format={(v) => v.toFixed(1)}
            onChange={setCurrentCons}
          />
        </section>

        {/* 4 — Lade-Mix */}
        <div>
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
            {100 - publicShare} % zuhause zu {fmtCH(tariff * 100, 1)} Rp./kWh,{" "}
            {publicShare} % unterwegs an öffentlichen Ladern.
          </p>
        </div>

        {/* 5 — PV */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-small font-medium text-fg2">
              Photovoltaik zuhause
            </span>
            <p className="text-small text-fg3">
              Rechnet zusätzliches Sparpotenzial beim Heimladen aus.
            </p>
          </div>
          <Segmented
            size="sm"
            options={[
              { key: "ja" as const, label: "Ja" },
              { key: "nein" as const, label: "Nein" },
            ]}
            value={pv}
            onChange={setPv}
          />
        </div>
      </div>
    </Sheet>
  );
}

export default function ContextBar() {
  const { gemeinde, hydrated, annualKm, currentFuel, currentCons, publicShare } =
    useCockpit();
  const open = useStore($contextSheet);
  const fuelCfg = FUELS[currentFuel];

  return (
    <>
      <div className="mx-auto flex h-9 max-w-[88rem] items-center gap-2 overflow-hidden px-4 text-small sm:px-6">
        <span className="hidden shrink-0 text-fg3 sm:inline">Deine Werte</span>

        {/* Erstbesuch: die Aufforderung steht inline in der Leiste — kein
            Modal, das den ersten Eindruck blockiert. */}
        {hydrated && !gemeinde ? (
          <button
            onClick={openContextSheet}
            className="flex shrink-0 items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
          >
            <MapPin size={13} aria-hidden />
            Standort wählen für deine Preise
          </button>
        ) : (
          <span className="flex min-w-0 shrink items-center gap-2 truncate text-fg2">
            <MapPin size={13} aria-hidden className="hidden shrink-0 text-fg3 sm:block" />
            <span className="truncate">
              {gemeinde ? (
                <>
                  <span className="text-fg">{gemeinde.zip}</span> {gemeinde.name}
                  <span className="hidden lg:inline">
                    {" "}
                    · <span className="tabular">{fmtCH(gemeinde.tariff * 100, 1)}</span>{" "}
                    Rp./kWh
                  </span>
                </>
              ) : (
                <span className="tabular">
                  CH-Median {fmtCH(CH_AVG_TARIFF * 100, 1)} Rp./kWh
                </span>
              )}
            </span>
          </span>
        )}

        <span className="hidden items-center gap-2 truncate text-fg2 sm:flex">
          <Item>
            <span className="tabular">{fmtCH(annualKm)}</span> km/Jahr
          </Item>
          <Item className="hidden md:inline">
            {fuelCfg.label} <span className="tabular">{currentCons.toFixed(1)}</span>{" "}
            {fuelCfg.unit.split("/")[0]}
          </Item>
          <Item className="hidden xl:inline">
            <span className="tabular">{100 - publicShare} %</span> zuhause
          </Item>
        </span>

        <button
          onClick={openContextSheet}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-chip px-2 py-1 font-medium text-fg2 transition-colors hover:bg-surface2 hover:text-fg"
        >
          <SlidersHorizontal size={13} aria-hidden />
          Anpassen
        </button>
      </div>

      {open && <ContextSheet onClose={closeContextSheet} />}
    </>
  );
}
