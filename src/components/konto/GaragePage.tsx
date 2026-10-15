import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Download, ExternalLink, ImagePlus, Timer } from "lucide-react";
import KontoLayout, { type KontoCtx } from "./KontoLayout";
import { fetchEventTotals, fetchMyListings, sumEvents, type EventTotals, type MyListing } from "./data";
import { Badge, Button, EmptyState, Field, LinkButton, Notice, StatCard } from "../ui";
import type { Profile } from "../../hooks/useProfile";
import { photoUrl, supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { resizeImage } from "../../utils/image";
import { fmtDate, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto/garage (Konzept §4.10) — for dealer accounts: the numbers of the
   last 30 days, the leads (every conversation on a garage listing, as CSV
   for the CRM), and the public garage page (/garagen/<slug>) with address,
   hours and logo. Verification is done by EV4U by hand (UID in Zefix).
   ============================================================================ */

export default function GaragePage() {
  return (
    <KontoLayout active="garage" title="Garage" lead="Zahlen, Leads und deine öffentliche Garagenseite.">
      {(ctx) => <Garage {...ctx} />}
    </KontoLayout>
  );
}

type Lead = {
  id: string;
  created_at: string;
  buyer: string;
  listing: { id: string; slug: string; brand: string; model: string; price: number } | null;
};

function Garage({ userId, profile, updateProfile }: KontoCtx) {
  if (profile?.type !== "GARAGE") {
    return (
      <EmptyState
        icon={<Building2 size={22} aria-hidden />}
        title="Das ist der Bereich für Garagen."
        hint="Mit einem Garagenkonto bekommst du eine eigene Garagenseite, Lead-Export und Statistiken. Inserieren bleibt gratis."
      >
        <Button variant="primary" onClick={() => void updateProfile({ type: "GARAGE" })}>
          Zu Garagenkonto wechseln
        </Button>
        <LinkButton href={href("/garagen")}>Mehr erfahren</LinkButton>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-10">
      <Numbers userId={userId} verified={profile.verified} />
      <GarageProfileForm userId={userId} profile={profile} onSave={updateProfile} />
    </div>
  );
}

function Numbers({ userId, verified }: { userId: string; verified: boolean }) {
  const [mine, setMine] = useState<MyListing[] | null>(null);
  const [events, setEvents] = useState<EventTotals | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [response, setResponse] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    let alive = true;
    void (async () => {
      const rows = await fetchMyListings(userId);
      const ids = rows.map((l) => l.id);
      const [totals, conv, rpc] = await Promise.all([
        fetchEventTotals(ids),
        ids.length
          ? sb
              .from("conversations")
              .select("id,created_at,buyer,listing:listings(id,slug,brand,model,price)")
              .in("listing_id", ids)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        sb.rpc("seller_response_minutes", { p_owner: userId }),
      ]);
      const list = (conv.data as unknown as Lead[]) ?? [];
      const buyers = [...new Set(list.map((c) => c.buyer))];
      const [{ data: p }, { data: m }] = await Promise.all([
        buyers.length ? sb.from("profiles").select("id,name").in("id", buyers) : Promise.resolve({ data: [] }),
        list.length
          ? sb.from("messages").select("conversation_id").in("conversation_id", list.map((c) => c.id)).limit(5000)
          : Promise.resolve({ data: [] }),
      ]);
      if (!alive) return;
      const perConv = new Map<string, number>();
      for (const r of (m as { conversation_id: string }[]) ?? [])
        perConv.set(r.conversation_id, (perConv.get(r.conversation_id) ?? 0) + 1);
      setMine(rows);
      setEvents(sumEvents(totals.values()));
      setLeads(list);
      setNames(new Map(((p as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name])));
      setCounts(perConv);
      setResponse(typeof rpc.data === "number" ? rpc.data : null);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const online = mine?.filter((l) => l.status === "AKTIV" || l.status === "RESERVIERT").length ?? 0;
  const recent = useMemo(() => leads.filter((c) => Date.now() - Date.parse(c.created_at) < 30 * 86_400_000).length, [leads]);

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Datum", "Inserat", "Inserat-Nr.", "Preis CHF", "Interessent", "Nachrichten", "Link"];
    const lines = leads.map((c) =>
      [
        fmtDate(c.created_at),
        c.listing ? vehicleTitle(c.listing) : "entfernt",
        c.listing?.slug ?? "",
        c.listing?.price ?? "",
        names.get(c.buyer) ?? "",
        counts.get(c.id) ?? 0,
        `${location.origin}${href("/konto/nachrichten")}?c=${c.id}`,
      ]
        .map(esc)
        .join(";"),
    );
    // BOM + semicolons: opens correctly in Excel with Swiss settings.
    const blob = new Blob([`﻿${[head.map(esc).join(";"), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ev4u-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-labelledby="zahlen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="zahlen" className="text-h2 font-bold text-fg">
          Letzte 30 Tage
        </h2>
        {verified ? (
          <Badge tone="positive">
            <BadgeCheck size={13} aria-hidden /> Verifizierte Garage
          </Badge>
        ) : (
          <Badge tone="caution">Verifizierung ausstehend</Badge>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Online" value={mine ? online : "–"} hint="Inserate" href={href("/konto/inserate")} />
        <StatCard title="Aufrufe" value={events ? fmtCH(events.VIEW) : "–"} hint={events ? `${fmtCH(events.SAVE)}× gemerkt` : undefined} />
        <StatCard title="Leads" value={mine ? recent : "–"} hint={`${leads.length} insgesamt`} />
        <StatCard
          title="Antwortzeit"
          value={response === null ? "–" : fmtMinutes(response)}
          hint="Median bis zur ersten Antwort"
          icon={<Timer size={17} aria-hidden />}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-h3 font-bold text-fg">Leads</h3>
        <Button size="sm" onClick={exportCsv} disabled={leads.length === 0}>
          <Download size={14} aria-hidden /> CSV exportieren
        </Button>
      </div>
      {leads.length === 0 ? (
        <p className="mt-3 text-body text-fg2">Noch keine Anfragen. Sie erscheinen hier, sobald jemand zu einem deiner Autos schreibt.</p>
      ) : (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-small">
            <thead className="border-b border-line text-fg3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Datum</th>
                <th className="px-4 py-2.5 font-semibold">Auto</th>
                <th className="px-4 py-2.5 font-semibold">Interessent</th>
                <th className="px-4 py-2.5 text-right font-semibold">Nachrichten</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 50).map((c) => (
                <tr key={c.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 text-fg2 tabular">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <a href={`${href("/konto/nachrichten")}?c=${c.id}`} className="font-semibold text-fg hover:text-accent">
                      {c.listing ? vehicleTitle(c.listing) : "Inserat entfernt"}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-fg2">{names.get(c.buyer) || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-fg tabular">{counts.get(c.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 42 → «42 Min.», 150 → «3 h», 3000 → «2 Tage». */
function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.max(1, Math.round(m))} Min.`;
  if (m < 36 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} Tage`;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function GarageProfileForm({
  userId,
  profile,
  onSave,
}: {
  userId: string;
  profile: Profile;
  onSave: KontoCtx["updateProfile"];
}) {
  const [form, setForm] = useState({
    name: profile.name,
    company_uid: profile.company_uid ?? "",
    website: profile.website ?? "",
    slug: profile.slug ?? "",
    address: profile.address,
    phone: profile.phone,
    opening_hours: profile.opening_hours,
    about: profile.about,
  });
  const [logo, setLogo] = useState(profile.logo_path);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setState("idle");
  };

  const slug = form.slug.trim();
  const slugOk = slug === "" || (SLUG_RE.test(slug) && slug.length >= 3);
  const uidOk = form.company_uid.trim() === "" || /^CHE-?\d{3}\.?\d{3}\.?\d{3}$/i.test(form.company_uid.trim());
  const webOk = form.website.trim() === "" || /^https?:\/\/\S+\.\S+/.test(form.website.trim());

  const save = async () => {
    setState("saving");
    setError(null);
    const err = await onSave({
      name: form.name.trim().slice(0, 80),
      company_uid: form.company_uid.trim().toUpperCase() || null,
      website: form.website.trim() || null,
      slug: slug || null,
      address: form.address.trim().slice(0, 200),
      phone: form.phone.trim().slice(0, 40),
      opening_hours: form.opening_hours.trim().slice(0, 400),
      about: form.about.trim().slice(0, 2000),
      logo_path: logo,
    });
    if (err) {
      setError(err);
      setState("idle");
    } else setState("saved");
  };

  // Logos go into the owner's photo folder (`<uid>/_logo/…`) — the bucket
  // policy already allows exactly that, and account deletion clears it.
  const upload = async (file: File) => {
    if (!supabase) return;
    setError(null);
    try {
      const blob = await resizeImage(file, 512);
      const path = `${userId}/_logo/logo-${Date.now()}.jpg`;
      const { error: err } = await supabase.storage.from("listing-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (err) throw err;
      if (logo) void supabase.storage.from("listing-photos").remove([logo]);
      setLogo(path);
      setState("idle");
    } catch {
      setError("Das Logo liess sich nicht hochladen. JPG oder PNG, bitte.");
    }
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="garagenseite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="garagenseite" className="text-h2 font-bold text-fg">
          Garagenseite
        </h2>
        {profile.slug && (
          <a href={href(`/garagen/${profile.slug}`)} className="link inline-flex items-center gap-1 text-body font-semibold">
            Öffentliche Seite ansehen <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </div>
      {!profile.verified && (
        <Notice className="mt-4">
          Mit UID prüfen wir deine Garage von Hand im Handelsregister (Zefix), meist innert zwei Werktagen. Danach trägt
          jedes Inserat das Abzeichen «Verifizierte Garage».
        </Notice>
      )}

      <div className="mt-5 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-surface2 text-fg3">
          {logo ? <img src={photoUrl(logo)} alt="Logo" className="h-full w-full object-contain" /> : <Building2 size={24} aria-hidden />}
        </span>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-control border border-line2 bg-surface px-3 text-small font-semibold text-fg hover:bg-surface2 focus-within:ring-2 focus-within:ring-accent">
          <ImagePlus size={15} aria-hidden /> {logo ? "Logo ersetzen" : "Logo hochladen"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Name der Garage">
          <input value={form.name} onChange={set("name")} maxLength={80} autoComplete="organization" className="field" />
        </Field>
        <Field label="UID" hint={uidOk ? "Format CHE-123.456.789" : "Bitte im Format CHE-123.456.789"} optional>
          <input value={form.company_uid} onChange={set("company_uid")} maxLength={20} placeholder="CHE-123.456.789" className="field" />
        </Field>
        <Field
          label="Adresse der Garagenseite"
          hint={
            slugOk
              ? `ev4u.ch/garagen/${slug || slugify(form.name) || "deine-garage"}`
              : "Nur Kleinbuchstaben, Ziffern und Bindestriche, mindestens 3 Zeichen."
          }
          optional
        >
          <div className="flex gap-2">
            <input value={form.slug} onChange={set("slug")} maxLength={60} placeholder={slugify(form.name)} className="field" />
            {!slug && form.name && (
              <Button size="sm" className="h-11 shrink-0" onClick={() => setForm((f) => ({ ...f, slug: slugify(f.name) }))}>
                Vorschlag
              </Button>
            )}
          </div>
        </Field>
        <Field label="Website" hint={webOk ? undefined : "Mit https:// beginnen"} optional>
          <input value={form.website} onChange={set("website")} maxLength={120} placeholder="https://" className="field" />
        </Field>
        <Field label="Adresse" optional>
          <input value={form.address} onChange={set("address")} maxLength={200} placeholder="Industriestrasse 4, 4600 Olten" autoComplete="street-address" className="field" />
        </Field>
        <Field label="Telefon" optional>
          <input value={form.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" className="field" />
        </Field>
        <Field label="Öffnungszeiten" optional>
          <textarea value={form.opening_hours} onChange={set("opening_hours")} maxLength={400} rows={3} placeholder={"Mo–Fr 8–18 Uhr\nSa 9–16 Uhr"} className="field py-2.5" />
        </Field>
        <Field label="Über uns" hint={`${form.about.length} / 2000`} optional>
          <textarea value={form.about} onChange={set("about")} maxLength={2000} rows={3} className="field py-2.5" />
        </Field>
      </div>

      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
        {state === "saved" && <span className="text-small font-semibold text-accent">Gespeichert</span>}
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={!form.name.trim() || !slugOk || !uidOk || !webOk || state === "saving"}
        >
          {state === "saving" ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}
