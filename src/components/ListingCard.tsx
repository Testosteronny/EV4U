import { GitCompareArrows, Heart } from "lucide-react";
import CarGraphic from "./CarGraphic";
import { Badge } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useFavorites } from "../hooks/useFavorites";
import { photoUrl } from "../lib/supabase";
import { href } from "../lib/url";
import { fmtCH } from "../utils/swiss";
import type { Listing } from "../data/evData";

/* ============================================================================
   ListingCard — die Rasteransicht des Katalogs (Default).

   Fotos verkaufen Autos: das Bild führt, darunter genau die vier Fakten, die
   man zum Aussortieren braucht, dann Preis und die eine personalisierte
   Zahl. Die Energiekosten stehen bewusst NICHT im Akzentgrün — der Akzent
   trägt Aktionen, nicht Daten.
   ============================================================================ */

export default function ListingCard({ listing: l }: { listing: Listing }) {
  const { tariff, compareIds, toggleCompare } = useCockpit();
  const { favorites, toggleFavorite } = useFavorites();

  const reserved = l.status === "RESERVIERT";
  const photo = l.photos?.[0];
  const per100 = l.consumption * tariff;
  const inCompare = compareIds.includes(l.id);
  const isFav = favorites.includes(l.id);

  return (
    <div className="card-flush group relative flex flex-col transition-colors hover:border-line2">
      <a href={href(`/inserat/${l.id}`)} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface2">
          {photo ? (
            <img
              src={photoUrl(photo)}
              alt={`${l.brand} ${l.model}`}
              loading="lazy"
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
          {reserved && (
            <span className="absolute left-3 top-3">
              <Badge tone="caution" className="bg-canvas/90">
                Reserviert
              </Badge>
            </span>
          )}
          {!reserved && l.postedDays <= 3 && (
            <span className="absolute left-3 top-3">
              <Badge tone="positive" className="bg-canvas/90">
                Neu
              </Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div>
            <h3 className="truncate text-h3 font-semibold text-fg">
              {l.brand} {l.model}
            </h3>
            <p className="mt-1 text-small text-fg2">
              {l.year} · <span className="tabular">{fmtCH(l.km)}</span> km ·{" "}
              <span className="tabular">{l.range}</span> km Reichweite ·{" "}
              {l.sellerType === "GARAGE" ? "Garage" : "Privat"}
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
      <div className="absolute right-2.5 top-2.5 flex gap-1.5">
        <button
          onClick={() => toggleFavorite(l.id)}
          title={isFav ? "Von der Merkliste entfernen" : "Auf die Merkliste"}
          className={`grid h-8 w-8 place-items-center rounded-card border backdrop-blur-sm transition-colors ${
            isFav
              ? "border-accent bg-accent text-on-accent"
              : "border-line2 bg-canvas/85 text-fg2 hover:text-fg"
          }`}
        >
          <Heart size={15} fill={isFav ? "currentColor" : "none"} />
          <span className="sr-only">Merken</span>
        </button>
        <button
          onClick={() => toggleCompare(l.id)}
          disabled={reserved}
          title={
            reserved
              ? "Reservierte Inserate lassen sich nicht vergleichen"
              : inCompare
                ? "Aus dem Vergleich entfernen"
                : "Zum Vergleich hinzufügen (max. 3)"
          }
          className={`grid h-8 w-8 place-items-center rounded-card border backdrop-blur-sm transition-colors disabled:opacity-40 ${
            inCompare
              ? "border-accent bg-accent text-on-accent"
              : "border-line2 bg-canvas/85 text-fg2 hover:text-fg"
          }`}
        >
          <GitCompareArrows size={15} />
          <span className="sr-only">Vergleichen</span>
        </button>
      </div>
    </div>
  );
}
