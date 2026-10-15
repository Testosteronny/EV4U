import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Eye, EyeOff, Heart, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import KontoLayout from "./KontoLayout";
import {
  NO_EVENTS,
  ageDays,
  deleteListing,
  fetchEventTotals,
  fetchMyListings,
  type EventTotals,
  type MyListing,
} from "./data";
import { Badge, Button, ChargeBar, ChipGroup, EmptyState, LinkButton, Notice, Select } from "../ui";
import { listingQuality } from "../../lib/quality";
import { photoUrl, supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { refreshListings } from "../../stores/listings";
import { LISTING_STATI, STATUS_LABEL, daysAgo, vehicleTitle, type ListingStatusFull } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto/inserate (Konzept §4.11) — every listing of the account with its
   status, its quality and what the last 30 days brought (views, contacts,
   saves). Editing happens in the sell wizard (`/verkaufen/neu?id=`).
   ============================================================================ */

const STATUS_HINT: Record<ListingStatusFull, string> = {
  ENTWURF: "Nur für dich sichtbar.",
  AKTIV: "Online und auffindbar.",
  RESERVIERT: "Online, als reserviert markiert — Anfragen bleiben möglich.",
  PAUSIERT: "Offline, bis du es wieder aktivierst.",
  VERKAUFT: "Bleibt als «verkauft» sichtbar, damit Merklisten es erklären können.",
};

type StatusFilter = "ALLE" | ListingStatusFull;

export default function MeineInseratePage() {
  return (
    <KontoLayout
      active="inserate"
      title="Meine Inserate"
      lead="Status, Qualität und Resonanz deiner Inserate der letzten 30 Tage."
    >
      {({ userId }) => <MyListings userId={userId} />}
    </KontoLayout>
  );
}

function MyListings({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MyListing[] | null>(null);
  const [events, setEvents] = useState<Map<string, EventTotals>>(new Map());
  const [filter, setFilter] = useState<StatusFilter>("ALLE");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mine = await fetchMyListings(userId);
    setRows(mine);
    setEvents(await fetchEventTotals(mine.map((l) => l.id)));
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (l: MyListing, status: ListingStatusFull) => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.from("listings").update({ status }).eq("id", l.id);
    if (err) setError(err.message);
    await Promise.all([load(), refreshListings()]);
  };

  const remove = async (l: MyListing) => {
    if (!window.confirm(`«${vehicleTitle(l)}» endgültig löschen? Fotos und Nachrichten gehen mit.`)) return;
    setError(null);
    const err = await deleteListing(l);
    if (err) setError(err);
    await Promise.all([load(), refreshListings()]);
  };

  const counts = useMemo(() => {
    const c = new Map<StatusFilter, number>([["ALLE", rows?.length ?? 0]]);
    for (const l of rows ?? []) c.set(l.status, (c.get(l.status) ?? 0) + 1);
    return c;
  }, [rows]);

  if (rows === null) {
    return (
      <div className="grid gap-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card bg-surface2" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Car size={22} aria-hidden />}
        title="Noch keine Inserate."
        hint="In sieben Schritten zum Inserat — mit Variante aus dem Katalog, Batteriegarantie und Fotos. Zwischendurch speichern wir als Entwurf."
      >
        <LinkButton href={href("/verkaufen/neu")} variant="primary">
          <Plus size={16} aria-hidden /> Inserat aufgeben
        </LinkButton>
        <LinkButton href={href("/verkaufen/preis-check")}>Gratis Preis-Check</LinkButton>
      </EmptyState>
    );
  }

  const shown = filter === "ALLE" ? rows : rows.filter((l) => l.status === filter);
  const options = (["ALLE", ...LISTING_STATI] as StatusFilter[])
    .filter((k) => k === "ALLE" || counts.get(k))
    .map((k) => ({ key: k, label: `${k === "ALLE" ? "Alle" : STATUS_LABEL[k]} ${counts.get(k) ?? 0}` }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipGroup label="Nach Status filtern" options={options} value={filter} onChange={setFilter} />
        <LinkButton href={href("/verkaufen/neu")} variant="primary" size="sm">
          <Plus size={15} aria-hidden /> Neues Inserat
        </LinkButton>
      </div>
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <ul className="mt-5 space-y-3">
        {shown.map((l) => (
          <li key={l.id}>
            <ListingAdminRow
              l={l}
              events={events.get(l.id) ?? NO_EVENTS}
              onStatus={(s) => void setStatus(l, s)}
              onDelete={() => void remove(l)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListingAdminRow({
  l,
  events,
  onStatus,
  onDelete,
}: {
  l: MyListing;
  events: EventTotals;
  onStatus: (s: ListingStatusFull) => void;
  onDelete: () => void;
}) {
  const quality = listingQuality(l);
  const photo = l.photos?.[0];
  const editHref = `${href("/verkaufen/neu")}?id=${encodeURIComponent(l.id)}`;
  const title = vehicleTitle(l);

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex gap-4">
        <a
          href={href(`/inserat/${l.slug}`)}
          className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-control bg-surface2 text-fg3"
          aria-label={`${title} ansehen`}
        >
          {photo ? (
            <img src={photoUrl(photo)} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Car size={26} aria-hidden />
          )}
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <a href={href(`/inserat/${l.slug}`)} className="text-h3 font-bold text-fg hover:text-accent">
                {title}
              </a>
              {l.variant && <p className="truncate text-small text-fg2">{l.variant}</p>}
              <p className="mt-0.5 text-small text-fg2 tabular">
                <span className="font-bold text-fg">CHF {fmtCH(l.price)}</span> · {l.year} · {fmtCH(l.km)} km ·
                erfasst {daysAgo(ageDays(l.created_at))}
              </p>
            </div>
            <label className="w-40 shrink-0">
              <span className="sr-only">Status von {title}</span>
              <Select value={l.status} onChange={(e) => onStatus(e.target.value as ListingStatusFull)} className="h-9">
                {LISTING_STATI.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <p className="mt-1 text-small text-fg3">{STATUS_HINT[l.status]}</p>
          {l.hidden_at && (
            <Badge tone="danger" className="mt-2">
              <EyeOff size={12} aria-hidden /> Von der Moderation ausgeblendet — wir melden uns per E-Mail
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-small font-semibold text-fg2">Inserat-Qualität</span>
            <span
              className={`text-body font-bold tabular ${
                quality.score >= 80 ? "text-accent" : quality.score >= 50 ? "text-fg" : "text-caution"
              }`}
            >
              {quality.score} %
            </span>
          </div>
          <ChargeBar value={quality.score} label={`Inserat-Qualität ${quality.score} %`} className="mt-1.5" />
          {quality.next[0] && (
            <a href={editHref} className="link mt-1.5 inline-block text-small">
              Nächster Schritt: {quality.next[0].label} (+{quality.next[0].gain} %)
            </a>
          )}
        </div>
        <dl className="flex gap-5 text-small text-fg2" aria-label="Letzte 30 Tage">
          <Stat icon={<Eye size={15} aria-hidden />} label="Aufrufe" value={events.VIEW} />
          <Stat icon={<MessageSquare size={15} aria-hidden />} label="Anfragen" value={events.CONTACT} />
          <Stat icon={<Heart size={15} aria-hidden />} label="gemerkt" value={events.SAVE} />
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href={editHref} size="sm">
          <Pencil size={14} aria-hidden /> Bearbeiten
        </LinkButton>
        <LinkButton href={href(`/inserat/${l.slug}`)} size="sm" variant="ghost">
          {l.status === "ENTWURF" ? "Vorschau" : "Ansehen"}
        </LinkButton>
        <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto hover:text-danger">
          <Trash2 size={14} aria-hidden /> Löschen
        </Button>
      </div>
    </article>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-fg3">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-bold text-fg tabular">{fmtCH(value)}</span> <span>{label}</span>
      </dd>
    </div>
  );
}
