import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Badge, Button, Sheet } from "./ui";
import { PRICE_MAX } from "../lib/filters";
import { SEGMENT_LABEL } from "../utils/format";
import { fmtCH } from "../utils/swiss";
import type { Listing, Segment } from "../data/evData";

/* ============================================================================
   E-Auto-Finder — sechs Fragen für alle, die noch nicht wissen, wonach sie
   filtern sollen. Bleibt erhalten, ist aber kein grüner Primärbutton mehr
   neben dem Katalog: ein sekundärer Einstieg für Unentschlossene.

   Jede Antwort trägt einen Patch derselben URL-Parameter, die auch die
   Filterzeile schreibt — die Ergebnisse sind danach ganz normal weiter
   verfeinerbar. `null` heisst «diesen Filter entfernen»: eine Antwort wie
   «Egal» muss eine zuvor gesetzte Einschränkung auch wirklich lösen, sonst
   sagt der Finder etwas anderes als er tut.
   ============================================================================ */

export type FinderParams = Record<string, string | null>;

type Option = { label: string; hint?: string; params: FinderParams };
type Question = { id: string; tag: string; title: string; sub?: string; options: Option[] };

const QUESTIONS: Question[] = [
  {
    id: "nutzung",
    tag: "Karosserie",
    title: "Was passt zu deinem Alltag?",
    sub: "Lässt sich später jederzeit anpassen.",
    options: [
      { label: "Stadt und Pendeln", hint: "Klein, wendig, günstig", params: { seg: "KOMPAKT" } },
      {
        label: "Effiziente Limousine",
        hint: "Tiefer Verbrauch, viel Reichweite",
        params: { seg: "LIMOUSINE" },
      },
      { label: "Kombi", hint: "Maximaler Laderaum", params: { seg: "KOMBI" } },
      { label: "SUV", hint: "Hohe Sitzposition, Familie", params: { seg: "SUV" } },
      { label: "Zeig mir alles", hint: "Noch keine Vorliebe", params: { seg: null } },
    ],
  },
  {
    id: "sitze",
    tag: "Sitze",
    title: "Wie viele Sitzplätze brauchst du?",
    options: [
      { label: "Vier genügen", hint: "Zweitwagen, Paar, Stadt", params: { sitze: "4" } },
      { label: "Volle fünf Sitze", hint: "Familie und Gepäck", params: { sitze: "5" } },
      { label: "Egal", hint: "Zählt für mich nicht", params: { sitze: null } },
    ],
  },
  {
    id: "strecke",
    tag: "Reichweite",
    title: "Wie lang ist deine typische Strecke?",
    sub: "Gefiltert wird nach WLTP-Reichweite.",
    options: [
      {
        label: "Kurzstrecke",
        hint: "Stadt und Pendeln, unter 50 km pro Tag",
        params: { reichweite: null },
      },
      { label: "Mittel", hint: "Auch mal übers Wochenende", params: { reichweite: "400" } },
      {
        label: "Langstrecke",
        hint: "Regelmässig Autobahn und Ferien",
        params: { reichweite: "500" },
      },
    ],
  },
  {
    id: "laden",
    tag: "Laden",
    title: "Wo lädst du meistens?",
    options: [
      {
        label: "Zuhause oder am Solardach",
        hint: "Über Nacht, günstiger Eigenstrom",
        params: { laden: null },
      },
      {
        label: "Unterwegs am Schnelllader",
        hint: "Tempo zählt — ab 150 kW",
        params: { laden: "150" },
      },
      { label: "Gemischt", hint: "Beides kommt vor", params: { laden: null } },
    ],
  },
  {
    id: "budget",
    tag: "Budget",
    title: "Was darf es kosten?",
    options: [
      { label: "Bis 20'000", hint: "Einstieg", params: { preis: "20000" } },
      { label: "Bis 35'000", hint: "Mittelklasse", params: { preis: "35000" } },
      { label: "Bis 60'000", hint: "Premium", params: { preis: "60000" } },
      { label: "Offen", hint: "Zeig mir alles", params: { preis: null } },
    ],
  },
  {
    id: "v2x",
    tag: "Rückspeisen",
    title: "Soll das Auto Strom zurückgeben können?",
    sub: "Notstrom fürs Haus, Steckdose fürs Camping, Eigenverbrauch optimieren.",
    options: [
      { label: "Ja, wichtig für mich", hint: "Nur bidirektionale Autos", params: { v2x: "1" } },
      { label: "Nice to have", hint: "Kein Muss", params: { v2x: null } },
      { label: "Brauche ich nicht", params: { v2x: null } },
    ],
  },
];

/** Alle Antworten zu einem Parameter-Patch. Jede Frage schreibt genau ihren
 *  eigenen Schlüssel, es kann sich also nichts gegenseitig überschreiben. */
function mergeParams(answers: (number | null)[]): FinderParams {
  const out: FinderParams = {};
  answers.forEach((sel, qi) => {
    if (sel == null) return;
    Object.assign(out, QUESTIONS[qi].options[sel].params);
  });
  return out;
}

function matches(l: Listing, p: FinderParams): boolean {
  return (
    (!p.seg || l.segment === p.seg) &&
    (!p.sitze || l.seats === Number(p.sitze)) &&
    l.range >= Number(p.reichweite ?? 0) &&
    l.dcKw >= Number(p.laden ?? 0) &&
    l.price <= Number(p.preis ?? PRICE_MAX) &&
    (p.v2x !== "1" || l.bidi)
  );
}

function summaryChips(p: FinderParams): string[] {
  const out: string[] = [];
  if (p.seg) out.push(SEGMENT_LABEL[p.seg as Segment] ?? p.seg);
  if (p.sitze) out.push(`${p.sitze} Sitze`);
  if (p.reichweite) out.push(`ab ${p.reichweite} km`);
  if (p.laden) out.push(`ab ${p.laden} kW`);
  if (p.preis) out.push(`bis CHF ${fmtCH(Number(p.preis))}`);
  if (p.v2x === "1") out.push("bidirektional");
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null));
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const total = QUESTIONS.length;
  const onResult = step >= total;
  const merged = useMemo(() => mergeParams(answers), [answers]);
  const count = useMemo(
    () => listings.filter((l) => matches(l, merged)).length,
    [listings, merged],
  );

  const pick = (i: number) => {
    setAnswers((a) => {
      const next = [...a];
      next[step] = i;
      return next;
    });
    // Kurz stehen lassen, damit die Auswahl sichtbar wird, bevor es
    // weitergeht — der Timer wird beim Schliessen aufgeräumt.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStep((s) => s + 1), 150);
  };

  const q = QUESTIONS[Math.min(step, total - 1)];
  const chips = summaryChips(merged);

  return (
    <Sheet
      title="E-Auto-Finder"
      onClose={onClose}
      wide
      footer={
        onResult ? (
          <>
            <Button
              onClick={() => {
                setAnswers(QUESTIONS.map(() => null));
                setStep(0);
              }}
              variant="ghost"
              size="sm"
            >
              <RotateCcw size={14} aria-hidden /> Nochmal
            </Button>
            <Button onClick={() => onApply(merged)} variant="primary">
              {count === 1 ? "1 Inserat ansehen" : `${count} Inserate ansehen`}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft size={14} aria-hidden /> Zurück
            </Button>
            <span className="text-small text-fg2" aria-live="polite">
              <span className="font-medium text-fg tabular">{count}</span> Treffer bisher
            </span>
          </>
        )
      }
    >
      {/* Fortschritt */}
      <div className="mb-5 flex gap-1" aria-hidden>
        {QUESTIONS.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-accent" : i === step ? "bg-accent/40" : "bg-line"
            }`}
          />
        ))}
      </div>

      {onResult ? (
        <div>
          <div className="eyebrow">Dein Ergebnis</div>
          <p className="mt-2 text-display font-semibold text-fg tabular">
            {count}{" "}
            <span className="text-h2 font-normal text-fg2">
              {count === 1 ? "Inserat" : "Inserate"}
            </span>
          </p>
          <p className="mt-2 max-w-prose text-body text-fg2">
            {count > 0
              ? "Passt zu deinen Antworten. Übernimm die Auswahl als Filter — danach lässt sie sich in der Filterzeile weiter verfeinern."
              : "Kein Treffer mit dieser Kombination. Lockere eine Antwort — oder übernimm sie trotzdem und passe die Filter danach an."}
          </p>
          {chips.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow mb-2">Daraus werden diese Filter</div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Badge key={c} tone="positive">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="eyebrow">
            Frage {step + 1} von {total} · {q.tag}
          </div>
          <h3 className="mt-2 text-h2 font-semibold text-fg">{q.title}</h3>
          {q.sub && <p className="mt-1 max-w-prose text-body text-fg2">{q.sub}</p>}

          <div className="mt-5 grid gap-2">
            {q.options.map((o, oi) => {
              const active = answers[step] === oi;
              return (
                <button
                  key={o.label}
                  onClick={() => pick(oi)}
                  aria-pressed={active}
                  className={`rounded-card border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent/[0.07]"
                      : "border-line hover:border-line2 hover:bg-surface2"
                  }`}
                >
                  <span className="block text-body font-medium text-fg">{o.label}</span>
                  {o.hint && <span className="block text-small text-fg2">{o.hint}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}
