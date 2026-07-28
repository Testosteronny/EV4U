import { ArrowUpRight } from "lucide-react";
import CarGraphic from "./CarGraphic";
import { useCockpit } from "../hooks/useCockpit";
import { href } from "../lib/url";
import { photoUrl } from "../lib/supabase";
import { type Listing } from "../data/evData";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   ListingShowcase — the home-page teaser as photo cards. Where the /inserate
   catalogue stays a dense split-flap board, the storefront leads with the
   cars themselves: the seller's first photo, or the segment line drawing on
   a blueprint tile when none was uploaded. Every card links to its dossier.
   ============================================================================ */

function StatusChip({ listing }: { listing: Listing }) {
  if (listing.status === "RESERVIERT") {
    return (
      <span className="absolute left-3 top-3 border border-warn/60 bg-nacht/85 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-warn">
        Reserviert
      </span>
    );
  }
  if (listing.postedDays <= 3) {
    return (
      <span className="absolute left-3 top-3 border border-lume/60 bg-nacht/85 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-lume">
        ● Neu
      </span>
    );
  }
  return null;
}

export default function ListingShowcase({ listings }: { listings: Listing[] }) {
  const { tariff, tariffLabel } = useCockpit();

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => {
          const reserved = l.status === "RESERVIERT";
          const photo = l.photos?.[0];
          const per100 = l.consumption * tariff;
          return (
            <a
              key={l.id}
              href={href(`/inserat/${l.id}`)}
              className={`panel group flex flex-col overflow-hidden transition-colors duration-300 hover:border-signal/60 ${
                reserved ? "opacity-60" : ""
              }`}
            >
              {/* Photo — or the technical side elevation on a blueprint tile */}
              <div className="relative aspect-[16/9] overflow-hidden border-b border-line">
                {photo ? (
                  <img
                    src={photoUrl(photo)}
                    alt={`${l.brand} ${l.model}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="bg-blueprint grid h-full w-full place-items-center bg-panel2/60">
                    <CarGraphic
                      segment={l.segment}
                      className="h-4/5 w-4/5 text-muted transition-colors duration-300 group-hover:text-ink"
                    />
                  </div>
                )}
                <StatusChip listing={l} />
                <ArrowUpRight
                  size={16}
                  className="absolute right-3 top-3 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>

              {/* Dossier line */}
              <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                <div>
                  <h3 className="stretch-wide truncate text-lg font-extrabold uppercase leading-tight text-ink">
                    {l.brand} {l.model}
                  </h3>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                    {l.year} · {fmtCH(l.km / 1000, 0)}T km · {l.range} km ·{" "}
                    {l.sellerType}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-line/60 pt-3">
                  <span className="font-mono text-lg font-bold text-ink tabular">
                    {fmtCH(l.price)}
                    <span className="ml-1 text-[10px] font-normal text-muted">
                      CHF
                    </span>
                  </span>
                  <span className="text-right font-mono text-[10px] tracking-[0.1em] text-signal tabular">
                    CHF {per100.toFixed(2)}
                    <span className="block text-[8px] uppercase tracking-[0.18em] text-muted">
                      Strom/100 km*
                    </span>
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted">
        * berechnet mit Tarif {tariffLabel} — {fmtCH(tariff * 100, 1)} Rp./kWh
      </p>
    </div>
  );
}
