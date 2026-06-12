import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import EngineCore from "../components/EngineCore";
import { SectionHeader } from "../components/ui";
import { useCockpit } from "../context/CockpitContext";
import { useListings } from "../context/ListingsContext";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   /rechenwerk — the standalone engine, an acquisition tool that always
   funnels back into inventory: pick any OPEN listing, tune your context,
   then jump to the ad. Settings persist; the embedded engines on the
   detail pages share them.
   ============================================================================ */

export default function RechenwerkPage() {
  const { listing, setListingId } = useCockpit();
  const { active } = useListings();

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Rechenwerk"
        claim="Inserat · Strom · Solar · Ladekarte — ein Instrument"
      >
        <Link
          to={`/inserat/${listing.id}`}
          className="flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:border-signal hover:text-signal"
        >
          Zum Inserat <ArrowUpRight size={12} />
        </Link>
      </SectionHeader>

      <div className="mt-10">
        <EngineCore listing={listing}>
          {/* Inserat picker — open listings only, injected into the engine */}
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Inserat in Simulation
            </label>
            <select
              value={listing.id}
              onChange={(e) => setListingId(e.target.value)}
              className="w-full cursor-pointer border border-line bg-nacht px-3 py-3 font-mono text-xs tracking-[0.08em] text-ink focus:border-signal focus:outline-none"
            >
              {active.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.brand} {l.model} — CHF {fmtCH(l.price)}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-2 gap-px bg-line font-mono text-[10px]">
              {[
                ["JAHRGANG", `${listing.year}`],
                ["KM-STAND", fmtCH(listing.km)],
                ["VERBRAUCH", `${listing.consumption.toFixed(1)} KWH`],
                ["ANBIETER", listing.sellerType],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between bg-panel px-3 py-2">
                  <span className="text-muted">{k}</span>
                  <span className="text-ink tabular">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </EngineCore>
      </div>

      {/* Funnel back into inventory */}
      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Die Zahlen passen? Das Auto gibt es wirklich — als offenes Inserat.
        </p>
        <Link
          to={`/inserat/${listing.id}`}
          className="border border-signal bg-signal px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-signal-dim"
        >
          {listing.brand} {listing.model} ansehen →
        </Link>
      </div>
    </section>
  );
}
