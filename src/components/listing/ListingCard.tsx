import { BatteryCharging, Camera, MapPin, Timer, Zap } from "lucide-react";
import CarGraphic from "./CarGraphic";
import ListingActions from "./ListingActions";
import { Badge, ChargeBar } from "../ui";
import { isFresh, isHighVoltage, placeOf, warrantyBadge } from "../../lib/listingFacts";
import { photoUrl } from "../../lib/supabase";
import { href } from "../../lib/url";
import { SELLER_LABEL, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   ListingCard v3 (Konzept §4.2) — the answer on the card.

   A buyer should be able to decide from the list alone whether to open a
   listing: photo with what is special (Neu, Garantie bis 2031, Preis
   gesenkt, 800 V), then what distinguishes a USED EV — range, SOH as a
   Ladebalken, DC charging — and finally price, Betrieb per month for you,
   place and distance, seller type.
   ============================================================================ */

export type CardExtras = {
  /** Betrieb pro Monat with the visitor's Fahrprofil, CHF. */
  monthly?: number | null;
  /** Straight-line distance from the visitor's PLZ, km. */
  distance?: number | null;
};

/** Up to three badges, most important first. */
export function listingBadges(l: Listing): { label: string; tone: "volt" | "photo" | "caution" | "neutral" }[] {
  const out: { label: string; tone: "volt" | "photo" | "caution" | "neutral" }[] = [];
  if (l.isDemo) out.push({ label: "Demo", tone: "neutral" });
  if (l.status === "RESERVIERT") out.push({ label: "Reserviert", tone: "caution" });
  if (l.status === "VERKAUFT") out.push({ label: "Verkauft", tone: "neutral" });
  if (l.status === "AKTIV" && isFresh(l)) out.push({ label: "Neu", tone: "volt" });
  if (l.previousPrice) out.push({ label: "Preis gesenkt", tone: "caution" });
  const w = warrantyBadge(l);
  if (w) out.push({ label: w, tone: "photo" });
  if (isHighVoltage(l)) out.push({ label: "800 V", tone: "photo" });
  return out.slice(0, 3);
}

/** The photo (or drawing) with badges and the photo count. */
export function ListingPhoto({
  listing: l,
  priority = false,
  className = "",
}: {
  listing: Listing;
  priority?: boolean;
  className?: string;
}) {
  const photo = l.photos?.[0];
  const dim = l.status !== "AKTIV";
  return (
    <div className={`relative overflow-hidden bg-surface2 ${className}`}>
      {photo ? (
        <img
          src={photoUrl(photo)}
          alt={vehicleTitle(l)}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${dim ? "opacity-75" : ""}`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-linear-to-b from-surface2 to-line/60">
          <CarGraphic segment={l.segment} className="h-3/5 w-3/5 text-fg3" />
        </div>
      )}
      <span className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-6rem)] flex-wrap gap-1">
        {listingBadges(l).map((b) => (
          <Badge key={b.label} tone={b.tone} className="text-micro shadow-sm">
            {b.label}
          </Badge>
        ))}
      </span>
      {(l.photos?.length ?? 0) > 1 && (
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-micro font-semibold text-white">
          <Camera size={12} aria-hidden />
          {l.photos!.length}
        </span>
      )}
    </div>
  );
}

/** «⚡ 533 km · SOH ▰▰▰▰▰▰▰▰▰▱ 94 %» */
export function RangeSoh({ listing: l }: { listing: Listing }) {
  return (
    <div className="flex items-center gap-3 text-small">
      <span className="inline-flex shrink-0 items-center gap-1 text-fg">
        <Zap size={14} aria-hidden className="text-fg3" />
        <span className="font-semibold tabular">{fmtCH(l.range)}</span> km
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <BatteryCharging size={14} aria-hidden className="shrink-0 text-fg3" />
        <ChargeBar value={l.soh} min={50} label={`Batteriezustand ${l.soh} %`} className="max-w-24" />
        <span className="shrink-0 text-fg2 tabular">SOH {l.soh} %</span>
      </span>
    </div>
  );
}

/** «⏱ DC 250 kW · 10–80 % in 27 min» */
export function DcLine({ listing: l }: { listing: Listing }) {
  if (!l.dcKw) {
    return (
      <div className="flex items-center gap-1 text-small text-fg2">
        <Timer size={14} aria-hidden className="text-fg3" />
        Kein Schnellladen (nur AC)
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-small text-fg2">
      <Timer size={14} aria-hidden className="text-fg3" />
      DC <span className="font-semibold text-fg tabular">{l.dcKw} kW</span>
      {l.chargeMin && (
        <>
          {" "}
          · 10–80 % in <span className="tabular">{l.chargeMin} min</span>
        </>
      )}
    </div>
  );
}

export default function ListingCard({
  listing: l,
  monthly,
  distance,
  priority = false,
}: { listing: Listing; priority?: boolean } & CardExtras) {
  const title = vehicleTitle(l);
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden">
      <a href={href(`/inserat/${l.id}`)} className="flex flex-1 flex-col">
        <ListingPhoto listing={l} priority={priority} className="aspect-4/3" />
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-h3 font-bold text-fg">{title}</h3>
            <p className="truncate text-small text-fg2">
              {l.variant && <>{l.variant} · </>}
              {l.year} · <span className="tabular">{fmtCH(l.km)}</span> km
            </p>
          </div>
          <RangeSoh listing={l} />
          <DcLine listing={l} />

          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <div>
              <div className="text-h2 font-bold text-fg tabular">CHF {fmtCH(l.price)}</div>
              {l.previousPrice && (
                <div className="text-small text-fg3 line-through tabular">CHF {fmtCH(l.previousPrice)}</div>
              )}
            </div>
            {monthly != null && (
              <div className="text-right">
                <div className="text-body font-semibold text-fg tabular">≈ CHF {fmtCH(monthly)}/Mt.</div>
                <div className="text-micro text-fg3">Betrieb für dich</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-small text-fg2">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={13} aria-hidden className="shrink-0 text-fg3" />
              <span className="truncate">{placeOf(l)}</span>
              {distance != null && <span className="shrink-0 tabular">· {distance} km</span>}
            </span>
            <span className="shrink-0">
              {SELLER_LABEL[l.sellerType]}
              {l.sellerVerified && <span className="ml-1 text-accent" title="Garage von EV4U geprüft">✓</span>}
            </span>
          </div>
        </div>
      </a>
      {/* Actions sit above the card link, not inside it. */}
      <ListingActions listing={l} variant="overlay" className="absolute right-2.5 top-2.5" />
    </article>
  );
}
