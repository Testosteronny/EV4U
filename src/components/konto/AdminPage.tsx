import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Eye, EyeOff, Flag, Search, ShieldAlert, Trash2 } from "lucide-react";
import KontoLayout from "./KontoLayout";
import { ageDays } from "./data";
import { REPORT_REASONS, type ReportReason } from "../listing/ReportSheet";
import { Badge, Button, EmptyState, Notice, Segmented, Select, Toggle } from "../ui";
import { supabase, type ListingRowStatus } from "../../lib/supabase";
import { href } from "../../lib/url";
import { refreshListings } from "../../stores/listings";
import { LISTING_STATI, STATUS_LABEL, daysAgo, fmtDate, vehicleTitle, type ListingStatusFull } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /admin — Moderation (Konzept §4.12). Only a window: every read and write
   here is allowed by the admin branch of the RLS policies
   (private.is_admin()); without the role the queries return nothing and
   the database refuses the changes.

   · Meldungen: open reports first; hide/unhide the listing (hidden_at),
     mark the report done.
   · Garagen: verify by hand after checking the UID in Zefix.
   · Inserate: find any listing, override status, hide, delete.
   ============================================================================ */

type Tab = "meldungen" | "garagen" | "inserate";

type AdminListing = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  price: number;
  status: ListingRowStatus;
  seller_name: string;
  hidden_at: string | null;
  created_at: string;
  is_demo: boolean;
};

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label])) as Record<ReportReason, string>;

async function setHidden(id: string, hide: boolean): Promise<string | null> {
  if (!supabase) return "Nicht verbunden.";
  const { error } = await supabase
    .from("listings")
    .update({ hidden_at: hide ? new Date().toISOString() : null })
    .eq("id", id);
  void refreshListings();
  return error?.message ?? null;
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("meldungen");
  return (
    <KontoLayout active="admin" title="Moderation">
      {({ isAdmin, userId }) =>
        !isAdmin ? (
          <EmptyState
            icon={<ShieldAlert size={22} aria-hidden />}
            title="Kein Zugriff."
            hint="Dieser Bereich ist für das EV4U-Team."
          />
        ) : (
          <div>
            <Segmented
              label="Bereich"
              value={tab}
              onChange={setTab}
              options={[
                { key: "meldungen", label: "Meldungen" },
                { key: "garagen", label: "Garagen" },
                { key: "inserate", label: "Inserate" },
              ]}
            />
            <div className="mt-6">
              {tab === "meldungen" && <Reports />}
              {tab === "garagen" && <Garages />}
              {tab === "inserate" && <Listings userId={userId} />}
            </div>
          </div>
        )
      }
    </KontoLayout>
  );
}

/* ---------- Meldungen ------------------------------------------------------ */

type Report = {
  id: string;
  reason: ReportReason;
  detail: string;
  created_at: string;
  resolved_at: string | null;
  listing: AdminListing | null;
};

function Reports() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    let q = supabase
      .from("reports")
      .select(
        "id,reason,detail,created_at,resolved_at,listing:listings(id,slug,brand,model,price,status,seller_name,hidden_at,created_at,is_demo)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!showDone) q = q.is("resolved_at", null);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setRows((data as unknown as Report[]) ?? []);
  }, [showDone]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (r: Report) => {
    if (!supabase) return;
    const { error: err } = await supabase
      .from("reports")
      .update({ resolved_at: r.resolved_at ? null : new Date().toISOString() })
      .eq("id", r.id);
    setError(err?.message ?? null);
    void load();
  };

  const hide = async (l: AdminListing) => {
    setError(await setHidden(l.id, !l.hidden_at));
    void load();
  };

  // Several reports on one listing are the strongest signal — group them.
  const perListing = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.listing) m.set(r.listing.id, (m.get(r.listing.id) ?? 0) + 1);
    return m;
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-fg2">{rows ? `${rows.length} ${showDone ? "Meldungen" : "offene Meldungen"}` : "Lädt…"}</p>
        <div className="w-56">
          <Toggle label="Erledigte zeigen" checked={showDone} onChange={setShowDone} />
        </div>
      </div>
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      {rows?.length === 0 && (
        <EmptyState icon={<Flag size={22} aria-hidden />} title="Keine offenen Meldungen." hint="Alles ruhig." />
      )}
      <ul className="mt-4 space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className={`card p-4 sm:p-5 ${r.resolved_at ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.reason === "BETRUG" ? "danger" : "caution"}>{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                  {r.listing && (perListing.get(r.listing.id) ?? 0) > 1 && (
                    <Badge tone="danger">{perListing.get(r.listing.id)} Meldungen</Badge>
                  )}
                  <span className="text-small text-fg3">{daysAgo(ageDays(r.created_at))}</span>
                </div>
                {r.listing ? (
                  <a href={href(`/inserat/${r.listing.slug}`)} className="mt-2 block text-h3 font-bold text-fg hover:text-accent">
                    {vehicleTitle(r.listing)}
                  </a>
                ) : (
                  <p className="mt-2 text-body text-fg3">Inserat gelöscht</p>
                )}
                {r.listing && (
                  <p className="text-small text-fg2">
                    {r.listing.seller_name} · CHF {fmtCH(r.listing.price)} · {STATUS_LABEL[r.listing.status]}
                    {r.listing.hidden_at && " · ausgeblendet"}
                  </p>
                )}
                {r.detail && <p className="mt-2 max-w-prose whitespace-pre-line text-body text-fg">«{r.detail}»</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.listing && (
                  <Button size="sm" onClick={() => r.listing && void hide(r.listing)}>
                    {r.listing.hidden_at ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
                    {r.listing.hidden_at ? "Einblenden" : "Ausblenden"}
                  </Button>
                )}
                <Button size="sm" variant={r.resolved_at ? "ghost" : "primary"} onClick={() => void resolve(r)}>
                  <Check size={14} aria-hidden /> {r.resolved_at ? "Wieder öffnen" : "Erledigt"}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Garagen -------------------------------------------------------- */

type GarageRow = {
  id: string;
  name: string;
  company_uid: string | null;
  website: string | null;
  address: string;
  slug: string | null;
  verified: boolean;
  created_at: string;
};

function Garages() {
  const [rows, setRows] = useState<GarageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id,name,company_uid,website,address,slug,verified,created_at")
      .eq("type", "GARAGE")
      .order("verified", { ascending: true })
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setRows((data as GarageRow[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (g: GarageRow) => {
    if (!supabase) return;
    const { error: err } = await supabase.from("profiles").update({ verified: !g.verified }).eq("id", g.id);
    setError(err?.message ?? null);
    void load();
  };

  if (rows === null) return <div className="h-40 animate-pulse rounded-card bg-surface2" />;
  if (rows.length === 0) return <EmptyState title="Noch keine Garagenkonten." />;

  return (
    <div>
      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}
      <ul className="space-y-3">
        {rows.map((g) => (
          <li key={g.id} className="card flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-h3 font-bold text-fg">{g.name || "Ohne Namen"}</span>
                {g.verified ? (
                  <Badge tone="positive">
                    <BadgeCheck size={13} aria-hidden /> verifiziert
                  </Badge>
                ) : (
                  <Badge tone="caution">offen</Badge>
                )}
              </div>
              <p className="mt-1 text-small text-fg2">
                {g.company_uid ? (
                  <a
                    href={`https://www.zefix.ch/de/search/entity/list?name=${encodeURIComponent(g.company_uid)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                  >
                    {g.company_uid} in Zefix prüfen
                  </a>
                ) : (
                  "keine UID angegeben"
                )}
                {g.address && ` · ${g.address}`}
                {g.website && /^https?:\/\//i.test(g.website) && (
                  <>
                    {" · "}
                    <a href={g.website} target="_blank" rel="noopener noreferrer nofollow" className="link">
                      Website
                    </a>
                  </>
                )}
              </p>
              <p className="text-small text-fg3">
                seit {fmtDate(g.created_at)}
                {g.slug && (
                  <>
                    {" · "}
                    <a href={href(`/garagen/${g.slug}`)} className="link">
                      /garagen/{g.slug}
                    </a>
                  </>
                )}
              </p>
            </div>
            <Button size="sm" variant={g.verified ? "ghost" : "primary"} onClick={() => void verify(g)}>
              {g.verified ? "Verifizierung entziehen" : "Verifizieren"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Inserate ------------------------------------------------------- */

function Listings({ userId }: { userId: string }) {
  const [rows, setRows] = useState<(AdminListing & { owner: string | null })[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | ListingStatusFull>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("listings")
      .select("id,slug,brand,model,price,status,seller_name,hidden_at,created_at,is_demo,owner")
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) setError(err.message);
    setRows((data as (AdminListing & { owner: string | null })[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (l) =>
        (!status || l.status === status) &&
        (!q || `${l.brand} ${l.model} ${l.slug} ${l.seller_name}`.toLowerCase().includes(q)),
    );
  }, [rows, query, status]);

  const act = async (fn: () => Promise<string | null>) => {
    setError(await fn());
    await Promise.all([load(), refreshListings()]);
  };

  const changeStatus = (l: AdminListing, s: ListingStatusFull) =>
    act(async () => {
      if (!supabase) return null;
      const { error: err } = await supabase.from("listings").update({ status: s }).eq("id", l.id);
      return err?.message ?? null;
    });

  // Photos stay in the owner's folder (storage policies are owner-only);
  // they go with the account or by hand in the dashboard.
  const remove = (l: AdminListing) =>
    window.confirm(`«${vehicleTitle(l)}» endgültig löschen?`) &&
    act(async () => {
      if (!supabase) return null;
      const { error: err } = await supabase.from("listings").delete().eq("id", l.id);
      return err?.message ?? null;
    });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Inserate durchsuchen</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Marke, Modell, Inserat-Nr., Anbieter"
            className="field pl-9"
          />
        </label>
        <label className="w-44">
          <span className="sr-only">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as "" | ListingStatusFull)}>
            <option value="">Alle Status</option>
            {LISTING_STATI.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <p className="mt-4 text-small text-fg3">{rows ? `${shown.length} von ${rows.length}` : "Lädt…"}</p>
      <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
        {shown.slice(0, 100).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <a href={href(`/inserat/${l.slug}`)} className="text-body font-semibold text-fg hover:text-accent">
                {vehicleTitle(l)}
              </a>
              <div className="flex flex-wrap items-center gap-2 text-small text-fg2">
                <span className="tabular">CHF {fmtCH(l.price)}</span>·<span>{l.seller_name}</span>·
                <span className="tabular">{l.slug}</span>
                {l.is_demo && <Badge>Demo</Badge>}
                {l.owner === userId && <Badge>eigenes</Badge>}
                {l.hidden_at && <Badge tone="danger">ausgeblendet</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label={`Status von ${vehicleTitle(l)}`}
                value={l.status}
                onChange={(e) => void changeStatus(l, e.target.value as ListingStatusFull)}
                className="h-9 w-36"
              >
                {LISTING_STATI.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                aria-label={l.hidden_at ? "Einblenden" : "Ausblenden"}
                title={l.hidden_at ? "Einblenden" : "Ausblenden"}
                onClick={() => void act(() => setHidden(l.id, !l.hidden_at))}
              >
                {l.hidden_at ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
              </Button>
              <Button size="sm" variant="danger" aria-label="Löschen" title="Löschen" onClick={() => void remove(l)}>
                <Trash2 size={14} aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
