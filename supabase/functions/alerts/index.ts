/* ============================================================================
   Edge Function `alerts` — Suchabos und Merkliste per E-Mail (Konzept F7).

   Called every 30 minutes by pg_cron (migration alerts_cron). Idempotent:
   what was mailed is recorded (saved_searches.last_notified_at,
   favorites.notified_price / notified_status), so an extra call sends
   nothing twice — which is why the public anon JWT is enough to call it.

   · Suchabos: SOFORT on every run, TAEGLICH after 23 h, WOECHENTLICH after
     6 days 23 h. New = went online since the last mail. The matching mirrors
     src/lib/filters.ts on the database row; «Betrieb bis» depends on the
     visitor's cost model and is left to the page (the mail says so).
   · Merkliste: price cut, reserved, sold, offline — one digest per account.
   · Respects account_settings.notify_alerts. Without RESEND_API_KEY the
     mails are logged instead of sent (the markers still advance).
   ============================================================================ */

import { createClient } from "jsr:@supabase/supabase-js@2";
import PLZ from "./plz.json" with { type: "json" };

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const SITE = (Deno.env.get("SITE_URL") ?? "https://testosteronny.github.io/EV4U").replace(/\/$/, "");
const RESEND = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("MAIL_FROM") ?? "EV4U <noreply@ev4u.ch>";

const HOUR = 3_600_000;
const DUE_AFTER: Record<string, number> = { SOFORT: 0, TAEGLICH: 23 * HOUR, WOECHENTLICH: (6 * 24 + 23) * HOUR };
const MAX_WINDOW = 8 * 24 * HOUR;
const COORDS = PLZ as unknown as Record<string, [number, number]>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!RESEND) {
    console.log(`[alerts] RESEND_API_KEY not set — would mail ${to}: ${subject}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!res.ok) console.error(`[alerts] resend ${res.status} for ${to}`);
  return res.ok;
}

const emails = new Map<string, string | null>();
async function emailOf(userId: string): Promise<string | null> {
  if (!emails.has(userId)) {
    const { data } = await admin.auth.admin.getUserById(userId);
    emails.set(userId, data?.user?.email ?? null);
  }
  return emails.get(userId)!;
}

const chf = (n: number) => `CHF ${Math.round(n).toLocaleString("de-CH").replace(/[’’]/g, "'")}`;
const kmFmt = (n: number) => `${Math.round(n).toLocaleString("de-CH").replace(/[’’]/g, "'")} km`;

/* ---------- Suchabos -------------------------------------------------------- */

type Row = {
  slug: string;
  brand: string;
  model: string;
  variant: string | null;
  segment: string;
  year: number;
  km: number;
  price: number;
  range_km: number;
  soh: number;
  dc_kw: number | null;
  bidi: boolean;
  seats: number;
  ort: string;
  seller_name: string;
  seller_type: string;
  battery_warranty_until: string | null;
  battery_warranty_km: number | null;
  accident_free: boolean | null;
  equipment: Record<string, unknown> | null;
  created_at: string;
  catalog_model: { slug: string } | null;
  catalog_variant: { slug: string; system_voltage_v: number; ac_max_kw: number | string; drive: string; trunk_l: number | null } | null;
};

const ROW_SELECT =
  "slug,brand,model,variant,segment,year,km,price,range_km,soh,dc_kw,bidi,seats,ort,seller_name,seller_type," +
  "battery_warranty_until,battery_warranty_km,accident_free,equipment,created_at," +
  "catalog_model:vehicle_models!listings_model_id_fkey(slug)," +
  "catalog_variant:vehicle_variants!listings_variant_id_fkey(slug,system_voltage_v,ac_max_kw,drive,trunk_l)";

const SEGMENT_LABEL: Record<string, string> = { KOMPAKT: "Kompakt", LIMOUSINE: "Limousine", KOMBI: "Kombi", SUV: "SUV" };
const SELLER_LABEL: Record<string, string> = { PRIVAT: "Privat", GARAGE: "Garage" };
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The filters of src/lib/filters.ts, on the database row. */
function matcher(params: string, homePlz: string | null): (r: Row) => boolean {
  const sp = new URLSearchParams(params);
  const num = (k: string) => {
    const v = Number(sp.get(k));
    return sp.has(k) && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  };
  const on = (k: string) => sp.get(k) === "1";
  const words = fold((sp.get("q") ?? "").trim()).split(/\s+/).filter(Boolean);
  const seg = sp.get("seg") ?? "";
  const marke = fold(sp.get("marke") ?? "");
  const modell = sp.get("modell") ?? "";
  const variante = sp.get("variante") ?? "";
  const anbieter = sp.get("anbieter") ?? "";
  const [preis, preisvon, jahr, km, reichweite, soh, laden, kofferraum, sitze, umkreis] = [
    "preis", "preisvon", "jahr", "km", "reichweite", "soh", "laden", "kofferraum", "sitze", "umkreis",
  ].map(num);
  const origin = umkreis ? COORDS[sp.get("plz") ?? homePlz ?? ""] ?? null : null;
  const month = new Date().toISOString().slice(0, 7);

  return (r) => {
    if (words.length) {
      const hay = fold(
        `${r.brand} ${r.model} ${r.variant ?? ""} ${SEGMENT_LABEL[r.segment] ?? ""} ${SELLER_LABEL[r.seller_type] ?? ""} ${r.seller_name} ${r.ort} ${r.year}`,
      );
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (seg && r.segment !== seg) return false;
    if (marke && fold(r.brand) !== marke) return false;
    if (modell && r.catalog_model?.slug !== modell) return false;
    if (variante && r.catalog_variant?.slug !== variante) return false;
    if (preis && r.price > preis) return false;
    if (r.price < preisvon || r.year < jahr || r.range_km < reichweite || r.soh < soh || r.seats < sitze) return false;
    if (km && r.km > km) return false;
    if ((r.dc_kw ?? 0) < laden) return false;
    if (on("garantie")) {
      const until = r.battery_warranty_until?.slice(0, 7);
      if (!until && !r.battery_warranty_km) return false;
      if (until && until < month) return false;
      if (r.battery_warranty_km && r.km >= r.battery_warranty_km) return false;
    }
    const v = r.catalog_variant;
    if (on("v800") && (v?.system_voltage_v ?? 0) < 700) return false;
    if (on("ac22") && Number(v?.ac_max_kw ?? 0) < 22) return false;
    if (on("v2l") && !r.bidi) return false;
    if (on("ahk") && r.equipment?.tow_hitch !== true) return false;
    if (on("allrad") && v?.drive !== "AWD") return false;
    if (on("waermepumpe") && r.equipment?.heat_pump !== true) return false;
    if (kofferraum && (v?.trunk_l ?? 0) < kofferraum) return false;
    if (on("unfallfrei") && r.accident_free !== true) return false;
    if (anbieter && r.seller_type !== anbieter) return false;
    if (umkreis) {
      const p = COORDS[/^\d{4}/.exec(r.ort.trim())?.[0] ?? ""];
      if (!origin || !p) return false;
      if (Math.round(Math.hypot(p[0] - origin[0], p[1] - origin[1]) / 10) > umkreis) return false;
    }
    return true;
  };
}

type Search = {
  id: string;
  user_id: string;
  label: string;
  params: string;
  frequency: string;
  created_at: string;
  last_notified_at: string | null;
};

type Settings = { user_id: string; notify_alerts: boolean; plz: string | null };

async function runSearches(now: number, settings: Map<string, Settings>): Promise<number> {
  const { data } = await admin
    .from("saved_searches")
    .select("id,user_id,label,params,frequency,created_at,last_notified_at")
    .neq("frequency", "AUS");
  const due = ((data as Search[]) ?? []).filter((s) => {
    if (settings.get(s.user_id)?.notify_alerts === false) return false;
    return !s.last_notified_at || now - Date.parse(s.last_notified_at) >= (DUE_AFTER[s.frequency] ?? Infinity);
  });
  if (!due.length) return 0;

  const since = Math.max(now - MAX_WINDOW, Math.min(...due.map((s) => Date.parse(s.last_notified_at ?? s.created_at))));
  const { data: rows } = await admin
    .from("listings")
    .select(ROW_SELECT)
    .eq("status", "AKTIV")
    .is("hidden_at", null)
    .eq("is_demo", false)
    .gte("created_at", new Date(since).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  const fresh = (rows as unknown as Row[]) ?? [];
  if (!fresh.length) return 0;

  let sent = 0;
  for (const s of due) {
    const from = Date.parse(s.last_notified_at ?? s.created_at);
    const match = matcher(s.params, settings.get(s.user_id)?.plz ?? null);
    const hits = fresh.filter((r) => Date.parse(r.created_at) > from && match(r));
    if (!hits.length) continue;
    const to = await emailOf(s.user_id);
    if (!to) continue;

    const lines = hits.slice(0, 5).map(
      (r) =>
        `${r.brand} ${r.model}${r.variant ? ` ${r.variant}` : ""}\n${r.year} · ${kmFmt(r.km)} · ${chf(r.price)} · ${r.ort}\n${SITE}/inserat/${r.slug}`,
    );
    const more = hits.length > 5 ? `\n… und ${hits.length - 5} weitere: ${SITE}/inserate/?${s.params}\n` : "";
    const betrieb = new URLSearchParams(s.params).has("betrieb")
      ? "\nDen Filter «Betrieb bis» rechnen wir mit deinem Fahrprofil auf der Seite — prüf die Kosten dort.\n"
      : "";
    const subject =
      hits.length === 1
        ? `Neu: ${hits[0].brand} ${hits[0].model} für «${s.label}»`
        : `${hits.length} neue Autos für «${s.label}»`;
    const text =
      `Neu für dein Suchabo «${s.label}»:\n\n${lines.join("\n\n")}\n${more}${betrieb}\n` +
      `Suchabo ändern oder abbestellen: ${SITE}/konto/suchabos/\n— EV4U`;

    if (await sendMail(to, subject, text)) {
      await admin.from("saved_searches").update({ last_notified_at: new Date(now).toISOString() }).eq("id", s.id);
      sent++;
    }
  }
  return sent;
}

/* ---------- Merkliste ------------------------------------------------------- */

type Fav = {
  user_id: string;
  listing_slug: string;
  saved_price: number | null;
  notified_price: number | null;
  notified_status: string | null;
};

type FavListing = { slug: string; brand: string; model: string; price: number; status: string; hidden_at: string | null };

const OFFLINE = "OFFLINE";

async function runMerkliste(settings: Map<string, Settings>): Promise<number> {
  const { data } = await admin
    .from("favorites")
    .select("user_id,listing_slug,saved_price,notified_price,notified_status")
    .limit(10_000);
  const favs = (data as Fav[]) ?? [];
  if (!favs.length) return 0;

  const slugs = [...new Set(favs.map((f) => f.listing_slug))];
  const listings = new Map<string, FavListing>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data: ls } = await admin
      .from("listings")
      .select("slug,brand,model,price,status,hidden_at")
      .in("slug", slugs.slice(i, i + 200));
    for (const l of (ls as FavListing[]) ?? []) listings.set(l.slug, l);
  }

  type Line = { short: string; long: string };
  type Change = { fav: Fav; price: number | null; status: string; line: Line | null };
  const perUser = new Map<string, Change[]>();

  for (const f of favs) {
    const l = listings.get(f.listing_slug);
    const online = l && !l.hidden_at && ["AKTIV", "RESERVIERT", "VERKAUFT"].includes(l.status);
    const status = online ? l!.status : OFFLINE;
    const price = online ? l!.price : f.notified_price;
    const basePrice = f.notified_price ?? f.saved_price ?? price;
    const baseStatus = f.notified_status ?? "AKTIV";
    if (status === baseStatus && price === f.notified_price) continue;

    const name = l ? `${l.brand} ${l.model}` : "Ein gemerktes Auto";
    const link = `${SITE}/inserat/${f.listing_slug}`;
    const say = (short: string, long = `${short}.`): Line => ({ short, long });
    let line: Line | null = null;
    if (status !== baseStatus) {
      if (status === "VERKAUFT") line = say(`${name} ist verkauft`);
      else if (status === "RESERVIERT") line = say(`${name} ist reserviert`);
      else if (status === OFFLINE) line = say(`${name} ist nicht mehr online`);
      else if (baseStatus === "RESERVIERT" || baseStatus === OFFLINE)
        line = say(`${name} ist wieder verfügbar`, `${name} ist wieder verfügbar: ${link}`);
    } else if (price !== null && basePrice !== null && price < basePrice) {
      line = say(`${name} ist günstiger`, `${name}: Preis gesenkt von ${chf(basePrice)} auf ${chf(price)} — ${link}`);
    }
    const list = perUser.get(f.user_id) ?? [];
    list.push({ fav: f, price, status, line });
    perUser.set(f.user_id, list);
  }

  let sent = 0;
  for (const [userId, changes] of perUser) {
    const lines = changes.map((c) => c.line).filter((x): x is Line => x !== null);
    let ok = true;
    if (lines.length && settings.get(userId)?.notify_alerts !== false) {
      const to = await emailOf(userId);
      if (to) {
        const subject = lines.length === 1 ? `Merkliste: ${lines[0].short}` : `${lines.length} Änderungen auf deiner Merkliste`;
        ok = await sendMail(
          to,
          subject,
          `Neues auf deiner Merkliste:\n\n${lines.map((l) => `· ${l.long}`).join("\n")}\n\nZur Merkliste: ${SITE}/merkliste/\nE-Mails abbestellen: ${SITE}/konto/einstellungen/\n— EV4U`,
        );
        if (ok) sent++;
      }
    }
    // The baseline moves on (also when mails are off) — nothing is sent twice.
    if (ok) {
      for (const c of changes) {
        await admin
          .from("favorites")
          .update({ notified_price: c.price, notified_status: c.status })
          .eq("user_id", c.fav.user_id)
          .eq("listing_slug", c.fav.listing_slug);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const { data } = await admin.from("account_settings").select("user_id,notify_alerts,plz");
    const settings = new Map(((data as Settings[]) ?? []).map((s) => [s.user_id, s]));
    const now = Date.now();
    const searchMails = await runSearches(now, settings);
    const merklisteMails = await runMerkliste(settings);
    return json({ searchMails, merklisteMails, resend: Boolean(RESEND) });
  } catch (e) {
    console.error("[alerts]", e);
    return json({ error: "failed" }, 500);
  }
});
