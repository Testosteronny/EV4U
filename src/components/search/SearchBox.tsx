import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { Search, Sparkles, X } from "lucide-react";
import { aiSearch, aiSearchPossible, aiSearchUrl } from "../../lib/aiSearch";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import { SELLER_LABEL, vehicleTitle } from "../../utils/format";
import { fold, matchesQuery } from "../../utils/search";
import { $vehicleCatalog, loadVehicleCatalog } from "../../stores/vehicleCatalog";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   SearchBox — ein Feld, zwei Wege.

   1. Sofort und lokal: während des Tippens werden passende Inserate direkt
      aus dem geladenen Bestand vorgeschlagen. Kostet nichts, braucht kein
      Netz, ist bei «Model 3» unschlagbar schnell.
   2. Auf Wunsch per KI: beschreibt jemand ein Auto statt es zu benennen
      («familientauglicher Kombi bis 40'000»), übersetzt die Edge Function
      `suche` das in Filter und schickt die Person auf /inserate.

   Dazu schlägt das Feld Marken und Modelle aus dem Fahrzeugkatalog vor —
   mit der Zahl der Inserate — und führt in den Filter Marke → Modell,
   auch wenn gerade nichts im Bestand ist. Der Katalog lädt erst, wenn
   jemand ins Feld klickt.

   Weg 2 wird nie erzwungen. Er läuft, wenn man ihn anklickt — oder wenn die
   lokale Suche 0 Treffer hat, weil eine leere Ergebnisseite ohnehin nichts
   nützt. Ist die Funktion nicht deployt oder scheitert der Aufruf, passiert
   genau das, was vorher passiert wäre: normale Textsuche.
   ============================================================================ */

export default function SearchBox({
  initial = "",
  autoFocus = false,
  onDone,
  className = "",
}: {
  initial?: string;
  autoFocus?: boolean;
  /** Wird nach Navigation/Abbruch gerufen — schliesst das Mobile-Panel. */
  onDone?: () => void;
  className?: string;
}) {
  const { active } = useListings();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [thinking, setThinking] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const catalog = useStore($vehicleCatalog);

  const hits = useMemo(() => {
    if (q.trim().length < 2) return [];
    return active.filter((l) => matchesQuery(l, q)).slice(0, 6);
  }, [active, q]);

  /** Marken, deren Name mit der Eingabe beginnt, und Modelle, bei denen
   *  jedes eingetippte Wort einen Wortanfang trifft — «id 3» findet
   *  «VW ID.3», «id» aber nicht «Lucid». */
  const catalogHits = useMemo((): CatalogHit[] => {
    const term = fold(q.trim());
    if (term.length < 2 || catalog.status !== "ready") return [];
    const words = tokens(term);
    const brandHits: CatalogHit[] = [];
    const modelHits: CatalogHit[] = [];
    for (const b of catalog.brands) {
      const brandFold = fold(b.name);
      const inBrand = active.filter((l) => fold(l.brand) === brandFold);
      if (brandFold.startsWith(term)) {
        brandHits.push({
          key: b.slug,
          title: `${b.name} — alle Modelle`,
          url: `${href("/inserate")}?marke=${encodeURIComponent(b.name)}`,
          count: inBrand.length,
        });
      }
      for (const m of b.models) {
        const hay = tokens(fold(`${b.name} ${m.name}`));
        if (!words.every((w) => hay.some((h) => h.startsWith(w)))) continue;
        modelHits.push({
          key: m.slug,
          title: `${b.name} ${m.name}`,
          url: `${href("/inserate")}?marke=${encodeURIComponent(b.name)}&modell=${encodeURIComponent(m.slug)}`,
          count: inBrand.filter((l) => l.modelSlug === m.slug).length,
        });
      }
    }
    modelHits.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "de-CH"));
    return [...brandHits.slice(0, 2), ...modelHits.slice(0, 4)];
  }, [catalog, active, q]);

  /** Eine Liste für die Pfeiltasten: Katalog oben, Inserate darunter. */
  const items = useMemo(
    () => [...catalogHits.map((c) => c.url), ...hits.map((l) => href(`/inserat/${l.id}`))],
    [catalogHits, hits],
  );

  useEffect(() => setCursor(-1), [q]);

  // Die Ergebnisseite liest ihre Filter erst nach dem Mount aus der URL —
  // den Suchbegriff daher nachziehen, wenn er eintrifft.
  useEffect(() => setQ(initial), [initial]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const goToResults = () => {
    const term = q.trim();
    window.location.href = term
      ? `${href("/inserate")}?q=${encodeURIComponent(term)}`
      : href("/inserate");
  };

  /** Weg 2. Scheitert er, landen wir auf der normalen Textsuche — der Klick
   *  führt also immer irgendwohin. */
  const describeSearch = async () => {
    const term = q.trim();
    if (!term || thinking) return;
    setThinking(true);
    const result = await aiSearch(term);
    setThinking(false);
    if (result) window.location.href = aiSearchUrl(result, term);
    else goToResults();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      onDone?.();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (cursor >= 0 && items[cursor]) {
        window.location.href = items[cursor];
      } else if (hits.length === 0 && catalogHits.length > 0) {
        // Kein Inserat, aber ein Katalogtreffer: der Filter zeigt ehrlich
        // «keine Inserate» und bietet an, die Suche zu merken.
        window.location.href = catalogHits[0].url;
      } else if (hits.length === 0 && aiSearchPossible()) {
        // Der einzige Fall, in dem die KI ungefragt übernimmt: ohne lokale
        // Treffer kann sie nicht schlechter sein als eine leere Seite.
        void describeSearch();
      } else {
        goToResults();
      }
    }
  };

  const term = q.trim();
  const showPanel = open && term.length >= 2;

  return (
    <div className={`relative ${className}`} ref={wrap}>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3"
        />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            loadVehicleCatalog();
          }}
          onKeyDown={onKeyDown}
          placeholder="Marke, Modell — oder beschreib dein Auto"
          aria-label="Inserate durchsuchen"
          className="field h-10 rounded-full bg-surface2 py-0 pl-9 pr-9 text-body focus:bg-surface [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            aria-label="Suche leeren"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[8px] text-fg3 transition-colors hover:bg-surface2 hover:text-fg"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="overlay-card animate-fade-in absolute inset-x-0 z-50 mt-1.5 overflow-hidden p-1.5">
          {catalogHits.length > 0 && (
            <>
              <div className="eyebrow px-3 pb-1 pt-2">Im Katalog</div>
              {catalogHits.map((c, i) => (
                <a
                  key={c.key}
                  href={c.url}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex items-center justify-between gap-3 rounded-[8px] px-3 py-2 transition-colors ${
                    cursor === i ? "bg-surface2" : ""
                  }`}
                >
                  <span className="min-w-0 truncate text-body font-medium text-fg">{c.title}</span>
                  <span className="shrink-0 text-small text-fg3 tabular">
                    {c.count === 0
                      ? "kein Inserat"
                      : `${c.count} ${c.count === 1 ? "Inserat" : "Inserate"}`}
                  </span>
                </a>
              ))}
              {hits.length > 0 && <div className="eyebrow px-3 pb-1 pt-2">Inserate</div>}
            </>
          )}
          {hits.length === 0 ? (
            catalogHits.length === 0 && (
              <p className="px-3 py-3 text-body text-fg2">
                Kein Inserat heisst so.
                {aiSearchPossible() && " Als Beschreibung suchen?"}
              </p>
            )
          ) : (
            hits.map((l, j) => (
              <a
                key={l.id}
                href={href(`/inserat/${l.id}`)}
                onMouseEnter={() => setCursor(catalogHits.length + j)}
                className={`flex items-center justify-between gap-3 rounded-[8px] px-3 py-2 transition-colors ${
                  cursor === catalogHits.length + j ? "bg-surface2" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-fg">
                    {vehicleTitle(l)}
                  </span>
                  <span className="block text-small text-fg3">
                    {l.year} · {fmtCH(l.km)} km · {SELLER_LABEL[l.sellerType]}
                  </span>
                </span>
                <span className="shrink-0 text-body font-medium text-fg tabular">
                  {fmtCH(l.price)}
                </span>
              </a>
            ))
          )}

          <div className="mt-1 border-t border-line pt-1">
            {aiSearchPossible() && (
              <button
                onClick={() => void describeSearch()}
                disabled={thinking}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left text-small font-medium text-accent transition-colors hover:bg-surface2 disabled:opacity-60"
              >
                <Sparkles
                  size={14}
                  aria-hidden
                  className={thinking ? "animate-pulse" : ""}
                />
                {thinking ? "Sucht passende Filter…" : `«${term}» als Beschreibung suchen`}
              </button>
            )}
            {hits.length > 0 && (
              <button
                onClick={goToResults}
                className="w-full rounded-[8px] px-3 py-2 text-left text-small text-fg2 transition-colors hover:bg-surface2"
              >
                Alle Treffer für «{term}» ansehen →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type CatalogHit = { key: string; title: string; url: string; count: number };

/** Wörter ohne Satzzeichen: «ID.3» → «id», «3»; «e-tron» → «e», «tron». */
const tokens = (s: string): string[] => s.split(/[^a-z0-9]+/).filter(Boolean);
