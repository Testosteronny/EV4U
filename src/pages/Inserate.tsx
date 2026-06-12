import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookmarkPlus, Heart } from "lucide-react";
import ListingBoard from "../components/ListingBoard";
import { Fader, SectionHeader, Segmented, Stamp } from "../components/ui";
import { useCockpit } from "../context/CockpitContext";
import { useListings } from "../context/ListingsContext";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { SEGMENTS, SORTS, type Segment, type SortKey } from "../data/evData";

/* ============================================================================
   /inserate — the full classifieds catalogue.
   Every filter lives in the URL (?seg=SUV&marke=KIA&sitze=5&preis=40000…):
   searches are shareable, bookmarkable, and survive reloads — the URL is
   the single source of truth, React state only bumps the flap animation.
   ============================================================================ */

const ANBIETER = ["ALLE", "PRIVAT", "GARAGE"] as const;
const SITZE = ["ALLE", "4", "5"] as const;
const PRICE_MAX = 120000;

export default function Inserate() {
  const { listings } = useListings();
  const { favorites } = useCockpit();
  const { session } = useSession();
  const [sp, setSp] = useSearchParams();
  const [searchSaved, setSearchSaved] = useState(false);
  // Bumped on every filter change → re-triggers the split-flap scramble.
  const spin = useRef(0);

  const brands = useMemo(
    () => ["ALLE", ...Array.from(new Set(listings.map((l) => l.brand))).sort()],
    [listings],
  );

  const seg = (sp.get("seg") ?? "ALLE") as "ALLE" | Segment;
  const marke = sp.get("marke") ?? "ALLE";
  const anbieter = (sp.get("anbieter") ?? "ALLE") as (typeof ANBIETER)[number];
  const sitze = (sp.get("sitze") ?? "ALLE") as (typeof SITZE)[number];
  const preis = Number(sp.get("preis") ?? PRICE_MAX);
  const sort = (sp.get("sort") ?? "price") as SortKey;
  const favOnly = sp.get("fav") === "1";

  /** Write a param; defaults are removed so URLs stay clean. */
  const setParam = (key: string, value: string | number, def: string | number) => {
    const next = new URLSearchParams(sp);
    if (String(value) === String(def)) next.delete(key);
    else next.set(key, String(value));
    spin.current += 1;
    setSp(next, { replace: true });
  };

  const rows = useMemo(() => {
    const dir = SORTS.find((s) => s.key === sort)?.dir ?? 1;
    return listings.filter(
      (l) =>
        (seg === "ALLE" || l.segment === seg) &&
        (marke === "ALLE" || l.brand === marke) &&
        (anbieter === "ALLE" || l.sellerType === anbieter) &&
        (sitze === "ALLE" || l.seats === Number(sitze)) &&
        (!favOnly || favorites.includes(l.id)) &&
        l.price <= preis,
    ).sort((a, b) => (a[sort] - b[sort]) * dir);
  }, [listings, favorites, seg, marke, anbieter, sitze, preis, sort, favOnly]);

  /** Persist the current query string as a saved search. */
  const saveSearch = async () => {
    if (!supabase || !session) return;
    const parts: string[] = [];
    if (seg !== "ALLE") parts.push(seg);
    if (marke !== "ALLE") parts.push(marke);
    if (anbieter !== "ALLE") parts.push(anbieter);
    if (sitze !== "ALLE") parts.push(`${sitze} SITZE`);
    if (preis !== PRICE_MAX) parts.push(`BIS ${Math.round(preis / 1000)}K`);
    const { error } = await supabase.from("saved_searches").insert({
      user_id: session.user.id,
      label: parts.join(" · ") || "ALLE INSERATE",
      params: sp.toString(),
    });
    if (!error) setSearchSaved(true);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Markt-Tafel"
        claim={`${rows.length} von ${listings.length} Inseraten · Privat & Garage`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setParam("fav", favOnly ? "" : "1", "")}
            className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
              favOnly
                ? "border-signal bg-signal text-white"
                : "border-line text-muted hover:border-signal hover:text-signal"
            }`}
          >
            <Heart size={12} fill={favOnly ? "currentColor" : "none"} />
            Merkliste ({favorites.length})
          </button>
          {session && !searchSaved && (
            <button
              onClick={() => void saveSearch()}
              className="flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-signal hover:text-signal"
            >
              <BookmarkPlus size={12} /> Suche speichern
            </button>
          )}
          {searchSaved && <Stamp>Gespeichert</Stamp>}
        </div>
      </SectionHeader>

      {/* Filter console */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="panel mt-8 grid gap-x-8 gap-y-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto]"
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
          <div>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Karosserie
            </span>
            <Segmented
              options={SEGMENTS.map((s) => ({ key: s, label: s }))}
              value={seg}
              onChange={(v) => setParam("seg", v, "ALLE")}
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Marke
            </span>
            <select
              value={marke}
              onChange={(e) => setParam("marke", e.target.value, "ALLE")}
              className="cursor-pointer border border-line bg-nacht px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink focus:border-signal focus:outline-none"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Anbieter
            </span>
            <Segmented
              options={ANBIETER.map((a) => ({ key: a, label: a }))}
              value={anbieter}
              onChange={(v) => setParam("anbieter", v, "ALLE")}
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Sitze
            </span>
            <Segmented
              options={SITZE.map((s) => ({ key: s, label: s }))}
              value={sitze}
              onChange={(v) => setParam("sitze", v, "ALLE")}
            />
          </div>
          <div className="w-48">
            <Fader
              label="Preis bis"
              value={preis}
              min={10000}
              max={PRICE_MAX}
              step={5000}
              unit="CHF"
              onChange={(v) => setParam("preis", v, PRICE_MAX)}
            />
          </div>
        </div>
        <div className="lg:justify-self-end">
          <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            Sortierung
          </span>
          <Segmented
            options={SORTS.map((s) => ({ key: s.key, label: s.label }))}
            value={sort}
            onChange={(v) => setParam("sort", v, "price")}
          />
        </div>
      </motion.div>

      {/* Board or empty state */}
      <div className="mt-6">
        {rows.length > 0 ? (
          <ListingBoard listings={rows} spin={spin.current} />
        ) : (
          <div className="panel px-6 py-16 text-center">
            <p className="stretch-wide text-xl font-extrabold uppercase text-ink">
              Keine Inserate auf diesem Gleis.
            </p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
              FILTER LOCKERN — ODER SPEICHERE DIE SUCHE UND WIR MELDEN UNS BEIM
              NÄCHSTEN TREFFER.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 font-mono text-[9px] tracking-[0.15em] text-muted/70">
        TIPP: DIESE SUCHE IST EINE URL — LINK KOPIEREN, TEILEN, WIEDERKOMMEN.
      </p>
    </section>
  );
}
