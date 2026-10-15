import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BatteryCharging,
  Building2,
  CalendarDays,
  Check,
  Flag,
  GitCompareArrows,
  Gauge,
  Heart,
  MapPin,
  Minus,
  PlugZap,
  Route,
  Share2,
  ShieldCheck,
  Timer,
  User,
  X,
  Zap,
} from "lucide-react";
import Gallery from "../listing/Gallery";
import CostBreakdown from "../listing/CostBreakdown";
import Financing, { useFinancing } from "../listing/Financing";
import ContactSheet, { contactState, type Intent } from "../listing/ContactSheet";
import ReportSheet from "../listing/ReportSheet";
import ListingCard from "../listing/ListingCard";
import SaveSearch from "../search/SaveSearch";
import {
  Badge,
  Breadcrumbs,
  Button,
  ChargeBar,
  Chip,
  Disclosure,
  EmptyState,
  LinkButton,
  Notice,
  SpecItem,
} from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { useMerkliste } from "../../hooks/useMerkliste";
import { useSession } from "../../hooks/useSession";
import { filterParams } from "../../lib/filters";
import {
  DRIVE_LABEL,
  EQUIPMENT_ITEMS,
  HOME_CHARGERS,
  belowNewPct,
  chemistryNote,
  fmtDuration,
  fmtMonth,
  homeChargeHours,
  acPower,
  isHighVoltage,
  modelPath,
  placeOf,
  responseLabel,
  warrantyActive,
  warrantyText,
} from "../../lib/listingFacts";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { fetchListingsBySlugs } from "../../stores/listings";
import { SEGMENT_LABEL, SELLER_LABEL, brandName, daysAgo, fmtDate, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /inserat/[slug] (Konzept v3 §4.3) — answer every pre-contact question on
   one page, then make contact easy.

   Left: gallery, key facts, sticky section tabs, then Übersicht · Batterie
   & Garantie · Alltag · Laden · Kosten · Ausstattung & Zustand · Technische
   Daten · Anbieter, similar cars and the page footer (ID, online since,
   saves, report, safety). Right: the sticky buy box with price, Betrieb,
   financing, both CTAs, save/compare/share and the seller summary — a
   bottom bar on the phone.

   Sold cars and cars listed after the last build are not in the build
   snapshot; they load by slug (404 fallback, Merkliste links).
   ============================================================================ */

const SECTIONS = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "batterie", label: "Batterie" },
  { id: "alltag", label: "Alltag" },
  { id: "laden", label: "Laden" },
  { id: "kosten", label: "Kosten" },
  { id: "ausstattung", label: "Ausstattung" },
  { id: "anbieter", label: "Anbieter" },
] as const;

export default function ListingPage({
  slug,
  initial,
  all,
}: {
  slug: string;
  /** Build snapshot of this listing — carries the prerendered page. */
  initial?: Listing;
  /** Build snapshot of the whole stock, adopted by the store first. */
  all?: Listing[];
}) {
  const { listings, live } = useListings(all);
  const [fetched, setFetched] = useState<Listing | null | undefined>(undefined);
  const fromStore = listings.find((l) => l.id === slug);
  const listing = fromStore ?? fetched ?? (live ? undefined : initial);

  // Not in the store once it is live: sold, hidden, or newer than the build.
  useEffect(() => {
    if (!live || fromStore || fetched !== undefined) return;
    void fetchListingsBySlugs([slug]).then((rows) => setFetched(rows?.[0] ?? null));
  }, [live, fromStore, fetched, slug]);

  if (!listing) {
    if (live && fetched === undefined) {
      return <div className="mx-auto min-h-[60vh] max-w-page px-4 py-16 sm:px-6" aria-busy="true" />;
    }
    return (
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6">
        <EmptyState title="Dieses Inserat gibt es nicht mehr." hint="Zurückgezogen, oder die Adresse stimmt nicht.">
          <LinkButton href={href("/inserate")} variant="primary" size="sm">
            Zu allen Inseraten
          </LinkButton>
        </EmptyState>
      </div>
    );
  }
  return <ListingView listing={listing} stock={listings} />;
}

function ListingView({ listing: l, stock }: { listing: Listing; stock: Listing[] }) {
  const { session } = useSession();
  const { chargeKw, setChargeKw, compareIds, toggleCompare } = useCockpit();
  const merkliste = useMerkliste();
  const forSale = useMemo(() => stock.filter((x) => x.status !== "VERKAUFT"), [stock]);
  const market = useMarket(useMemo(() => [l, ...forSale.filter((x) => x.id !== l.id)], [l, forSale]));
  const monthly = market.monthly.get(l.id) ?? null;
  const distance = market.distance.get(l.id) ?? null;
  const fin = useFinancing(l.price);

  const [contact, setContact] = useState<{ intent?: Intent } | null>(null);
  const [report, setReport] = useState(false);
  const [shared, setShared] = useState(false);
  const [saves, setSaves] = useState<number | null>(null);
  const [response, setResponse] = useState<number | null>(null);
  const [backHref, setBackHref] = useState(href("/inserate"));

  const title = vehicleTitle(l);
  const contactable = contactState(l, session?.user.id);
  const sold = l.status === "VERKAUFT";
  const saved = merkliste.has(l.id);
  const inCompare = compareIds.includes(l.id);
  const discount = belowNewPct(l);

  useEffect(() => {
    document.title = `${title} — CHF ${fmtCH(l.price)} | EV4U`;
    // «Zurück zu den Ergebnissen» keeps the visitor's filters.
    if (document.referrer.includes("/inserate")) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin === location.origin) setBackHref(ref.pathname + ref.search);
      } catch {
        /* keep the default */
      }
    }
    const sp = new URLSearchParams(location.search);
    if (sp.get("kontakt") === "1") {
      sp.delete("kontakt");
      history.replaceState(null, "", `${location.pathname}${sp.size ? `?${sp}` : ""}`);
      setContact({});
    }
  }, [l.id, l.price, title]);

  // One VIEW per listing and browser session; the public save count; the
  // seller's response time.
  useEffect(() => {
    if (!supabase || !l.uid || l.isDemo) return;
    const key = `ev4u.viewed.${l.uid}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        void supabase.rpc("track_listing_event", { p_listing: l.uid, p_kind: "VIEW" });
      }
    } catch {
      /* private mode: no tracking, nothing else changes */
    }
    void supabase.rpc("listing_save_count", { p_listing: l.uid }).then(({ data }) => {
      if (typeof data === "number") setSaves(data);
    });
    if (l.owner) {
      void supabase.rpc("seller_response_minutes", { p_owner: l.owner }).then(({ data }) => {
        if (typeof data === "number") setResponse(data);
      });
    }
  }, [l.uid, l.owner, l.isDemo]);

  const share = async () => {
    const url = location.href.split("?")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — CHF ${fmtCH(l.price)}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* dismissed */
    }
  };

  const similar = useMemo(
    () =>
      forSale
        .filter((x) => x.id !== l.id)
        .map((x) => ({
          x,
          score:
            (x.modelSlug && x.modelSlug === l.modelSlug ? 0 : 1) +
            (x.segment === l.segment ? 0 : 2) +
            Math.abs(x.price - l.price) / Math.max(l.price, 1),
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 4)
        .map((s) => s.x),
    [forSale, l],
  );

  const brandHref = `${href("/inserate")}?${filterParams({ marke: brandName(l.brand) })}`;
  const crumbs = [
    { label: "Start", href: href("/") },
    { label: "Inserate", href: href("/inserate") },
    { label: brandName(l.brand), href: brandHref },
    {
      label: title.replace(`${brandName(l.brand)} `, ""),
      href: l.modelSlug ? href(modelPath(l.modelSlug)) : undefined,
    },
  ];

  const openContact = (intent?: Intent) => setContact({ intent });
  const isMine = contactable === "mine";

  /* ---------- Buy box ---------- */
  const buyBox = (
    <div className="card p-5">
      <p className="text-small text-fg2">
        {l.year} · {fmtCH(l.km)} km · {SELLER_LABEL[l.sellerType]}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="text-display font-bold text-fg tabular">CHF {fmtCH(l.price)}</span>
        {l.previousPrice && (
          <span className="text-body text-fg3 line-through tabular">CHF {fmtCH(l.previousPrice)}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-small text-fg2">
        {l.negotiable && <span>Verhandlungsbasis</span>}
        {discount !== null && (
          <span>
            Neupreis CHF {fmtCH(l.priceNew!)} · <span className="font-semibold text-accent">−{discount} %</span>
          </span>
        )}
      </div>

      {!sold && monthly !== null && (
        <a href="#kosten" className="mt-4 flex items-center justify-between gap-3 rounded-control bg-faint px-3 py-2.5 hover:bg-soft">
          <span className="text-small text-fg2">Betrieb für dich</span>
          <span className="text-body font-bold text-fg tabular">≈ CHF {fmtCH(monthly)}/Mt. →</span>
        </a>
      )}
      {!sold && (
        <a href="#finanzierung" className="mt-2 flex items-center justify-between gap-3 rounded-control px-3 py-1.5 hover:bg-surface2">
          <span className="text-small text-fg2">Finanziert ({fin.months} Mt., Beispiel)</span>
          <span className="text-small font-semibold text-fg tabular">CHF {fmtCH(fin.result.monthly)}/Mt.</span>
        </a>
      )}

      <div className="mt-4 space-y-2">
        {isMine ? (
          <LinkButton href={`${href("/verkaufen/neu")}?id=${l.uid}`} variant="primary" className="w-full">
            Dein Inserat bearbeiten
          </LinkButton>
        ) : contactable === "open" ? (
          <>
            <Button variant="primary" className="w-full" onClick={() => openContact()}>
              Nachricht senden
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => openContact("probefahrt")}>
              Probefahrt anfragen
            </Button>
          </>
        ) : contactable === "demo" ? (
          <Notice>Demo-Inserat — hinter diesem Auto steht kein Anbieter.</Notice>
        ) : contactable === "sold" ? (
          <Notice>Verkauft. Ähnliche Autos findest du weiter unten.</Notice>
        ) : (
          <Notice>
            Dieses Inserat führt EV4U selbst — schreib an{" "}
            <a href="mailto:hallo@ev4u.ch" className="link">
              hallo@ev4u.ch
            </a>
            .
          </Notice>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button variant={saved ? "primary" : "secondary"} size="sm" onClick={() => merkliste.toggle(l)} aria-pressed={saved}>
            <Heart size={15} fill={saved ? "currentColor" : "none"} aria-hidden />
            {saved ? "Gemerkt" : "Merken"}
          </Button>
          <Button
            variant={inCompare ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleCompare(l.id)}
            disabled={sold}
            aria-pressed={inCompare}
          >
            <GitCompareArrows size={15} aria-hidden />
            {inCompare ? "Im Vergleich" : "Vergleich"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            <Share2 size={15} aria-hidden />
            {shared ? "Kopiert" : "Teilen"}
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <SellerSummary listing={l} response={response} distance={distance} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 pb-28 pt-5 sm:px-6 md:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-small font-semibold text-fg2 hover:text-fg">
          <ArrowLeft size={15} aria-hidden /> Zurück zu den Ergebnissen
        </a>
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="mt-4">
        <h1 className="text-display font-bold text-fg">{title}</h1>
        <p className="mt-0.5 text-body text-fg2">
          {l.variant && <>{l.variant} · </>}
          {SEGMENT_LABEL[l.segment]} · {placeOf(l)}
          {distance !== null && <> · {distance} km von dir</>}
        </p>
      </div>

      {sold && (
        <Notice tone="caution" className="mt-4">
          Dieses Auto ist verkauft. Die Angaben bleiben zum Nachschlagen stehen.
        </Notice>
      )}
      {l.isDemo && (
        <Notice className="mt-4">
          Demo-Inserat: Dieses Auto zeigt, wie EV4U funktioniert. Es steht nicht zum Verkauf — Preis, Anbieter und Ort
          sind erfunden, die technischen Daten und die Garantie stammen aus dem Fahrzeugkatalog.
        </Notice>
      )}

      <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Gallery listing={l} />
          <KeyFacts listing={l} />
          <SectionTabs />

          <Section id="uebersicht" title="Beschreibung">
            {l.note ? (
              <p className="max-w-prose whitespace-pre-line text-body text-fg">{l.note}</p>
            ) : (
              <p className="text-body text-fg3">Der Anbieter hat keine Beschreibung geschrieben.</p>
            )}
          </Section>

          <Section id="batterie" title="Batterie & Garantie">
            <BatterySection listing={l} />
          </Section>

          <Section id="alltag" title="Alltag">
            <EverydaySection listing={l} />
          </Section>

          <Section id="laden" title="Laden">
            <ChargingSection listing={l} chargeKw={chargeKw} setChargeKw={setChargeKw} />
          </Section>

          <Section id="kosten" title="Kosten pro Jahr">
            {sold ? <p className="text-body text-fg2">Für verkaufte Autos rechnen wir nicht mehr.</p> : <CostBreakdown listing={l} />}
            {!sold && (
              <div id="finanzierung" className="mt-8 scroll-mt-32 border-t border-line pt-6">
                <h3 className="text-h3 font-bold text-fg">Finanzierung</h3>
                <p className="mb-4 mt-1 text-body text-fg2">Was das Auto pro Monat kostet, wenn du es finanzierst.</p>
                <Financing price={l.price} betrieb={monthly} state={fin} />
              </div>
            )}
          </Section>

          <Section id="ausstattung" title="Ausstattung & Zustand">
            <EquipmentSection listing={l} />
          </Section>

          <Section id="technik" title="Technische Daten">
            <TechSection listing={l} />
          </Section>

          {(l.priceHistory?.length ?? 0) > 1 && (
            <Section id="preis" title="Preisverlauf">
              <PriceHistory listing={l} />
            </Section>
          )}

          {l.modelSlug && (
            <Section id="modell" title="Das Modell">
              <p className="max-w-prose text-body text-fg2">
                Alle Varianten, Daten und Occasionen von {title} — mit den Garantiebedingungen des Herstellers.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <LinkButton href={href(modelPath(l.modelSlug))} variant="secondary" size="sm">
                  Zum Modell {title}
                </LinkButton>
                <SaveSearch
                  params={filterParams({ marke: brandName(l.brand), modell: l.modelSlug }).toString()}
                  label={`${title} Occasionen`}
                  compact={false}
                />
              </div>
            </Section>
          )}

          <Section id="anbieter" title="Anbieter">
            <SellerSummary listing={l} response={response} distance={distance} large />
          </Section>

          <footer className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-small text-fg3">
            <span>Inserat-Nr. {(l.uid ?? l.id).slice(0, 8).toUpperCase()}</span>
            <span>{l.createdAt ? `Online seit ${fmtDate(l.createdAt)}` : `Online ${daysAgo(l.postedDays)}`}</span>
            {saves !== null && saves > 0 && <span>{saves}× gemerkt</span>}
            <button type="button" onClick={() => setReport(true)} className="inline-flex items-center gap-1 hover:text-fg">
              <Flag size={13} aria-hidden /> Inserat melden
            </button>
            <a href={href("/sicherheit")} className="inline-flex items-center gap-1 hover:text-fg">
              <ShieldCheck size={13} aria-hidden /> Sicher kaufen
            </a>
            <a href={`${href("/beratung")}?inserat=${encodeURIComponent(l.id)}`} className="hover:text-fg">
              Unsicher? Frag Gabriel
            </a>
          </footer>
        </div>

        <aside className="hidden lg:sticky lg:top-20 lg:block" aria-label="Preis und Kontakt">
          {buyBox}
        </aside>
      </div>

      {/* Below lg the buy box follows the content, and price plus contact
          ride in a bar above the tab bar. */}
      <div className="mt-8 lg:hidden">{buyBox}</div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h2 font-bold text-fg">Ähnliche Inserate</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((x) => (
              <ListingCard key={x.id} listing={x} monthly={market.monthly.get(x.id)} distance={market.distance.get(x.id)} />
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-md md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-page items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-h3 font-bold text-fg tabular">CHF {fmtCH(l.price)}</div>
            {monthly !== null && !sold && (
              <div className="text-small text-fg2 tabular">≈ CHF {fmtCH(monthly)}/Mt. Betrieb</div>
            )}
          </div>
          {contactable === "open" && (
            <Button variant="primary" onClick={() => openContact()}>
              Nachricht
            </Button>
          )}
          {isMine && (
            <LinkButton href={`${href("/verkaufen/neu")}?id=${l.uid}`} variant="primary">
              Bearbeiten
            </LinkButton>
          )}
        </div>
      </div>

      {contact && <ContactSheet listing={l} intent={contact.intent} onClose={() => setContact(null)} />}
      {report && <ReportSheet listing={l} onClose={() => setReport(false)} />}
    </div>
  );
}

/* ---------- Layout pieces -------------------------------------------------- */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-line py-8 last:border-b-0">
      <h2 className="mb-4 text-h2 font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

/** Anchor tabs, sticky under the header; the visible section is marked. */
function SectionTabs() {
  const [active, setActive] = useState<string>("uebersicht");
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-130px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <nav
      aria-label="Abschnitte"
      className="no-scrollbar sticky top-16 z-30 -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line bg-canvas/95 px-4 backdrop-blur-md sm:mx-0 sm:px-0"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "true" : undefined}
          className={`shrink-0 border-b-2 px-3 py-3 text-small font-semibold transition-colors ${
            active === s.id ? "border-accent text-fg" : "border-transparent text-fg2 hover:text-fg"
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

function KeyFacts({ listing: l }: { listing: Listing }) {
  return (
    <div className="card mt-4 grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:p-5">
      <SpecItem icon={<CalendarDays size={18} />} value={l.year} label="Erstzulassung" />
      <SpecItem icon={<Gauge size={18} />} value={`${fmtCH(l.km)} km`} label="Kilometerstand" />
      <SpecItem icon={<Route size={18} />} value={`${fmtCH(l.range)} km`} label="Reichweite WLTP" />
      <SpecItem icon={<BatteryCharging size={18} />} value={`${fmtCH(l.battery, l.battery % 1 ? 1 : 0)} kWh · SOH ${l.soh} %`} label="Batterie netto" />
      <SpecItem
        icon={<Timer size={18} />}
        value={l.dcKw ? `${l.dcKw} kW${l.chargeMin ? ` · ${l.chargeMin} min` : ""}` : "nur AC"}
        label={l.dcKw ? "DC-Laden, 10–80 %" : "Schnellladen"}
      />
      <SpecItem
        icon={<Zap size={18} />}
        value={l.spec ? `${DRIVE_LABEL[l.spec.drive]}${l.spec.powerKw ? ` · ${l.spec.powerKw} kW` : ""}` : `${l.seats} Sitze`}
        label={l.spec ? "Antrieb" : "Sitze"}
      />
    </div>
  );
}

/* ---------- Sections ------------------------------------------------------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-body text-fg2">{label}</dt>
      <dd className="text-right text-body font-semibold text-fg tabular">{children}</dd>
    </div>
  );
}

function BatterySection({ listing: l }: { listing: Listing }) {
  const usable = (l.battery * l.soh) / 100;
  const w = l.warranty;
  const active = warrantyActive(l);
  const note = l.spec ? chemistryNote(l.spec.chemistry) : null;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-small font-semibold text-fg2">Batteriezustand (SOH)</span>
          <span className="text-h2 font-bold text-fg tabular">{l.soh} %</span>
        </div>
        <ChargeBar value={l.soh} min={50} label={`Batteriezustand ${l.soh} %`} className="mt-2 h-2.5" />
        <p className="mt-2 text-small text-fg2">
          Angabe des Anbieters. Heute nutzbar: <strong className="text-fg tabular">≈ {fmtCH(usable, 1)} kWh</strong> von{" "}
          {fmtCH(l.battery, 1)} kWh — rund {fmtCH((l.range * l.soh) / 100)} km WLTP.
        </p>
        {note && <p className="mt-3 rounded-control bg-surface2 px-3 py-2.5 text-small text-fg2">{note}</p>}
      </div>
      <div>
        <span className="text-small font-semibold text-fg2">Batteriegarantie</span>
        {w && (w.until || w.km) ? (
          <>
            <p className={`mt-1 text-h3 font-bold ${active ? "text-accent" : "text-fg"}`}>
              {active ? "Läuft" : "Abgelaufen"}: {warrantyText(w)}
            </p>
            <p className="mt-1 text-small text-fg2">
              Angabe des Anbieters. Lass dir die Bedingungen des Herstellers zeigen — sie gelten meist auch für
              Folgebesitzer.
            </p>
          </>
        ) : (
          <p className="mt-1 text-body text-fg2">
            Keine Angabe. Frag nach: viele Hersteller garantieren 8 Jahre oder 160'000 km auf die Batterie.
          </p>
        )}
        {l.spec && (
          <dl className="mt-3">
            <Row label="Zellchemie">{l.spec.chemistry}</Row>
            <Row label="Systemspannung">{l.spec.voltage} V</Row>
            {l.spec.batteryGross && <Row label="Brutto">{fmtCH(l.spec.batteryGross, 1)} kWh</Row>}
          </dl>
        )}
      </div>
    </div>
  );
}

function EverydaySection({ listing: l }: { listing: Listing }) {
  const s = l.spec;
  return (
    <dl className="grid gap-x-8 md:grid-cols-2">
      <Row label="Sitze">{l.seats}</Row>
      <Row label="Kofferraum">
        {s?.trunkL ? `${fmtCH(s.trunkL)} l${s.frunkL ? ` + ${fmtCH(s.frunkL)} l vorne` : ""}` : "—"}
      </Row>
      <Row label="Anhängelast">{s?.towingKg ? `${fmtCH(s.towingKg)} kg` : s ? "nicht zugelassen" : "—"}</Row>
      <Row label="Länge × Breite × Höhe">
        {s?.lengthMm && s.widthMm && s.heightMm
          ? `${fmtCH(s.lengthMm / 1000, 2)} × ${fmtCH(s.widthMm / 1000, 2)} × ${fmtCH(s.heightMm / 1000, 2)} m`
          : "—"}
      </Row>
      <Row label="Strom abgeben (V2L)">{l.bidi ? "Ja" : "Nein"}</Row>
      <Row label="Gewicht">{l.weightKg ? `${fmtCH(l.weightKg)} kg` : "—"}</Row>
    </dl>
  );
}

function ChargingSection({
  listing: l,
  chargeKw,
  setChargeKw,
}: {
  listing: Listing;
  chargeKw: number;
  setChargeKw: (v: number) => void;
}) {
  const hours = homeChargeHours(l, chargeKw);
  const effective = acPower(l, chargeKw);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <span className="text-small font-semibold text-fg2">Zuhause, 20 → 80 %</span>
        <p className="mt-1 text-display font-bold text-fg tabular">{fmtDuration(hours)}</p>
        <p className="text-small text-fg2">
          mit {fmtCH(effective, 1)} kW
          {effective < chargeKw && ` — das Auto lädt mit AC höchstens ${fmtCH(effective, 1)} kW`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Deine Lademöglichkeit">
          {HOME_CHARGERS.map((c) => (
            <Chip key={c.kw} active={chargeKw === c.kw} onClick={() => setChargeKw(c.kw)}>
              {c.label} {c.kw !== 11 && c.kw !== 22 ? `· ${c.hint}` : ""}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <span className="text-small font-semibold text-fg2">Schnelllader, 10 → 80 %</span>
        {l.dcKw ? (
          <>
            <p className="mt-1 text-display font-bold text-fg tabular">{l.chargeMin ? `${l.chargeMin} min` : "—"}</p>
            <p className="text-small text-fg2">
              bis {l.dcKw} kW{l.spec && ` · ${l.spec.voltage} V`}
              {isHighVoltage(l) && " — lädt an 800-V-Säulen mit voller Leistung"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-body text-fg2">Kein Schnellladen — dieses Auto lädt nur mit Wechselstrom.</p>
        )}
        <dl className="mt-3">
          <Row label="Anschluss">{l.spec?.chargePort ?? "—"}</Row>
          <Row label="AC an Bord">{l.spec ? `${fmtCH(l.spec.acKw, 1)} kW` : "—"}</Row>
          <Row label="Strom abgeben">
            {l.bidi ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <PlugZap size={15} aria-hidden /> V2L
              </span>
            ) : (
              "Nein"
            )}
          </Row>
        </dl>
      </div>
    </div>
  );
}

function Tick({ value }: { value: boolean | undefined }) {
  if (value === undefined) return <Minus size={16} aria-label="keine Angabe" className="text-fg3" />;
  return value ? <Check size={16} aria-label="ja" className="text-accent" /> : <X size={16} aria-label="nein" className="text-fg3" />;
}

function EquipmentSection({ listing: l }: { listing: Listing }) {
  const e = l.equipment ?? {};
  const c = l.condition ?? {};
  const stated = EQUIPMENT_ITEMS.some((i) => e[i.key] !== undefined);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-h3 font-bold text-fg">Ausstattung</h3>
        {stated ? (
          <ul className="grid gap-1.5">
            {EQUIPMENT_ITEMS.map((i) => (
              <li key={i.key} className={`flex items-center gap-2 text-body ${e[i.key] ? "text-fg" : "text-fg3"}`}>
                <Tick value={e[i.key]} />
                {i.label}
              </li>
            ))}
            {e.color && <li className="mt-1 text-body text-fg2">Farbe: {e.color}</li>}
          </ul>
        ) : (
          <p className="text-body text-fg2">Keine Angaben zur Ausstattung.</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-h3 font-bold text-fg">Zustand</h3>
        <dl>
          <Row label="Unfallfrei">{c.accidentFree === undefined ? "—" : c.accidentFree ? "Ja" : "Nein"}</Row>
          <Row label="Vorbesitzer">{c.owners ?? "—"}</Row>
          <Row label="Letzte MFK">{c.mfk ? fmtMonth(c.mfk) : "—"}</Row>
          <Row label="Serviceheft">{c.serviceBook === undefined ? "—" : c.serviceBook ? "Lückenlos" : "Nein"}</Row>
          <Row label="Fahrzeuggarantie">{c.warrantyUntil ? `bis ${fmtMonth(c.warrantyUntil)}` : "—"}</Row>
        </dl>
        <p className="mt-2 text-micro text-fg3">Alle Angaben vom Anbieter.</p>
      </div>
    </div>
  );
}

function TechSection({ listing: l }: { listing: Listing }) {
  const s = l.spec;
  const groups: { title: string; rows: [string, string | null][] }[] = [
    {
      title: "Antrieb",
      rows: [
        ["Antrieb", s ? DRIVE_LABEL[s.drive] : null],
        ["Leistung", s?.powerKw ? `${s.powerKw} kW${s.powerPs ? ` (${s.powerPs} PS)` : ""}` : null],
        ["0–100 km/h", s?.accel ? `${fmtCH(s.accel, 1)} s` : null],
        ["Höchstgeschwindigkeit", s?.topSpeed ? `${s.topSpeed} km/h` : null],
      ],
    },
    {
      title: "Batterie & Verbrauch",
      rows: [
        ["Batterie netto", `${fmtCH(l.battery, 1)} kWh`],
        ["Batterie brutto", s?.batteryGross ? `${fmtCH(s.batteryGross, 1)} kWh` : null],
        ["Verbrauch", `${fmtCH(l.consumption, 1)} kWh/100 km`],
        ["Reichweite WLTP", `${fmtCH(l.range)} km`],
        ["Zellchemie", s?.chemistry ?? null],
        ["Systemspannung", s ? `${s.voltage} V` : null],
      ],
    },
    {
      title: "Laden",
      rows: [
        ["DC max.", l.dcKw ? `${l.dcKw} kW` : "—"],
        ["DC 10–80 %", l.chargeMin ? `${l.chargeMin} min` : null],
        ["AC max.", s ? `${fmtCH(s.acKw, 1)} kW` : null],
        ["Anschluss", s?.chargePort ?? null],
      ],
    },
    {
      title: "Masse & Gewicht",
      rows: [
        ["Länge", s?.lengthMm ? `${fmtCH(s.lengthMm)} mm` : null],
        ["Breite", s?.widthMm ? `${fmtCH(s.widthMm)} mm` : null],
        ["Höhe", s?.heightMm ? `${fmtCH(s.heightMm)} mm` : null],
        ["Leergewicht", l.weightKg ? `${fmtCH(l.weightKg)} kg` : null],
        ["Kofferraum", s?.trunkL ? `${fmtCH(s.trunkL)} l` : null],
        ["Frunk", s?.frunkL ? `${fmtCH(s.frunkL)} l` : null],
        ["Anhängelast", s?.towingKg ? `${fmtCH(s.towingKg)} kg` : null],
        ["Sitze", String(l.seats)],
      ],
    },
  ];
  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
      {groups.map((g, i) => {
        const rows = g.rows.filter((r): r is [string, string] => r[1] !== null);
        if (rows.length === 0) return null;
        return (
          <Disclosure key={g.title} summary={g.title} open={i < 2} className="border-b border-line py-2">
            <dl>
              {rows.map(([k, v]) => (
                <Row key={k} label={k}>
                  {v}
                </Row>
              ))}
            </dl>
          </Disclosure>
        );
      })}
      {!s && (
        <p className="text-small text-fg3 md:col-span-2">
          Dieses Auto wurde ohne Katalog-Variante erfasst — die Daten oben stammen vom Anbieter.
        </p>
      )}
    </div>
  );
}

function PriceHistory({ listing: l }: { listing: Listing }) {
  const h = l.priceHistory ?? [];
  return (
    <ol className="space-y-1.5">
      {[...h].reverse().map((p, i, arr) => {
        const prev = arr[i + 1];
        const diff = prev ? p.price - prev.price : 0;
        return (
          <li key={p.at} className="flex items-baseline justify-between gap-4 text-body">
            <span className="text-fg2">{fmtDate(p.at)}</span>
            <span className="flex items-baseline gap-3">
              {diff !== 0 && (
                <span className={`text-small font-semibold tabular ${diff < 0 ? "text-accent" : "text-caution"}`}>
                  {diff < 0 ? "−" : "+"}
                  {fmtCH(Math.abs(diff))}
                </span>
              )}
              <span className="font-semibold text-fg tabular">CHF {fmtCH(p.price)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SellerSummary({
  listing: l,
  response,
  distance,
  large = false,
}: {
  listing: Listing;
  response: number | null;
  distance: number | null;
  large?: boolean;
}) {
  const garage = l.sellerType === "GARAGE";
  const responseText = responseLabel(response);
  return (
    <div className={large ? "flex flex-wrap items-start justify-between gap-4" : ""}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-fg2">
          {garage ? <Building2 size={18} aria-hidden /> : <User size={18} aria-hidden />}
        </span>
        <div className="min-w-0 text-small">
          <div className="flex flex-wrap items-center gap-2 text-body font-semibold text-fg">
            {l.seller}
            <Badge>{SELLER_LABEL[l.sellerType]}</Badge>
          </div>
          {l.sellerVerified && (
            <div className="mt-0.5 flex items-center gap-1 text-accent">
              <BadgeCheck size={14} aria-hidden /> Garage geprüft (Handelsregister)
            </div>
          )}
          {responseText && <div className="mt-0.5 text-fg2">{responseText}</div>}
          <div className="mt-0.5 flex items-center gap-1 text-fg2">
            <MapPin size={13} aria-hidden className="text-fg3" />
            {l.ort}
            {distance !== null && <span className="tabular">· {distance} km</span>}
          </div>
        </div>
      </div>
      {large && garage && l.sellerSlug && (
        <LinkButton href={href(`/garagen/${l.sellerSlug}`)} variant="secondary" size="sm">
          Alle Autos dieser Garage
        </LinkButton>
      )}
      {!large && garage && l.sellerSlug && (
        <a href={href(`/garagen/${l.sellerSlug}`)} className="link mt-2 inline-block text-small font-semibold">
          Profil und alle Autos →
        </a>
      )}
    </div>
  );
}
