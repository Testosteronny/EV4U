import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookmarkPlus, Compass, Heart, X } from "lucide-react";
import ListingBoard from "../ListingBoard";
import AutoFinder, { type FinderParams } from "../AutoFinder";
import { Fader, SectionHeader, Segmented, Stamp } from "../ui";
import { useFavorites } from "../../hooks/useFavorites";
import { useListings } from "../../hooks/useListings";
import { useSession } from "../../hooks/useSession";
import { supabase } from "../../lib/supabase";
import { SEGMENTS, SORTS, type Listing, type Segment, type SortKey } from "../../data/evData";

/* ============================================================================
   /inserate — the full classifieds catalogue.
   Every filter lives in the URL (?seg=SUV&marke=KIA&sitze=5&preis=40000…):
   searches are shareable, bookmarkable, and survive reloads — the URL is
   the single source of truth, mirrored into state via history.replaceState.
   ============================================================================ */

const ANBIETER = ["ALLE", "PRIVAT", "GARAGE"] as const;
const SITZE = ["ALLE", "4", "5"] as const;
const PRICE_MAX = 120000;

export default function InseratePage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const { favorites, canFavorite } = useFavorites();
  const { session } = useSession();
  // URL stays the single source of truth (shareable filters) — without a
  // client router we mirror it in state and write via history.replaceState.
  const [sp, setSpState] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
  );
  const setSp = (next: URLSearchParams) => {
    const q = next.toString();
    history.replaceState(null, "", q ? `${location.pathname}?${q}` : location.pathname);
    setSpState(next);
  };
  const [searchSaved, setSearchSaved] = useState(false);

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
  // Extra constraints the E-Auto-Finder can set — no manual console control,
  // so they surface as removable chips below the console.
  const reichweite = Number(sp.get("reichweite") ?? 0);
  const laden = Number(sp.get("laden") ?? 0);
  const v2x = sp.get("v2x") === "1";

  const [finderOpen, setFinderOpen] = useState(false);

  /** Write a param; defaults are removed so URLs stay clean. */
  const setParam = (key: string, value: string | number, def: string | number) => {
    const next = new URLSearchParams(sp);
    if (String(value) === String(def)) next.delete(key);
    else next.set(key, String(value));
    setSp(next);
  };

  /** Apply a whole batch of finder params in one write; defaults stripped. */
  const applyFinder = (p: FinderParams) => {
    const next = new URLSearchParams(sp);
    const put = (key: string, val: string | number | null | undefined, def: string | number) => {
      if (val == null || String(val) === String(def)) next.delete(key);
      else next.set(key, String(val));
    };
    put("seg", p.seg ?? "ALLE", "ALLE");
    put("sitze", p.sitze ?? "ALLE", "ALLE");
    put("preis", p.preis ?? PRICE_MAX, PRICE_MAX);
    put("reichweite", p.reichweite ?? 0, 0);
    put("laden", p.laden ?? 0, 0);
    put("v2x", p.v2x ?? null, "");
    setSp(next);
    setFinderOpen(false);
  };

  /** Drop every finder-only constraint at once. */
  const clearFinder = () => {
    const next = new URLSearchParams(sp);
    ["reichweite", "laden", "v2x"].forEach((k) => next.delete(k));
    setSp(next);
  };

  const finderChips = [
    reichweite > 0 && { key: "reichweite", label: `Reichweite ≥ ${reichweite} km`, def: 0 },
    laden > 0 && { key: "laden", label: `Schnellladen ≥ ${laden} kW`, def: 0 },
    v2x && { key: "v2x", label: "V2X · bidirektional", def: "" },
  ].filter(Boolean) as { key: string; label: string; def: string | number }[];

  const rows = useMemo(() => {
    const dir = SORTS.find((s) => s.key === sort)?.dir ?? 1;
    return listings.filter(
      (l) =>
        (seg === "ALLE" || l.segment === seg) &&
        (marke === "ALLE" || l.brand === marke) &&
        (anbieter === "ALLE" || l.sellerType === anbieter) &&
        (sitze === "ALLE" || l.seats === Number(sitze)) &&
        (!favOnly || favorites.includes(l.id)) &&
        l.range >= reichweite &&
        l.dcKw >= laden &&
        (!v2x || l.bidi) &&
        l.price <= preis,
    ).sort((a, b) => (a[sort] - b[sort]) * dir);
  }, [listings, favorites, seg, marke, anbieter, sitze, preis, sort, favOnly, reichweite, laden, v2x]);

  /** Persist the current query string as a saved search. */
  const saveSearch = async () => {
    if (!supabase || !session) return;
    const parts: string[] = [];
    if (seg !== "ALLE") parts.push(seg);
    if (marke !== "ALLE") parts.push(marke);
    if (anbieter !== "ALLE") parts.push(anbieter);
    if (sitze !== "ALLE") parts.push(`${sitze} SITZE`);
    if (preis !== PRICE_MAX) parts.push(`BIS ${Math.round(preis / 1000)}K`);
    if (reichweite > 0) parts.push(`≥${reichweite}KM`);
    if (laden > 0) parts.push(`≥${laden}KW`);
    if (v2x) parts.push("V2X");
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
        title="Inserate"
        claim={`Markt-Tafel · ${rows.length} von ${listings.length} · Privat & Garage`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFinderOpen(true)}
            className="flex items-center gap-2 border border-signal bg-signal px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-nacht transition-colors hover:bg-signal-dim"
          >
            <Compass size={12} /> E-Auto-Finder
          </button>
          <button
            onClick={() => setParam("fav", favOnly ? "" : "1", "")}
            title={canFavorite ? undefined : "Merkliste — Login auf /konto nötig"}
            className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
              favOnly
                ? "border-signal bg-signal text-nacht"
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

      {/* Active E-Auto-Finder constraints — the ones the console can't set */}
      {finderChips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-signal">
            <Compass size={11} /> Finder
          </span>
          {finderChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setParam(c.key, c.def, c.def)}
              title="Diesen Finder-Filter entfernen"
              className="flex items-center gap-1.5 border border-signal/40 bg-signal/[0.07] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-signal transition-colors hover:border-signal hover:bg-signal/[0.14]"
            >
              {c.label}
              <X size={11} />
            </button>
          ))}
          <button
            onClick={clearFinder}
            className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted underline-offset-2 transition-colors hover:text-signal hover:underline"
          >
            Zurücksetzen
          </button>
        </motion.div>
      )}

      {/* Board or empty state */}
      <div className="mt-6">
        {rows.length > 0 ? (
          <ListingBoard listings={rows} />
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
        UNSICHER? DER <span className="text-signal">E-AUTO-FINDER</span> STELLT DIR 6 FRAGEN.
      </p>

      <AnimatePresence>
        {finderOpen && (
          <AutoFinder
            listings={listings}
            onApply={applyFinder}
            onClose={() => setFinderOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
