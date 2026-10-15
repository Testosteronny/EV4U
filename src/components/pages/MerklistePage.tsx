import { useEffect, useMemo, useRef, useState } from "react";
import { GitCompareArrows, Heart, Trash2 } from "lucide-react";
import { ListingPhoto } from "../listing/ListingCard";
import { Badge, Button, EmptyState, LinkButton, Notice, PageHeader } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useHydrated } from "../../hooks/useHydrated";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { useMerkliste } from "../../hooks/useMerkliste";
import { useSession } from "../../hooks/useSession";
import { placeOf } from "../../lib/listingFacts";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { MAX_COMPARE } from "../../stores/cockpit";
import { fetchListingsBySlugs } from "../../stores/listings";
import type { SavedCar } from "../../stores/merkliste";
import { daysAgo, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /merkliste (Konzept §4.5, F15) — saved cars, no login needed.

   Each car shows what changed since it was saved: price cut or rise,
   reserved, sold, or offline. A personal note per car. Select two to four
   and compare. Logged out, a banner explains what an account adds (all
   devices, e-mail on price changes); AccountSync merges on login.
   ============================================================================ */

type Change = { label: string; tone: "positive" | "caution" | "neutral" | "danger" } | null;

function changeOf(saved: SavedCar, l: Listing | null | undefined): Change {
  if (l === null) return { label: "Nicht mehr online", tone: "neutral" };
  if (!l) return null;
  if (l.status === "VERKAUFT") return { label: "Verkauft", tone: "neutral" };
  if (l.status === "RESERVIERT") return { label: "Reserviert", tone: "caution" };
  if (saved.price > 0 && l.price !== saved.price) {
    const d = l.price - saved.price;
    return d < 0
      ? { label: `Preis −${fmtCH(-d)}`, tone: "positive" }
      : { label: `Preis +${fmtCH(d)}`, tone: "danger" };
  }
  return null;
}

export default function MerklistePage({ initial }: { initial?: Listing[] }) {
  const hydrated = useHydrated();
  const { session, ready } = useSession();
  const { items, remove, setNote } = useMerkliste();
  const { listings, live } = useListings(initial);
  const { setCompareIds } = useCockpit();
  const [extra, setExtra] = useState<Map<string, Listing | null>>(new Map());
  const [selected, setSelected] = useState<string[]>([]);

  // Saved cars that are not in the for-sale store: sold, hidden or gone.
  const missing = useMemo(
    () => (live ? items.map((c) => c.slug).filter((s) => !listings.some((l) => l.id === s) && !extra.has(s)) : []),
    [items, listings, live, extra],
  );
  useEffect(() => {
    if (missing.length === 0) return;
    void fetchListingsBySlugs(missing).then((rows) => {
      if (!rows) return;
      setExtra((prev) => {
        const next = new Map(prev);
        for (const s of missing) next.set(s, rows.find((r) => r.id === s) ?? null);
        return next;
      });
    });
  }, [missing]);

  const resolved = items.map((c) => ({
    saved: c,
    // undefined: still loading; null: not visible any more (or no backend).
    listing: listings.find((l) => l.id === c.slug) ?? extra.get(c.slug) ?? (supabase ? undefined : null),
  }));
  const present = resolved.map((r) => r.listing).filter((l): l is Listing => Boolean(l));
  const market = useMarket(present);
  const comparable = (l: Listing | null | undefined) => Boolean(l && l.status !== "VERKAUFT");

  const toggleSelect = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : s.length >= MAX_COMPARE ? s : [...s, slug]));

  const compare = () => {
    setCompareIds(selected);
    window.location.href = href("/vergleich");
  };

  const crumbs = [{ label: "Start", href: href("/") }, { label: "Merkliste" }];
  const drops = resolved.filter((r) => r.listing && r.saved.price > r.listing.price).length;

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 pb-28 pt-8 sm:px-6 md:pb-10">
      <PageHeader
        crumbs={crumbs}
        title="Merkliste"
        lead={
          hydrated && items.length > 0
            ? `${items.length} ${items.length === 1 ? "Auto" : "Autos"}${drops > 0 ? ` · ${drops}× Preis gesenkt` : ""}`
            : undefined
        }
      />

      {hydrated && ready && !session && items.length > 0 && (
        <div className="tip mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-body text-fg">
            Melde dich an, um die Merkliste auf allen Geräten zu haben und bei Preisänderungen eine E-Mail zu bekommen.
          </p>
          <LinkButton href={`${href("/login")}?next=${encodeURIComponent(href("/merkliste"))}`} variant="secondary" size="sm">
            Anmelden
          </LinkButton>
        </div>
      )}

      {!hydrated ? (
        <div className="mt-8 min-h-[40vh]" aria-busy="true" />
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Heart size={22} aria-hidden />}
            title="Noch nichts gemerkt."
            hint="Tippe auf das Herz eines Inserats — es landet hier, auch ohne Konto. Wir zeigen dir, wenn sich der Preis ändert."
          >
            <LinkButton href={href("/inserate")} variant="primary" size="sm">
              Inserate ansehen
            </LinkButton>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {resolved.map(({ saved, listing }) => (
            <SavedRow
              key={saved.slug}
              saved={saved}
              listing={listing}
              monthly={listing ? market.monthly.get(listing.id) : undefined}
              selected={selected.includes(saved.slug)}
              canSelect={comparable(listing) && (selected.includes(saved.slug) || selected.length < MAX_COMPARE)}
              onSelect={() => toggleSelect(saved.slug)}
              onRemove={() => {
                remove(saved.slug);
                setSelected((s) => s.filter((x) => x !== saved.slug));
              }}
              onNote={(n) => setNote(saved.slug, n)}
            />
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:bottom-4">
          <div className="overlay-card mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-body text-fg">
              {selected.length} ausgewählt <span className="text-small text-fg3">(2–{MAX_COMPARE})</span>
            </span>
            <Button variant="primary" size="sm" disabled={selected.length < 2} onClick={compare}>
              <GitCompareArrows size={15} aria-hidden /> Vergleichen
            </Button>
          </div>
        </div>
      )}

      {hydrated && items.length > 0 && (
        <p className="mt-6 text-small text-fg3">
          Die Merkliste liegt in diesem Browser{session ? " und in deinem Konto" : ""}. Änderungen beziehen sich auf den
          Preis beim Merken.
        </p>
      )}
    </div>
  );
}

function SavedRow({
  saved,
  listing,
  monthly,
  selected,
  canSelect,
  onSelect,
  onRemove,
  onNote,
}: {
  saved: SavedCar;
  listing: Listing | null | undefined;
  monthly?: number;
  selected: boolean;
  canSelect: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onNote: (n: string) => void;
}) {
  const [note, setNoteText] = useState(saved.note);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = changeOf(saved, listing);
  const savedDays = Math.max(0, Math.floor((Date.now() - Date.parse(saved.savedAt)) / 86_400_000));

  const onChange = (v: string) => {
    setNoteText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onNote(v), 600);
  };

  return (
    <li className={`card flex flex-col overflow-hidden sm:flex-row ${selected ? "border-accent" : ""}`}>
      {listing ? (
        <a href={href(`/inserat/${listing.id}`)} className="block sm:w-52 sm:shrink-0">
          <ListingPhoto listing={listing} className="aspect-4/3 h-full" />
        </a>
      ) : (
        <div className="grid aspect-4/3 place-items-center bg-surface2 text-small text-fg3 sm:w-52 sm:shrink-0">
          {listing === null ? "Nicht mehr online" : "Lädt…"}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {listing ? (
              <a href={href(`/inserat/${listing.id}`)} className="text-h3 font-bold text-fg hover:text-accent">
                {vehicleTitle(listing)}
              </a>
            ) : (
              <span className="text-h3 font-bold text-fg3">Inserat {saved.slug}</span>
            )}
            {listing && (
              <p className="text-small text-fg2">
                {listing.year} · {fmtCH(listing.km)} km · {placeOf(listing)}
              </p>
            )}
          </div>
          <div className="text-right">
            {listing && <div className="text-h3 font-bold text-fg tabular">CHF {fmtCH(listing.price)}</div>}
            {monthly != null && listing?.status !== "VERKAUFT" && (
              <div className="text-small text-fg2 tabular">≈ CHF {fmtCH(monthly)}/Mt. Betrieb</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-small text-fg3">
          {change && <Badge tone={change.tone}>{change.label}</Badge>}
          <span>Gemerkt {daysAgo(savedDays)}</span>
          {saved.price > 0 && listing && listing.price !== saved.price && <span>damals CHF {fmtCH(saved.price)}</span>}
        </div>
        <textarea
          value={note}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          maxLength={500}
          placeholder="Notiz, z. B. «Probefahrt Samstag»"
          aria-label={`Notiz zu ${listing ? vehicleTitle(listing) : saved.slug}`}
          className="field min-h-10 resize-y py-2 text-small"
        />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <label
            className={`inline-flex items-center gap-2 text-small font-semibold ${canSelect ? "cursor-pointer text-fg" : "text-fg3"}`}
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={!canSelect}
              onChange={onSelect}
              className="h-4 w-4 accent-[rgb(var(--c-accent))]"
            />
            Zum Vergleich
          </label>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 size={15} aria-hidden /> Entfernen
          </Button>
        </div>
        {listing?.status === "VERKAUFT" && <Notice className="py-2">Verkauft — du kannst den Eintrag entfernen.</Notice>}
      </div>
    </li>
  );
}
