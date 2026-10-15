import { ChevronRight } from "lucide-react";
import { ListingThumb } from "./CarGraphic";
import ListingActions from "./ListingActions";
import { Badge } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { href } from "../lib/url";
import { SEGMENT_LABEL, SELLER_LABEL, vehicleTitle } from "../utils/format";
import { fmtCH } from "../utils/swiss";
import { type Listing } from "../data/evData";

/* ============================================================================
   ListingBoard — die dichte Listenansicht.

   Früher die EINZIGE Darstellung des Katalogs: neun Spalten, in denen das
   Foto auf 56×36 px schrumpfte. Jetzt ist sie der Modus für alle, die
   Datenblätter vergleichen wollen — umschaltbar, mit grösserem Bild und
   lesbaren Zellen. `compact` bleibt für eingebettete Listen (Konto, ähnliche
   Inserate).
   ============================================================================ */

const COLS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))_auto]";
const COLS_COMPACT = "grid-cols-[minmax(0,1fr)_auto]";

export default function ListingBoard({
  listings,
  compact = false,
}: {
  listings: Listing[];
  /** Weniger Spalten, keine Aktionen — für eingebettete Listen. */
  compact?: boolean;
}) {
  const { tariff } = useCockpit();
  const cols = compact ? COLS_COMPACT : COLS;

  return (
    <div className="card-flush">
      {!compact && (
        <div
          className={`grid ${cols} items-center gap-x-4 border-b border-line px-4 py-2.5 text-small text-fg3`}
        >
          <span>Inserat</span>
          <span className="hidden text-right md:block">Jahr · km</span>
          <span className="hidden text-right md:block">Reichweite</span>
          <span className="hidden text-right md:block">Strom/100 km</span>
          <span className="text-right">Preis</span>
        </div>
      )}

      {listings.map((l) => {
        const reserved = l.status === "RESERVIERT";
        const per100 = l.consumption * tariff;

        return (
          <div
            key={l.id}
            className="group relative border-b border-line transition-colors last:border-b-0 hover:bg-surface2/60"
          >
            <a
              href={href(`/inserat/${l.id}`)}
              className={`grid ${cols} items-center gap-x-4 px-4 py-3 ${
                reserved ? "opacity-65" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <ListingThumb listing={l} className="hidden h-12 w-18 sm:block" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-fg">
                      {vehicleTitle(l)}
                    </span>
                    {l.isDemo && <Badge tone="neutral">Demo</Badge>}
                    {reserved ? (
                      <Badge tone="caution">Reserviert</Badge>
                    ) : (
                      l.postedDays <= 3 && <Badge tone="positive">Neu</Badge>
                    )}
                  </span>
                  <span className="block truncate text-small text-fg2">
                    {l.variant && <>{l.variant} · </>}
                    {SEGMENT_LABEL[l.segment]} · {SELLER_LABEL[l.sellerType]} · {l.ort}
                    <span className="md:hidden">
                      {" "}
                      · {l.year} · <span className="tabular">{fmtCH(l.km)}</span> km
                    </span>
                  </span>
                </span>
              </span>

              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {l.year} · {fmtCH(l.km)}
              </span>
              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {l.range} km
              </span>
              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {per100.toFixed(2)}
              </span>

              <span className="flex items-center justify-end gap-3">
                <span className="text-body font-semibold text-fg tabular">
                  {fmtCH(l.price)}
                </span>
                {compact ? (
                  <ChevronRight size={15} className="text-fg3" aria-hidden />
                ) : (
                  /* Platz für die Aktionen, die darüber schweben. */
                  <span className="w-19" aria-hidden />
                )}
              </span>
            </a>

            {!compact && (
              <ListingActions
                listing={l}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
