import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, X, ArrowLeft, RotateCcw, Zap } from "lucide-react";
import type { Listing } from "../data/evData";
import { AnimatedNumber } from "./ui";

/* ============================================================================
   E-Auto-Finder — a guided questionnaire that works as a second, friendlier
   filter alongside the manual Filter-Konsole on /inserate.

   Six lifestyle questions; every answer carries a small patch of the same URL
   filter params the console writes (seg · sitze · preis) PLUS three the console
   has no control for (reichweite · laden · v2x). Answers auto-advance, the live
   match count ticks along, and "Ergebnisse anzeigen" writes the merged params
   to the URL so the search stays shareable and composes with manual tweaks.
   ============================================================================ */

/** Filter patch a single answer contributes. `null` clears a key. */
export type FinderParams = Record<string, string | null>;

type Option = {
  label: string;
  hint?: string;
  params: FinderParams;
};

type Question = {
  id: string;
  tag: string; // mono eyebrow, e.g. "01 · KAROSSERIE"
  title: string;
  sub?: string;
  options: Option[];
};

const PRICE_MAX = 120000;

const QUESTIONS: Question[] = [
  {
    id: "nutzung",
    tag: "01 · KAROSSERIE",
    title: "Was passt zu deinem Alltag?",
    sub: "Bestimmt die Karosserieform — du kannst sie später jederzeit anpassen.",
    options: [
      { label: "Stadt & Pendeln", hint: "Klein, wendig, günstig", params: { seg: "KOMPAKT" } },
      { label: "Effiziente Limousine", hint: "Tiefer Verbrauch, viel Reichweite", params: { seg: "LIMOUSINE" } },
      { label: "Kombi", hint: "Maximaler Laderaum", params: { seg: "KOMBI" } },
      { label: "SUV", hint: "Hohe Sitzposition, Familie", params: { seg: "SUV" } },
      { label: "Zeig mir alles", hint: "Noch keine Vorliebe", params: { seg: "ALLE" } },
    ],
  },
  {
    id: "sitze",
    tag: "02 · SITZE",
    title: "Wie viele Sitzplätze brauchst du?",
    options: [
      { label: "Bis 4 reichen", hint: "Zweitwagen, Paar, Stadt", params: { sitze: "ALLE" } },
      { label: "Volle 5 Sitze", hint: "Familie & Gepäck", params: { sitze: "5" } },
      { label: "Egal", hint: "Zählt für mich nicht", params: { sitze: "ALLE" } },
    ],
  },
  {
    id: "strecke",
    tag: "03 · REICHWEITE",
    title: "Wie lang ist deine typische Strecke?",
    sub: "Wir filtern nach WLTP-Reichweite — realistisch, nicht geschönt.",
    options: [
      { label: "Kurzstrecke", hint: "Stadt & Pendeln, < 50 km/Tag", params: { reichweite: "0" } },
      { label: "Mittel", hint: "Auch mal übers Wochenende", params: { reichweite: "400" } },
      { label: "Langstrecke", hint: "Regelmässig Autobahn & Ferien", params: { reichweite: "550" } },
    ],
  },
  {
    id: "laden",
    tag: "04 · LADEN",
    title: "Wo lädst du meistens?",
    options: [
      { label: "Zuhause / Solardach", hint: "Über Nacht, günstiger Eigenstrom", params: { laden: "0" } },
      { label: "Unterwegs am Schnelllader", hint: "Tempo zählt — ab 150 kW DC", params: { laden: "150" } },
      { label: "Gemischt", hint: "Beides kommt vor", params: { laden: "0" } },
    ],
  },
  {
    id: "budget",
    tag: "05 · BUDGET",
    title: "Was darf es kosten?",
    options: [
      { label: "Bis 20'000", hint: "Einstieg", params: { preis: "20000" } },
      { label: "Bis 35'000", hint: "Mittelklasse", params: { preis: "35000" } },
      { label: "Bis 60'000", hint: "Premium", params: { preis: "60000" } },
      { label: "Offen", hint: "Zeig mir auch die Sterne", params: { preis: String(PRICE_MAX) } },
    ],
  },
  {
    id: "v2x",
    tag: "06 · V2X",
    title: "Strom zurückspeisen? (V2H / V2L / V2G)",
    sub: "Notstrom fürs Haus, Steckdose fürs Camping, Eigenverbrauch optimieren.",
    options: [
      { label: "Ja, wichtig für mich", hint: "Nur bidirektionale Autos", params: { v2x: "1" } },
      { label: "Nice to have", hint: "Kein Muss", params: { v2x: null } },
      { label: "Brauche ich nicht", hint: "", params: { v2x: null } },
    ],
  },
];

const LETTERS = "ABCDEFGH";

/** Merge every answered option's param patch into one flat object. */
function mergeParams(answers: (number | null)[]): FinderParams {
  const out: FinderParams = {};
  answers.forEach((sel, qi) => {
    if (sel == null) return;
    Object.assign(out, QUESTIONS[qi].options[sel].params);
  });
  return out;
}

/** Does a listing satisfy the merged finder params? Mirrors the /inserate row
 *  filter for exactly the keys the finder can set. */
function matches(l: Listing, p: FinderParams): boolean {
  const seg = p.seg ?? "ALLE";
  const sitze = p.sitze ?? "ALLE";
  const reichweite = Number(p.reichweite ?? 0);
  const laden = Number(p.laden ?? 0);
  const preis = Number(p.preis ?? PRICE_MAX);
  const v2x = p.v2x === "1";
  return (
    (seg === "ALLE" || l.segment === seg) &&
    (sitze === "ALLE" || l.seats === Number(sitze)) &&
    l.range >= reichweite &&
    l.dcKw >= laden &&
    l.price <= preis &&
    (!v2x || l.bidi)
  );
}

/** Human-readable chips summarising the choices, for the result step. */
function summaryChips(p: FinderParams): string[] {
  const out: string[] = [];
  if (p.seg && p.seg !== "ALLE") out.push(p.seg);
  if (p.sitze === "5") out.push("5 SITZE");
  if (p.reichweite && Number(p.reichweite) > 0) out.push(`≥ ${p.reichweite} KM`);
  if (p.laden && Number(p.laden) > 0) out.push(`≥ ${p.laden} KW DC`);
  if (p.preis && Number(p.preis) < PRICE_MAX)
    out.push(`BIS ${Math.round(Number(p.preis) / 1000)}K`);
  if (p.v2x === "1") out.push("V2X");
  return out;
}

export default function AutoFinder({
  listings,
  onApply,
  onClose,
}: {
  listings: Listing[];
  onApply: (params: FinderParams) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0); // 0..N-1 = question, N = result
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => QUESTIONS.map(() => null),
  );

  const total = QUESTIONS.length;
  const onResult = step >= total;
  const merged = useMemo(() => mergeParams(answers), [answers]);
  const count = useMemo(
    () => listings.filter((l) => matches(l, merged)).length,
    [listings, merged],
  );

  // Close on Escape; lock body scroll while the finder is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const pick = (optionIndex: number) => {
    setAnswers((a) => {
      const next = [...a];
      next[step] = optionIndex;
      return next;
    });
    // Auto-advance a beat later so the selection is visible first.
    window.setTimeout(() => setStep((s) => s + 1), 190);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));
  const restart = () => {
    setAnswers(QUESTIONS.map(() => null));
    setStep(0);
  };

  const q = QUESTIONS[Math.min(step, total - 1)];
  const chips = summaryChips(merged);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-nacht/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="E-Auto-Finder"
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="panel bg-blueprint relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        {/* live current line along the top edge */}
        <span className="current-line absolute inset-x-0 top-0" aria-hidden />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center bg-signal text-nacht">
              <Compass size={16} strokeWidth={2} />
            </span>
            <div>
              <div className="stretch-wide text-sm font-black uppercase tracking-wide text-ink">
                E-Auto-Finder
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
                {onResult ? "Ergebnis" : `Frage ${String(step + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Finder schliessen"
            className="grid h-8 w-8 place-items-center border border-line text-muted transition-colors hover:border-signal hover:text-signal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress ticks */}
        <div className="flex gap-1 px-5 pt-4 sm:px-6">
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 transition-colors duration-300 ${
                i < step ? "bg-signal" : i === step ? "bg-signal/50" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            {onResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-signal">
                  Dein Match
                </span>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="stretch-expand text-6xl font-black text-ink tabular">
                    <AnimatedNumber value={count} />
                  </span>
                  <span className="stretch-wide text-lg font-bold uppercase text-muted">
                    {count === 1 ? "Inserat" : "Inserate"}
                  </span>
                </div>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {count > 0
                    ? "Passt zu deinen Antworten. Übernimm die Auswahl als Filter — du kannst sie danach in der Konsole feinjustieren."
                    : "Kein Treffer mit dieser Kombination. Lockere eine Antwort — oder übernimm sie trotzdem und passe die Filter danach an."}
                </p>

                {chips.length > 0 && (
                  <div className="mt-6">
                    <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                      Abgeleitete Filter
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {chips.map((c) => (
                        <span
                          key={c}
                          className="flex items-center gap-1.5 border border-signal/40 bg-signal/[0.07] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-signal"
                        >
                          <Zap size={11} /> {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-signal">
                  {q.tag}
                </span>
                <h3 className="stretch-wide mt-3 text-2xl font-extrabold uppercase leading-tight text-ink sm:text-3xl">
                  {q.title}
                </h3>
                {q.sub && (
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{q.sub}</p>
                )}

                <div className="mt-6 grid gap-2.5">
                  {q.options.map((o, oi) => {
                    const active = answers[step] === oi;
                    return (
                      <button
                        key={o.label}
                        onClick={() => pick(oi)}
                        className={`group flex items-center gap-4 border px-4 py-3.5 text-left transition-colors duration-150 ${
                          active
                            ? "border-signal bg-signal/[0.08]"
                            : "border-line bg-panel hover:border-signal/60 hover:bg-panel2"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center border font-mono text-[11px] font-bold transition-colors ${
                            active
                              ? "border-signal bg-signal text-nacht"
                              : "border-line text-muted group-hover:border-signal/60 group-hover:text-signal"
                          }`}
                        >
                          {LETTERS[oi]}
                        </span>
                        <span className="min-w-0">
                          <span className="block stretch-wide text-sm font-bold uppercase tracking-wide text-ink">
                            {o.label}
                          </span>
                          {o.hint && (
                            <span className="mt-0.5 block font-mono text-[10px] tracking-[0.08em] text-muted">
                              {o.hint}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4 sm:px-6">
          {onResult ? (
            <>
              <button
                onClick={restart}
                className="flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-signal hover:text-signal"
              >
                <RotateCcw size={12} /> Nochmal
              </button>
              <button
                onClick={() => onApply(merged)}
                className="flex items-center gap-2 border border-signal bg-signal px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-nacht transition-colors hover:bg-signal-dim"
              >
                Ergebnisse anzeigen ({count})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={back}
                disabled={step === 0}
                className="flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
              >
                <ArrowLeft size={12} /> Zurück
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                <span className="text-signal tabular">{count}</span> Treffer bisher
              </span>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
