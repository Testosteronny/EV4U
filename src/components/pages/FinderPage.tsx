import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Badge, Button, LinkButton, PageHeader, Stepper } from "../ui";
import { useListings } from "../../hooks/useListings";
import { searchHref } from "../../lib/entries";
import { DEFAULT_FILTERS, filterChips, passes, type FilterKey, type Filters } from "../../lib/filters";
import { href } from "../../lib/url";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /finder — six questions for everyone who doesn't know yet what to filter
   for (was a sheet on the results page; Konzept §3).

   Each question owns a set of filter keys and every answer is a patch of
   them: «Egal» really clears what an earlier answer set. The result is a
   normal /inserate link — refinable there like any other search. The hit
   count runs live with every answer.
   ============================================================================ */

type Option = { label: string; hint?: string; patch: Partial<Filters> };
type Question = { tag: string; title: string; sub?: string; keys: FilterKey[]; options: Option[] };

const QUESTIONS: Question[] = [
  {
    tag: "Alltag",
    title: "Was passt zu deinem Alltag?",
    sub: "Lässt sich später jederzeit anpassen.",
    keys: ["seg"],
    options: [
      { label: "Stadt und Pendeln", hint: "Klein, wendig, günstig", patch: { seg: "KOMPAKT" } },
      { label: "Effiziente Limousine", hint: "Tiefer Verbrauch, viel Reichweite", patch: { seg: "LIMOUSINE" } },
      { label: "Kombi", hint: "Viel Laderaum", patch: { seg: "KOMBI" } },
      { label: "SUV", hint: "Hohe Sitzposition, Familie", patch: { seg: "SUV" } },
      { label: "Zeig mir alles", hint: "Noch keine Vorliebe", patch: {} },
    ],
  },
  {
    tag: "Sitze",
    title: "Wie viele Sitzplätze brauchst du?",
    keys: ["sitze"],
    options: [
      { label: "Vier reichen", hint: "Zweitwagen, Paar, Stadt", patch: {} },
      { label: "Fünf", hint: "Familie", patch: { sitze: 5 } },
      { label: "Sieben", hint: "Grosse Familie, Fahrgemeinschaft", patch: { sitze: 7 } },
    ],
  },
  {
    tag: "Reichweite",
    title: "Wie weit fährst du an einem Stück?",
    sub: "Gefiltert wird nach WLTP-Reichweite — im Winter sind es rund 20 bis 30 Prozent weniger.",
    keys: ["reichweite"],
    options: [
      { label: "Meist kurz", hint: "Stadt und Pendeln, unter 100 km am Tag", patch: {} },
      { label: "Auch mal weiter", hint: "Wochenendausflüge", patch: { reichweite: 400 } },
      { label: "Oft Langstrecke", hint: "Autobahn und Ferien", patch: { reichweite: 500 } },
    ],
  },
  {
    tag: "Laden",
    title: "Wo wirst du meistens laden?",
    keys: ["laden"],
    options: [
      { label: "Zuhause oder bei der Arbeit", hint: "Über Nacht, günstig", patch: {} },
      { label: "Unterwegs am Schnelllader", hint: "Tempo zählt — ab 150 kW", patch: { laden: 150 } },
      { label: "Gemischt", hint: "Beides kommt vor", patch: { laden: 100 } },
    ],
  },
  {
    tag: "Budget",
    title: "Was darf das Auto kosten?",
    keys: ["preis"],
    options: [
      { label: "Bis CHF 20'000", hint: "Einstieg", patch: { preis: 20000 } },
      { label: "Bis CHF 30'000", hint: "Gute Mitte", patch: { preis: 30000 } },
      { label: "Bis CHF 40'000", patch: { preis: 40000 } },
      { label: "Bis CHF 60'000", hint: "Premium", patch: { preis: 60000 } },
      { label: "Offen", hint: "Zeig mir alles", patch: {} },
    ],
  },
  {
    tag: "Wichtig",
    title: "Was muss das Auto auf jeden Fall haben?",
    keys: ["garantie", "ahk", "v2l", "allrad"],
    options: [
      { label: "Laufende Batteriegarantie", hint: "Sicherheit für die teuerste Komponente", patch: { garantie: true } },
      { label: "Anhängerkupplung", hint: "Velo-Träger, Anhänger, Wohnwagen", patch: { ahk: true } },
      { label: "Strom abgeben (V2L)", hint: "Camping, Werkzeug, Notstrom", patch: { v2l: true } },
      { label: "Allrad", hint: "Berge und Schnee", patch: { allrad: true } },
      { label: "Nichts Bestimmtes", patch: {} },
    ],
  },
];

function merge(answers: (number | null)[]): Filters {
  const f = { ...DEFAULT_FILTERS };
  answers.forEach((a, qi) => {
    if (a === null) return;
    const q = QUESTIONS[qi];
    for (const k of q.keys) (f as Record<string, unknown>)[k] = DEFAULT_FILTERS[k];
    Object.assign(f, q.options[a].patch);
  });
  return f;
}

export default function FinderPage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null));

  const f = useMemo(() => merge(answers), [answers]);
  const count = forSale.filter((l) => passes(l, f)).length;
  const done = step >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const chips = filterChips(f);

  const pick = (i: number) => {
    setAnswers((a) => a.map((x, qi) => (qi === step ? i : x)));
    setStep((s) => s + 1);
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        crumbs={[{ label: "Start", href: href("/") }, { label: "E-Auto-Finder" }]}
        title="Welches E-Auto passt zu dir?"
        lead="Sechs Fragen, danach siehst du die passenden Inserate — und kannst weiter filtern."
      />

      <div className="mt-8">
        <Stepper steps={QUESTIONS.map((x) => x.tag)} current={Math.min(step, QUESTIONS.length)} onSelect={setStep} />
      </div>

      <div className="card mt-6 p-5 sm:p-7">
        {done ? (
          <div>
            <p className="eyebrow">Dein Ergebnis</p>
            <p className="mt-2 text-display font-bold text-fg tabular">
              {count} <span className="text-h2 font-semibold text-fg2">{count === 1 ? "Inserat" : "Inserate"}</span>
            </p>
            <p className="mt-2 max-w-prose text-body text-fg2">
              {count > 0
                ? "Passt zu deinen Antworten. In der Suche lassen sich die Filter weiter verfeinern."
                : "Mit dieser Kombination ist gerade nichts online. Lockere eine Antwort — oder speichere die Suche dort als Suchabo."}
            </p>
            {chips.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Badge key={c.key} tone="positive">
                    {c.label}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={searchHref(f)} variant="primary">
                {count === 1 ? "Das Inserat ansehen" : `${count} Inserate ansehen`}
              </LinkButton>
              <Button
                variant="ghost"
                onClick={() => {
                  setAnswers(QUESTIONS.map(() => null));
                  setStep(0);
                }}
              >
                <RotateCcw size={15} aria-hidden /> Nochmals
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="eyebrow">
              Frage {step + 1} von {QUESTIONS.length}
            </p>
            <h2 className="mt-2 text-h2 font-bold text-fg">{q.title}</h2>
            {q.sub && <p className="mt-1 max-w-prose text-body text-fg2">{q.sub}</p>}
            <div className="mt-5 grid gap-2">
              {q.options.map((o, oi) => {
                const active = answers[step] === oi;
                return (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => pick(oi)}
                    aria-pressed={active}
                    className={`rounded-control border px-4 py-3 text-left transition-colors ${
                      active ? "border-accent bg-faint" : "border-line hover:border-line2 hover:bg-surface2"
                    }`}
                  >
                    <span className="block text-body font-semibold text-fg">{o.label}</span>
                    {o.hint && <span className="block text-small text-fg2">{o.hint}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft size={15} aria-hidden /> Zurück
              </Button>
              <span className="text-small text-fg2" aria-live="polite">
                <span className="font-semibold text-fg tabular">{count}</span> passende Inserate bisher
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
