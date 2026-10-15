import CarGraphic from "./CarGraphic";
import ListingActions from "./ListingActions";
import { Badge } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { photoUrl } from "../lib/supabase";
import { href } from "../lib/url";
import { SELLER_LABEL, vehicleTitle } from "../utils/format";
import { fmtCH } from "../utils/swiss";
import type { Listing } from "../data/evData";

/* ============================================================================
   ListingCard — die Rasteransicht des Katalogs (Default).

   Fotos verkaufen Autos: das Bild führt, darunter genau die vier Fakten, die
   man zum Aussortieren braucht, dann Preis und die eine personalisierte
   Zahl. Die Energiekosten stehen bewusst NICHT im Akzentgrün — der Akzent
   trägt Aktionen, nicht Daten.
   ============================================================================ */

export default function ListingCard({
  listing: l,
  /** Erstes Bild der ersten Reihe: eager laden, es ist meist das LCP-Element. */
  priority = false,
}: {
  listing: Listing;
  priority?: boolean;
}) {
  const { tariff } = useCockpit();

  const reserved = l.status === "RESERVIERT";
  const photo = l.photos?.[0];
  const per100 = l.consumption * tariff;
  const title = vehicleTitle(l);

  return (
    <div className="card-flush group relative flex flex-col transition-colors hover:border-line2">
      <a href={href(`/inserat/${l.id}`)} className="flex flex-1 flex-col">
        <div className="relative aspect-16/10 overflow-hidden border-b border-line bg-surface2">
          {photo ? (
            <img
              src={photoUrl(photo)}
              alt={title}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${
                reserved ? "opacity-70" : ""
              }`}
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <CarGraphic segment={l.segment} className="h-3/5 w-3/5 text-fg3" />
            </div>
          )}
          {reserved ? (
            <span className="absolute left-3 top-3">
              <Badge tone="caution" className="bg-canvas/90">
                Reserviert
              </Badge>
            </span>
          ) : (
            l.postedDays <= 3 && (
              <span className="absolute left-3 top-3">
                <Badge tone="positive" className="bg-canvas/90">
                  Neu
                </Badge>
              </span>
            )
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div>
            <h3 className="truncate text-h3 font-semibold text-fg">{title}</h3>
            {l.variant && <p className="truncate text-small text-fg2">{l.variant}</p>}
            <p className="mt-1 text-small text-fg2">
              {l.year} · <span className="tabular">{fmtCH(l.km)}</span> km ·{" "}
              <span className="tabular">{l.range}</span> km Reichweite ·{" "}
              {SELLER_LABEL[l.sellerType]}
            </p>
          </div>
          <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
            <span className="text-h3 font-semibold text-fg tabular">
              CHF {fmtCH(l.price)}
            </span>
            <span className="text-right text-small text-fg2">
              <span className="tabular">≈ {per100.toFixed(2)}</span>
              <span className="block text-micro text-fg3">CHF Strom/100 km</span>
            </span>
          </div>
        </div>
      </a>

      {/* Aktionen liegen über dem Kartenlink, nicht darin — sonst navigieren
          sie mit. */}
      <ListingActions listing={l} variant="overlay" className="absolute right-2.5 top-2.5" />
    </div>
  );
}
