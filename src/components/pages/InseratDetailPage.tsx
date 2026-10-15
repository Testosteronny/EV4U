import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BatteryCharging,
  GitCompareArrows,
  Heart,
  HeartPulse,
  PlugZap,
  Users,
} from "lucide-react";
import CarGraphic from "../CarGraphic";
import ContactSeller from "../ContactSeller";
import EngineCore from "../EngineCore";
import ListingCard from "../ListingCard";
import { Badge, Button, EmptyState, LinkButton } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useCosts } from "../../hooks/useCosts";
import { useFavorites } from "../../hooks/useFavorites";
import { useListings } from "../../hooks/useListings";
import { photoUrl } from "../../lib/supabase";
import { href } from "../../lib/url";
import { FUELS } from "../../utils/costModel";
import { SEGMENT_LABEL, SELLER_LABEL, vehicleTitle } from "../../utils/format";
import { type Listing } from "../../data/evData";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /inserat/:id — ein Inserat, eine Seite.

   Neue Reihenfolge: Galerie und Preis/Kontakt zuerst, dann Beschreibung,
   Daten, Kostenrechnung, Anbieter, ähnliche Inserate. Vorher stand das Foto
   an vierter Stelle und die Kontaktaufnahme fast am Ende — auf einem
   Marktplatz genau verkehrt herum.
   ============================================================================ */

function Gallery({ listing }: { listing: Listing }) {
  const photos = listing.photos ?? [];
  const [active, setActive] = useState(0);
  const title = vehicleTitle(listing);

  if (photos.length === 0) {
    return (
      <div className="card-flush grid aspect-16/10 place-items-center bg-surface2">
        <div className="p-6 text-center">
          <CarGraphic
            segment={listing.segment}
            detailed
            className="mx-auto h-28 w-auto text-fg3 sm:h-36"
          />
          <p className="mx-auto mt-4 max-w-prose text-small text-fg3">
            Noch keine Fotos hochgeladen — die Zeichnung zeigt die
            Karosserieform. Die technischen Daten unten gelten unabhängig davon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card-flush aspect-16/10 overflow-hidden bg-surface2">
        <img
          src={photoUrl(photos[active])}
          alt={`${title} — Foto ${active + 1} von ${photos.length}`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p}
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1} anzeigen`}
              aria-pressed={i === active}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-chip border transition-colors ${
                i === active ? "border-accent" : "border-line hover:border-line2"
              }`}
            >
              <img
                src={photoUrl(p)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InseratDetailPage({
  slug,
  initial,
  all,
}: {
  slug: string;
  /** Build-Snapshot dieses Inserats — trägt die vorgerenderte Seite. */
  initial?: Listing;
  /** Build-Snapshot des ganzen Bestands. Muss der Store übernehmen, damit
   *  der erste Client-Render dieselben Daten sieht wie der Server (der
   *  gebündelte Seed weicht davon ab). */
  all?: Listing[];
}) {
  const { toggleCompare, compareIds, currentFuel } = useCockpit();
  const { favorites, toggleFavorite } = useFavorites();
  const { listings, active: activeListings, live } = useListings(all);
  const listing = listings.find((l) => l.id === slug) ?? (live ? undefined : initial);

  const title = listing ? vehicleTitle(listing) : "";

  useEffect(() => {
    if (listing) document.title = `${title} — CHF ${fmtCH(listing.price)} | EV4U`;
  }, [listing, title]);

  /* Dieselbe Rechnung wie im EngineCore weiter unten — buchstäblich dieselbe
     Funktion, damit die Kachel in der Seitenleiste der Aufschlüsselung
     darunter nie widersprechen kann. */
  const costs = useCosts(listing);

  const similar = useMemo(() => {
    if (!listing) return [];
    return activeListings
      .filter((l) => l.id !== listing.id)
      .map((l) => ({
        l,
        score:
          (l.segment === listing.segment ? 0 : 2) +
          Math.abs(l.price - listing.price) / Math.max(listing.price, 1),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map((x) => x.l);
  }, [activeListings, listing]);

  if (!listing) {
    return (
      <div className="mx-auto max-w-352 px-4 py-16 sm:px-6">
        <EmptyState
          title="Dieses Inserat gibt es nicht mehr."
          hint="Verkauft, zurückgezogen, oder die URL stimmt nicht."
        >
          <LinkButton href={href("/inserate")} variant="primary" size="sm">
            Zu allen Inseraten
          </LinkButton>
        </EmptyState>
      </div>
    );
  }

  const reserved = listing.status === "RESERVIERT";
  const inCompare = compareIds.includes(listing.id);
  const isFav = favorites.includes(listing.id);
  const savings = costs?.savings ?? 0;
  const cheaper = savings >= 0;
  const discount =
    listing.priceNew && listing.priceNew > listing.price
      ? Math.round((1 - listing.price / listing.priceNew) * 100)
      : null;

  const specs: [string, string][] = [
    ["Jahrgang", String(listing.year)],
    ["Kilometerstand", `${fmtCH(listing.km)} km`],
    ["WLTP-Reichweite", `${listing.range} km`],
    ["Verbrauch", `${listing.consumption.toFixed(1)} kWh/100 km`],
    ["Batterie netto", `${listing.battery} kWh`],
    ["Laden 10–80 %", listing.chargeMin !== null ? `${listing.chargeMin} min` : "—"],
    ["DC-Spitze", listing.dcKw !== null ? `${listing.dcKw} kW` : "—"],
    ["Sitze", String(listing.seats)],
  ];

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
      <a
        href={href("/inserate")}
        className="inline-flex items-center gap-1.5 text-small text-fg2 transition-colors hover:text-fg"
      >
        <ArrowLeft size={14} aria-hidden /> Alle Inserate
      </a>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-display font-semibold text-fg">{title}</h1>
        {listing.isDemo && <Badge tone="neutral">Demo</Badge>}
        {reserved ? (
          <Badge tone="caution">Reserviert</Badge>
        ) : (
          <Badge tone="positive">Verfügbar</Badge>
        )}
      </div>
      <p className="mt-1 text-body text-fg2">
        {listing.variant && <>{listing.variant} · </>}
        {SEGMENT_LABEL[listing.segment]} · {SELLER_LABEL[listing.sellerType]} ·{" "}
        {listing.ort} · eingestellt vor {listing.postedDays}{" "}
        {listing.postedDays === 1 ? "Tag" : "Tagen"}
      </p>
      {listing.isDemo && (
        <p className="mt-3 max-w-prose rounded-chip bg-surface2 px-3 py-2 text-small text-fg2">
          Demo-Inserat: Dieses Auto zeigt, wie EV4U funktioniert. Es steht
          nicht zum Verkauf — Preis, Anbieter und Ort sind erfunden, die
          technischen Daten stammen aus dem Fahrzeugkatalog.
        </p>
      )}

      {/* Galerie + Seitenleiste. Die Leiste bleibt beim Scrollen stehen, so
          lange die linke Spalte läuft — Preis und Kontakt sind immer da. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <Gallery listing={listing} />

          <section className="card p-5 sm:p-6">
            <h2 className="text-h2 font-semibold text-fg">Zu diesem Auto</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-body text-fg2">
              {listing.note}
            </p>

            <h3 className="mt-6 text-h3 font-semibold text-fg">Technische Daten</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
              {specs.map(([k, v]) => (
                <div key={k} className="border-t border-line py-2.5">
                  <dt className="text-small text-fg3">{k}</dt>
                  <dd className="text-body font-medium text-fg tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="kosten">
            {reserved ? (
              <EmptyState
                title="Reserviert — Rechnung pausiert."
                hint="Nur offene Inserate werden durchgerechnet. Ähnliche Fahrzeuge findest du unten."
              />
            ) : (
              <EngineCore listing={listing} />
            )}
          </section>

          <ContactSeller listing={listing} />
        </div>

        <aside className="lg:sticky lg:top-28">
          <div className="card p-5">
            <div className="text-display font-semibold text-fg tabular">
              CHF {fmtCH(listing.price)}
            </div>
            {discount !== null && (
              <p className="mt-1 text-small text-fg2">
                Neupreis CHF <span className="tabular">{fmtCH(listing.priceNew!)}</span> —{" "}
                <span className="font-medium text-accent">{discount} % günstiger</span>
              </p>
            )}

            <div className="mt-4 space-y-2">
              {/* Auch bei reservierten Inseraten erreichbar — «sag Bescheid,
                  falls es doch frei wird» ist eine legitime Anfrage. */}
              <LinkButton href="#kontakt" variant="primary" className="w-full">
                Anbieter kontaktieren
              </LinkButton>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => toggleFavorite(listing.id)}
                  variant={isFav ? "primary" : "secondary"}
                  size="sm"
                >
                  <Heart size={15} fill={isFav ? "currentColor" : "none"} aria-hidden />
                  {isFav ? "Gemerkt" : "Merken"}
                </Button>
                <Button
                  onClick={() => toggleCompare(listing.id)}
                  disabled={reserved}
                  variant={inCompare ? "primary" : "secondary"}
                  size="sm"
                  title={
                    reserved ? "Reservierte Inserate lassen sich nicht vergleichen" : undefined
                  }
                >
                  <GitCompareArrows size={15} aria-hidden />
                  {inCompare ? "Im Vergleich" : "Vergleichen"}
                </Button>
              </div>
            </div>

            {!reserved && costs && (
              <a
                href="#kosten"
                className={`mt-4 block rounded-card px-4 py-3 transition-colors ${
                  cheaper
                    ? "bg-accent/8 hover:bg-accent/12"
                    : "bg-caution/8 hover:bg-caution/12"
                }`}
              >
                <span className="text-small text-fg2">
                  {cheaper
                    ? "Gegenüber deinem Auto sparst du"
                    : "Gegenüber deinem Auto zahlst du"}
                </span>
                <span
                  className={`mt-0.5 block text-h2 font-semibold tabular ${
                    cheaper ? "text-accent" : "text-caution"
                  }`}
                >
                  CHF {fmtCH(Math.abs(savings))}
                  <span className="ml-1.5 text-small font-normal text-fg2">
                    {cheaper ? "pro Jahr" : "mehr pro Jahr"}
                  </span>
                </span>
                <span className="mt-1 block text-small text-fg3">
                  gegen deinen {FUELS[currentFuel].label} — Rechnung ansehen ↓
                </span>
              </a>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              <Badge tone="positive">
                <HeartPulse size={13} aria-hidden /> SOH {listing.soh} %
              </Badge>
              {listing.bidi && (
                <Badge tone="positive">
                  <PlugZap size={13} aria-hidden /> Bidirektional
                </Badge>
              )}
              <Badge>
                <BatteryCharging size={13} aria-hidden /> {listing.battery} kWh
              </Badge>
              <Badge>
                <Users size={13} aria-hidden /> {listing.seats} Sitze
              </Badge>
            </div>
          </div>
        </aside>
      </div>

      {/* Ähnliche Inserate — hält im Katalog, wenn dieses Auto nicht passt */}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h2 font-semibold text-fg">Ähnliche Inserate</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
