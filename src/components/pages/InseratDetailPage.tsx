import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BatteryCharging,
  CalendarClock,
  GitCompareArrows,
  Heart,
  HeartPulse,
  MapPin,
  PlugZap,
  Users,
} from "lucide-react";
import ContactSeller from "../ContactSeller";
import EngineCore from "../EngineCore";
import { Stamp } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { photoUrl } from "../../lib/supabase";
import { href } from "../../lib/url";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /inserat/:id — one listing, one page, one URL.
   The dossier (specs, measured SOH, seller) plus the embedded Rechenwerk
   computing THIS car against the visitor's persisted context (tariff, km,
   Lade-Mix, PV). RESERVIERT listings show their dossier but no simulation.
   ============================================================================ */

export default function InseratDetailPage({
  slug,
  initial,
}: {
  slug: string;
  /** Build-time listing for prerendered pages — JSON-LD/OG live in the
   *  Astro page head; this island just renders with it immediately. */
  initial?: Listing;
}) {
  const { toggleCompare, compareIds, favorites, toggleFavorite } = useCockpit();
  const { listings, live } = useListings();
  const listing = listings.find((l) => l.id === slug) ?? (live ? undefined : initial);

  // Title for the 404-fallback path (prerendered pages already have it).
  useEffect(() => {
    if (listing) {
      document.title = `${listing.brand} ${listing.model} — CHF ${fmtCH(listing.price)} | EV4U`;
    }
  }, [listing]);

  if (!listing) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <div className="panel px-6 py-16 text-center">
          <p className="stretch-wide text-2xl font-extrabold uppercase text-ink">
            Inserat nicht gefunden.
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
            VERKAUFT, ZURÜCKGEZOGEN ODER FALSCHE URL.
          </p>
          <a
            href={href("/inserate")}
            className="mt-6 inline-block border border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink transition-colors hover:border-signal hover:text-signal"
          >
            ← Zur Markt-Tafel
          </a>
        </div>
      </section>
    );
  }

  const reserved = listing.status === "RESERVIERT";
  const inCompare = compareIds.includes(listing.id);
  const isFav = favorites.includes(listing.id);
  const newDiscount =
    listing.priceNew && listing.priceNew > listing.price
      ? Math.round((1 - listing.price / listing.priceNew) * 100)
      : null;

  const specs: [string, string][] = [
    ["JAHRGANG", `${listing.year}`],
    ["KM-STAND", fmtCH(listing.km)],
    ["WLTP-REICHWEITE", `${listing.range} KM`],
    ["VERBRAUCH", `${listing.consumption.toFixed(1)} KWH/100KM`],
    ["BATTERIE NETTO", `${listing.battery} KWH`],
    ["LADEZEIT 10–80 %", `${listing.chargeMin} MIN`],
    ["DC-SPITZE", `${listing.dcKw} KW`],
    ["SITZE", `${listing.seats}`],
  ];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-8">
        <a
          href={href("/inserate")}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-signal"
        >
          <ArrowLeft size={12} /> Markt-Tafel
        </a>

        {/* Dossier header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 border-t border-line pt-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                <span className="text-signal">INSERAT {listing.id.toUpperCase()}</span>
                <span className="current-line w-10" aria-hidden />
                {listing.segment} · {listing.sellerType} · EINGESTELLT VOR{" "}
                {listing.postedDays} TAGEN
              </div>
              <h1 className="stretch-expand text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
                {listing.brand} {listing.model}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                {listing.note}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {reserved ? (
                <Stamp className="!border-warn !text-warn">Reserviert</Stamp>
              ) : (
                <Stamp className="!border-lume !text-lume">Verfügbar</Stamp>
              )}
              <div className="font-mono text-4xl font-bold text-ink tabular sm:text-5xl">
                {fmtCH(listing.price)}
                <span className="ml-2 text-sm font-normal text-muted">CHF</span>
              </div>
              {newDiscount !== null && (
                <div className="border border-lume/40 bg-lume/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] text-lume tabular">
                  NEUPREIS CHF {fmtCH(listing.priceNew!)} — DU SPARST{" "}
                  {newDiscount} %
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(listing.id)}
                  title={isFav ? "Von Merkliste entfernen" : "Auf die Merkliste"}
                  className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    isFav
                      ? "border-signal bg-signal text-white"
                      : "border-line text-ink hover:border-signal hover:text-signal"
                  }`}
                >
                  <Heart size={12} fill={isFav ? "currentColor" : "none"} />
                  {isFav ? "Gemerkt" : "Merken"}
                </button>
                <button
                  disabled={reserved}
                  onClick={() => toggleCompare(listing.id)}
                className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  reserved
                    ? "cursor-not-allowed border-line text-muted"
                    : inCompare
                      ? "border-signal bg-signal text-white"
                      : "border-line text-ink hover:border-signal hover:text-signal"
                }`}
              >
                  <GitCompareArrows size={12} />
                  {inCompare ? "Im Vergleich ✓" : "Vergleichen"}
                </button>
              </div>
            </div>
          </div>

          {/* Photo gallery — only when the seller uploaded images */}
          {listing.photos && listing.photos.length > 0 && (
            <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
              {listing.photos.map((p) => (
                <img
                  key={p}
                  src={photoUrl(p)}
                  alt={`${listing.brand} ${listing.model}`}
                  loading="lazy"
                  className="h-48 w-auto shrink-0 border border-line object-cover sm:h-64"
                />
              ))}
            </div>
          )}

          {/* Spec grid + seller */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="grid grid-cols-2 gap-px bg-line font-mono sm:grid-cols-4">
              {specs.map(([k, v]) => (
                <div key={k} className="bg-panel px-4 py-4">
                  <div className="text-[8px] uppercase tracking-[0.2em] text-muted">{k}</div>
                  <div className="mt-1 text-sm font-bold text-ink tabular">{v}</div>
                </div>
              ))}
            </div>
            <div className="panel flex flex-col justify-between gap-4 p-5">
              <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.18em]">
                <span className="flex items-center gap-1.5 border border-lume/50 px-2.5 py-1.5 text-lume">
                  <HeartPulse size={12} /> SOH {listing.soh} % gemessen
                </span>
                {listing.bidi && (
                  <span className="flex items-center gap-1.5 border border-lume/50 px-2.5 py-1.5 text-lume">
                    <PlugZap size={12} /> Bidirektional (V2X)
                  </span>
                )}
                <span className="flex items-center gap-1.5 border border-line px-2.5 py-1.5 text-muted">
                  <BatteryCharging size={12} /> {listing.battery} kWh
                </span>
                <span className="flex items-center gap-1.5 border border-line px-2.5 py-1.5 text-muted">
                  <Users size={12} /> {listing.seats} Sitze
                </span>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                  Anbieter
                </div>
                <div className="mt-1 text-base font-bold text-ink">{listing.seller}</div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-muted">
                  <MapPin size={11} className="text-signal" /> {listing.ort.toUpperCase()} ·{" "}
                  {listing.sellerType}
                </div>
              </div>
              <a
                href={href("/#beratung")}
                className="flex items-center justify-center gap-2 border border-line bg-nacht px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink transition-colors hover:border-signal hover:text-signal"
              >
                <CalendarClock size={12} /> Unsicher? Frag Gabriel
              </a>
            </div>
          </div>

          {/* Direct line to the seller — user-owned listings only */}
          <ContactSeller listing={listing} />
        </motion.div>
      </section>

      {/* Embedded engine — THIS car, YOUR context */}
      <section className="mt-16 border-t border-line bg-panel/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="font-mono text-xs tracking-[0.25em] text-signal">02</span>
            <span className="current-line w-10" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
              Rechenwerk für dieses Inserat — dein Tarif, dein Lade-Mix
            </span>
          </div>
          {reserved ? (
            <div className="panel border-warn/40 px-6 py-12 text-center">
              <p className="stretch-wide text-xl font-extrabold uppercase text-warn">
                Reserviert — Simulation pausiert.
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
                NUR OFFENE INSERATE LAUFEN IM RECHENWERK. ÄHNLICHE FAHRZEUGE AUF
                DER MARKT-TAFEL.
              </p>
            </div>
          ) : (
            <EngineCore listing={listing} />
          )}
        </div>
      </section>
    </>
  );
}
