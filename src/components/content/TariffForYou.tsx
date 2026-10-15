import { MapPin } from "lucide-react";
import { Button } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { openFahrprofil } from "../../stores/ui";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH } from "../../utils/swiss";

/* ============================================================================
   «Und bei dir?» — the tariff post, personal: the reader's municipality,
   its tariff against the Swiss median, and what home charging costs per
   year with their kilometres. Reads the Fahrprofil; without a PLZ it asks.
   ============================================================================ */

const CONSUMPTION = 17; // kWh/100 km, a typical compact EV

export default function TariffForYou() {
  const { gemeinde, hydrated, tariff, annualKm, publicShare } = useCockpit();
  const homeKwh = (annualKm / 100) * CONSUMPTION * (1 - publicShare / 100);
  const diff = (tariff - CH_AVG_TARIFF) * homeKwh;

  return (
    <aside className="not-prose card my-8 p-5">
      <p className="eyebrow text-accent">Und bei dir?</p>
      {hydrated && gemeinde ? (
        <>
          <p className="mt-1 text-h2 font-bold text-fg">
            {gemeinde.name} {gemeinde.canton}: {fmtCH(gemeinde.tariff * 100, 2)} Rp./kWh
          </p>
          <p className="mt-1 text-body text-fg2">
            Zuhause laden kostet dich bei {fmtCH(annualKm)} km im Jahr und {100 - publicShare} % Heimladung rund{" "}
            <strong className="text-fg tabular">CHF {fmtCH(homeKwh * tariff)}</strong> —{" "}
            {Math.abs(diff) < 10
              ? "fast genau so viel wie beim Schweizer Median."
              : `CHF ${fmtCH(Math.abs(diff))} ${diff > 0 ? "mehr" : "weniger"} als beim Schweizer Median.`}
          </p>
          <button type="button" onClick={openFahrprofil} className="link mt-2 text-small font-semibold">
            Werte ändern
          </button>
        </>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-fg2">Gib deine PLZ ein, und hier steht der Tarif deiner Gemeinde ({TARIFF_META.period}).</p>
          <Button variant="secondary" size="sm" onClick={openFahrprofil}>
            <MapPin size={15} aria-hidden /> PLZ eingeben
          </Button>
        </div>
      )}
    </aside>
  );
}
