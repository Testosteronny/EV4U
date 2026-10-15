import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { Badge, Button, ChipGroup, Field, Segmented, Sheet, Slider } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { $contextSheet, closeContextSheet, openContextSheet } from "../stores/ui";
import { FUELS, PLUGIN_KWH_PER_100KM, type FuelType } from "../utils/costModel";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH } from "../utils/swiss";
import { usePlzResolver } from "../hooks/usePlzResolver";

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
    elecShare,
    setElecShare,
    publicShare,
    setPublicShare,
    pv,
    setPv,
  } = useCockpit();

  const [zip, setZip] = useState(gemeinde?.zip ?? "");
  // The PLZ map loads when the sheet opens; until it's there a complete PLZ
  // is "pending", not "invalid".
  const resolveZip = usePlzResolver();
  const hit = zip.length === 4 && resolveZip ? resolveZip(zip) : null;
  const invalid = zip.length === 4 && !!resolveZip && !hit;
  const fuelCfg = FUELS[currentFuel];
  const isPlugin = currentFuel === "PLUGIN";

  // Vier gültige Ziffern setzen den Tarif direkt — kein Bestätigungsschritt.
  //
  // Beim Kürzen wird NICHT zurückgesetzt: wer «4617» zu «46» löscht, um eine
  // andere PLZ zu tippen, hatte sonst mitten im Tippen keinen Standort mehr,
  // und wer das Sheet dann schloss, war seinen fixierten Tarif los. Der alte
  // Wert gilt, bis ein neuer gültig ist; entfernen kann man ihn ausdrücklich.
  useEffect(() => {
    if (hit && hit.zip !== gemeinde?.zip) setGemeinde(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, resolveZip]);

  const clearZip = () => {
    setZip("");
    setGemeinde(null);
  };

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
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-accent/[0.07] px-4 py-3">
                <div>
                  <div className="text-body font-medium text-fg">{gemeinde.name}</div>
                  <div className="text-small text-fg2">
                    {gemeinde.zip} · Kanton {gemeinde.canton}
                    {gemeinde.via && ` · Tarif von ${gemeinde.via}`}
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
              <button
                onClick={clearZip}
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

        <div className="h-px bg-line" />

        {/* 3 — Das Vergleichsauto. Ab hier zwei klar getrennte Blöcke: was du
             HEUTE fährst, und wie du ein E-Auto laden würdest. Vorher standen
             beide ohne Trennung untereinander, und der Lade-Mix las sich wie
             eine Frage an den Benziner. */}
        <section>
          <h3 className="text-h3 font-semibold text-fg">Dein Auto heute</h3>
          <p className="mt-0.5 text-small text-fg2">
            Der Massstab: Jede Ersparnis auf EV4U wird gegen dieses Auto gerechnet.
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
                Was er braucht, wenn die Batterie leer ist und der Motor läuft —
                nicht der WLTP-Mischwert von ein bis zwei Litern.
              </p>
            )}
          </div>

          {/* Nur beim Plug-in-Hybrid: ohne diesen Anteil fehlt der Strom, den
              das heutige Auto ebenfalls verbraucht, in der Rechnung. */}
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
                {fmtCH(annualKm * (elecShare / 100))} von {fmtCH(annualKm)} km
                elektrisch, gerechnet mit {PLUGIN_KWH_PER_100KM} kWh/100 km zu
                deinem Heimtarif. Der Rest fährt auf Benzin.
              </p>
            </div>
          )}
        </section>

        <div className="h-px bg-line" />

        {/* 4 — Das E-Auto. Diese beiden Angaben gelten dem Inserat, das
             gerade gerechnet wird — nicht dem Auto von oben. */}
        <section>
          <h3 className="text-h3 font-semibold text-fg">
            Wenn du elektrisch fahren würdest
          </h3>
          <p className="mt-0.5 text-small text-fg2">
            Gilt für jedes Inserat, das EV4U dir durchrechnet — unabhängig
            davon, was du heute fährst.
          </p>

          <div className="mt-4">
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
        </section>
      </div>
    </Sheet>
  );
}

export default function ContextBar() {
  const { gemeinde, hydrated, annualKm, currentFuel, currentCons, elecShare, publicShare } =
    useCockpit();
  const open = useStore($contextSheet);
  const fuelCfg = FUELS[currentFuel];

  return (
    <>
      <div className="mx-auto flex h-9 max-w-352 items-center gap-2 overflow-hidden px-4 text-small sm:px-6">
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
            {currentFuel === "PLUGIN" && (
              <>
                {" "}
                · <span className="tabular">{elecShare} %</span> elektrisch
              </>
            )}
          </Item>
          <Item className="hidden xl:inline">
            <span className="tabular">{100 - publicShare} %</span> zuhause laden
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
