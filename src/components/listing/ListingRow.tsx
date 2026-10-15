import { CalendarDays, Gauge, MapPin, ShieldCheck } from "lucide-react";
import ListingActions from "./ListingActions";
import { DcLine, ListingPhoto, RangeSoh, type CardExtras } from "./ListingCard";
import { placeOf, warrantyActive, warrantyText } from "../../lib/listingFacts";
import { href } from "../../lib/url";
import { SELLER_LABEL, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   ListingRow — the list view (Konzept §4.2): same data as the card, denser.
   Photo left, title and facts in the middle, price and Betrieb right.
   ============================================================================ */

export default function ListingRow({ listing: l, monthly, distance }: { listing: Listing } & CardExtras) {
  return (
    <article className="card card-hover group relative overflow-hidden">
      <a href={href(`/inserat/${l.id}`)} className="flex flex-col sm:flex-row">
        <ListingPhoto listing={l} className="aspect-4/3 sm:aspect-auto sm:w-56 sm:shrink-0 lg:w-64" />
        <div className="grid flex-1 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
          <div className="min-w-0 space-y-2">
            <div>
              <h3 className="truncate text-h3 font-bold text-fg">{vehicleTitle(l)}</h3>
              {l.variant && <p className="truncate text-small text-fg2">{l.variant}</p>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-small text-fg2">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} aria-hidden className="text-fg3" />
                {l.year}
              </span>
              <span className="inline-flex items-center gap-1">
                <Gauge size={14} aria-hidden className="text-fg3" />
                <span className="tabular">{fmtCH(l.km)}</span> km
              </span>
              {warrantyActive(l) && (
                <span className="inline-flex items-center gap-1 text-accent">
                  <ShieldCheck size={14} aria-hidden />
                  Batteriegarantie {warrantyText(l.warranty!)}
                </span>
              )}
            </div>
            <RangeSoh listing={l} />
            <DcLine listing={l} />
            <div className="flex items-center gap-1 text-small text-fg2">
              <MapPin size={13} aria-hidden className="text-fg3" />
              {placeOf(l)}
              {distance != null && <span className="tabular">· {distance} km</span>}
              <span className="text-fg3">·</span>
              {SELLER_LABEL[l.sellerType]}
              {l.sellerVerified && <span className="text-accent">✓</span>}
            </div>
          </div>
          <div className="flex flex-row items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-between sm:pr-0">
            <span className="hidden sm:block sm:h-9" aria-hidden />
            <div className="sm:text-right">
              <div className="text-h2 font-bold text-fg tabular">CHF {fmtCH(l.price)}</div>
              {l.previousPrice && (
                <div className="text-small text-fg3 line-through tabular">CHF {fmtCH(l.previousPrice)}</div>
              )}
              {monthly != null && (
                <div className="mt-1 text-small text-fg2 tabular">≈ CHF {fmtCH(monthly)}/Mt. Betrieb</div>
              )}
            </div>
          </div>
        </div>
      </a>
      <ListingActions listing={l} className="absolute right-3 top-3 sm:right-4 sm:top-4" variant="overlay" />
    </article>
  );
}
