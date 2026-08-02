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
import { useCantonTaxes } from "../../hooks/useCantonTaxes";
import { useFavorites } from "../../hooks/useFavorites";
import { useListings } from "../../hooks/useListings";
import { photoUrl } from "../../lib/supabase";
import { href } from "../../lib/url";
import {
  FUELS,
  MAINT_EV_PER_KM,
  MAINT_ICE_PER_KM,
  REF_WEIGHT_KG,
  cantonTaxFor,
  chAverageTax,
  currentCarEnergy,
} from "../../utils/costModel";
import { CARD_COMBOS, type Listing } from "../../data/evData";
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

  if (photos.length === 0) {
    return (
      <div className="card-flush grid aspect-[16/10] place-items-center bg-surface2">
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
      <div className="card-flush aspect-[16/10] overflow-hidden bg-surface2">
        <img
          src={photoUrl(photos[active])}
          alt={`${listing.brand} ${listing.model} — Foto ${active + 1} von ${photos.length}`}
          loading="eager"
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
  const {
    toggleCompare,
    compareIds,
    tariff,
    annualKm,
    currentFuel,
    currentCons,
    publicShare,
    gemeinde,
  } = useCockpit();
  const { favorites, toggleFavorite } = useFavorites();
  const { listings, active: activeListings, live } = useListings(all);
  const { taxes: cantonTaxes } = useCantonTaxes();
  const listing = listings.find((l) => l.id === slug) ?? (live ? undefined : initial);

  useEffect(() => {
    if (listing) {
      document.title = `${listing.brand} ${listing.model} — CHF ${fmtCH(listing.price)} | EV4U`;
    }
  }, [listing]);

  // Das Inseratsalter ist der einzige Wert, der zwischen vorgerendertem HTML
  // (Build-Snapshot) und Live-Daten auseinanderlaufen kann. Erst nach dem
  // Mount zeigen — sonst verwirft React beim Abgleich die ganze Insel.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Die Ersparnis für die Seitenleiste — dasselbe Modell wie im EngineCore,
     nur ohne die Aufschlüsselung. */
  const savings = useMemo(() => {
    if (!listing) return 0;
    const kwhYear = (annualKm / 100) * listing.consumption;
    const publicKwh = kwhYear * (publicShare / 100);
    const publicCost = Math.min(
      ...CARD_COMBOS.map(
        (c) => c.monthly * 12 + Math.max(0, publicKwh - c.inclKwh) * c.perKwh,
      ),
    );
    const evEnergy = (kwhYear - publicKwh) * tariff + publicCost;
    const isCurrentEv = currentFuel === "ELEKTRO";
    const maint = isCurrentEv ? 0 : annualKm * (MAINT_ICE_PER_KM - MAINT_EV_PER_KM);
    const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
    const taxCfg = (cantonCode && cantonTaxes[cantonCode]) || chAverageTax(cantonTaxes);
    const taxSaving = isCurrentEv
      ? 0
      : cantonTaxFor(listing.weightKg ?? REF_WEIGHT_KG, taxCfg).saving;
    return (
      currentCarEnergy(currentFuel, currentCons, annualKm, tariff) -
      evEnergy +
      maint +
      taxSaving
    );
  }, [listing, annualKm, publicShare, tariff, currentFuel, currentCons, gemeinde, cantonTaxes]);

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
      <div className="mx-auto max-w-[88rem] px-4 py-16 sm:px-6">
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
    ["Laden 10–80 %", `${listing.chargeMin} min`],
    ["DC-Spitze", `${listing.dcKw} kW`],
    ["Sitze", String(listing.seats)],
  ];

  return (
    <div className="mx-auto max-w-[88rem] animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
      <a
        href={href("/inserate")}
        className="inline-flex items-center gap-1.5 text-small text-fg2 transition-colors hover:text-fg"
      >
        <ArrowLeft size={14} aria-hidden /> Alle Inserate
      </a>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-display font-semibold text-fg">
          {listing.brand} {listing.model}
        </h1>
        {reserved ? (
          <Badge tone="caution">Reserviert</Badge>
        ) : (
          <Badge tone="positive">Verfügbar</Badge>
        )}
      </div>
      <p className="mt-1 text-body text-fg2">
        {listing.segment.toLowerCase()} ·{" "}
        {listing.sellerType === "GARAGE" ? "Garage" : "Privat"} · {listing.ort}
        {mounted && ` · eingestellt vor ${listing.postedDays} Tagen`}
      </p>

      {/* Galerie + Seitenleiste */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Gallery listing={listing} />

        <aside className="lg:sticky lg:top-32 lg:self-start">
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
                  <Heart size={15} fill={isFav ? "currentColor" : "none"} />
                  {isFav ? "Gemerkt" : "Merken"}
                </Button>
                <Button
                  onClick={() => toggleCompare(listing.id)}
                  disabled={reserved}
                  variant={inCompare ? "primary" : "secondary"}
                  size="sm"
                >
                  <GitCompareArrows size={15} />
                  {inCompare ? "Im Vergleich" : "Vergleichen"}
                </Button>
              </div>
            </div>

            {!reserved && (
              <a
                href="#kosten"
                className="mt-4 block rounded-card bg-accent/[0.08] px-4 py-3 transition-colors hover:bg-accent/[0.12]"
              >
                <span className="text-small text-fg2">
                  {savings >= 0 ? "Gegenüber deinem Auto sparst du" : "Gegenüber deinem Auto zahlst du"}
                </span>
                <span className="mt-0.5 block text-h2 font-semibold text-accent tabular">
                  CHF {fmtCH(Math.abs(savings))}
                  <span className="ml-1.5 text-small font-normal text-fg2">pro Jahr</span>
                </span>
                <span className="mt-1 block text-small text-fg3">
                  gegen deinen {FUELS[currentFuel].label} — Rechnung ansehen ↓
                </span>
              </a>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              <Badge tone="positive">
                <HeartPulse size={13} /> SOH {listing.soh} % gemessen
              </Badge>
              {listing.bidi && (
                <Badge tone="positive">
                  <PlugZap size={13} /> Bidirektional
                </Badge>
              )}
              <Badge>
                <BatteryCharging size={13} /> {listing.battery} kWh
              </Badge>
              <Badge>
                <Users size={13} /> {listing.seats} Sitze
              </Badge>
            </div>
          </div>
        </aside>
      </div>

      {/* Beschreibung, Daten, Rechnung, Anbieter */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="text-h2 font-semibold text-fg">Zu diesem Auto</h2>
            <p className="mt-2 max-w-prose text-body text-fg2">{listing.note}</p>

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

          <section id="kosten" className="scroll-mt-28">
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
        <div aria-hidden className="hidden lg:block" />
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
