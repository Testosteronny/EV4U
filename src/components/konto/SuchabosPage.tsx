import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Check, Pencil, Search, Trash2 } from "lucide-react";
import KontoLayout from "./KontoLayout";
import { FREQUENCIES, type Frequency } from "../search/SaveSearch";
import { Badge, Button, EmptyState, IconButton, LinkButton, Notice, Select } from "../ui";
import { useAccountSettings } from "../../hooks/useAccountSettings";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { usePlzResolver } from "../../hooks/usePlzResolver";
import { filterChips, passes, readFilters, type FilterContext } from "../../lib/filters";
import { plzOf } from "../../lib/listingFacts";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { brandName, fmtDate } from "../../utils/format";

/* ============================================================================
   /konto/suchabos (Konzept F7) — saved searches with their e-mail rhythm.
   «Neu» counts the matching cars that went online since the search was
   last opened from here; opening it resets the mark. The matching runs on
   the same predicates as the results page, so the numbers agree.
   ============================================================================ */

type Abo = {
  id: string;
  label: string;
  params: string;
  frequency: Frequency;
  created_at: string;
  last_opened_at: string;
};

export default function SuchabosPage() {
  return (
    <KontoLayout
      active="suchabos"
      title="Suchabos"
      lead="Gespeicherte Suchen — wir melden neue Treffer im gewählten Rhythmus."
    >
      {({ userId }) => <Abos userId={userId} />}
    </KontoLayout>
  );
}

function Abos({ userId }: { userId: string }) {
  const [abos, setAbos] = useState<Abo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { settings, update: updateSettings } = useAccountSettings(userId);
  const { active } = useListings();
  const market = useMarket(active);
  const resolve = usePlzResolver(Boolean(abos?.some((a) => new URLSearchParams(a.params).get("plz"))));

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("saved_searches")
      .select("id,label,params,frequency,created_at,last_opened_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setAbos((data as Abo[]) ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: string, fields: Partial<Pick<Abo, "label" | "frequency" | "last_opened_at">>) => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.from("saved_searches").update(fields).eq("id", id);
    if (err) setError(err.message);
    else setAbos((list) => list?.map((a) => (a.id === id ? { ...a, ...fields } : a)) ?? null);
  };

  const remove = async (a: Abo) => {
    if (!supabase || !window.confirm(`Suchabo «${a.label}» löschen?`)) return;
    await supabase.from("saved_searches").delete().eq("id", a.id);
    void load();
  };

  const open = async (a: Abo) => {
    await patch(a.id, { last_opened_at: new Date().toISOString() });
    window.location.assign(`${href("/inserate")}?${a.params}`);
  };

  // Matches per search: all, and new since it was last opened.
  const hits = useMemo(() => {
    const out = new Map<string, { total: number; fresh: number }>();
    for (const a of abos ?? []) {
      const sp = new URLSearchParams(a.params);
      const f = readFilters(sp);
      const plz = sp.get("plz");
      const from = plz && resolve ? resolve(plz) : null;
      const ctx: FilterContext = from
        ? {
            monthly: market.ctx.monthly,
            distance: (l) => {
              const p = plzOf(l);
              const to = p ? resolve?.(p) : null;
              return to && !to.estimated ? Math.round(Math.hypot(to.e - from.e, to.n - from.n) / 1000) : null;
            },
          }
        : market.ctx;
      const since = Date.parse(a.last_opened_at);
      let total = 0;
      let fresh = 0;
      for (const l of active) {
        if (!passes(l, f, ctx)) continue;
        total++;
        if (l.createdAt && Date.parse(l.createdAt) > since) fresh++;
      }
      out.set(a.id, { total, fresh });
    }
    return out;
  }, [abos, active, market.ctx, resolve]);

  if (abos === null) return <div className="h-48 animate-pulse rounded-card bg-surface2" aria-busy="true" />;

  if (abos.length === 0) {
    return (
      <EmptyState
        icon={<BellRing size={22} aria-hidden />}
        title="Noch keine Suchabos."
        hint="Stell deine Suche ein und tippe auf «Suchabo speichern» — wir melden uns, sobald ein passendes Auto online ist."
      >
        <LinkButton href={href("/inserate")} variant="primary">
          <Search size={16} aria-hidden /> Suche starten
        </LinkButton>
        <LinkButton href={href("/finder")}>E-Auto-Finder</LinkButton>
      </EmptyState>
    );
  }

  const mailsOff = settings && !settings.notify_alerts && abos.some((a) => a.frequency !== "AUS");

  return (
    <div>
      {mailsOff && (
        <Notice tone="caution" className="mb-4">
          E-Mails für Suchabos sind ausgeschaltet.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void updateSettings({ notify_alerts: true })}>
            Wieder einschalten
          </button>
        </Notice>
      )}
      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}
      <ul className="space-y-3">
        {abos.map((a) => (
          <li key={a.id}>
            <AboRow
              abo={a}
              hits={hits.get(a.id) ?? { total: 0, fresh: 0 }}
              onRename={(label) => void patch(a.id, { label })}
              onFrequency={(frequency) => void patch(a.id, { frequency })}
              onOpen={() => void open(a)}
              onDelete={() => void remove(a)}
            />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-small text-fg3">
        «Neu» zählt Autos, die online gegangen sind, seit du die Suche zuletzt von hier aus geöffnet hast.
      </p>
    </div>
  );
}

function AboRow({
  abo,
  hits,
  onRename,
  onFrequency,
  onOpen,
  onDelete,
}: {
  abo: Abo;
  hits: { total: number; fresh: number };
  onRename: (label: string) => void;
  onFrequency: (f: Frequency) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(abo.label);
  const f = readFilters(new URLSearchParams(abo.params));
  const chips = filterChips(f)
    .filter((c) => c.key !== "modell" && c.key !== "variante")
    .map((c) => (c.key === "marke" ? { ...c, label: brandName(f.marke) } : c));

  const commit = () => {
    const v = label.trim().slice(0, 120);
    if (v && v !== abo.label) onRename(v);
    setEditing(false);
  };

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                commit();
              }}
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={commit}
                maxLength={120}
                autoFocus
                aria-label="Name des Suchabos"
                className="field h-9"
              />
              <IconButton type="submit" aria-label="Name speichern">
                <Check size={16} aria-hidden />
              </IconButton>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="truncate text-h3 font-bold text-fg">{abo.label}</h3>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-control text-fg3 hover:bg-surface2 hover:text-fg"
                aria-label={`«${abo.label}» umbenennen`}
              >
                <Pencil size={14} aria-hidden />
              </button>
            </div>
          )}
          {chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Filter">
              {chips.map((c) => (
                <li key={c.key}>
                  <Badge>{c.label}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-small text-fg2">
            <span className="font-semibold text-fg tabular">{hits.total}</span> Treffer
            {hits.fresh > 0 && (
              <>
                {" "}
                · <span className="font-semibold text-accent tabular">{hits.fresh} neu</span>
              </>
            )}{" "}
            · gespeichert am {fmtDate(abo.created_at)}
          </p>
        </div>
        <label className="w-44 shrink-0">
          <span className="mb-1 block text-micro font-semibold text-fg3">E-Mail</span>
          <Select value={abo.frequency} onChange={(e) => onFrequency(e.target.value as Frequency)} className="h-9">
            {FREQUENCIES.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={hits.fresh > 0 ? "primary" : "secondary"} onClick={onOpen}>
          <Search size={14} aria-hidden />
          {hits.fresh > 0 ? `${hits.fresh} neue ansehen` : "Suche öffnen"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto hover:text-danger">
          <Trash2 size={14} aria-hidden /> Löschen
        </Button>
      </div>
    </article>
  );
}
