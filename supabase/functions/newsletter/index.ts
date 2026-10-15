/* ============================================================================
   Edge Function `newsletter` — der Monatsbrief, mit Double-Opt-in.

   POST { action: "subscribe", email }  → row (unconfirmed) + confirmation mail
   POST { action: "confirm", token }    → confirmed_at = now
   POST { action: "unsubscribe", token } → row deleted

   newsletter_subscribers has RLS without policies: only this function (with
   the service role) reads or writes it. «subscribe» answers the same way for
   new, pending and confirmed addresses, so it can't be used to find out who
   subscribes. Without RESEND_API_KEY the mail is logged, not sent.
   ============================================================================ */

import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const SITE = (Deno.env.get("SITE_URL") ?? "https://testosteronny.github.io/EV4U").replace(/\/$/, "");
const RESEND = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("MAIL_FROM") ?? "EV4U <noreply@ev4u.ch>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A pending address gets at most one confirmation mail per 10 minutes. */
const RESEND_AFTER_MS = 10 * 60_000;

async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!RESEND) {
    console.log(`[newsletter] RESEND_API_KEY not set — would mail ${to}: ${subject}\n${text}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!res.ok) console.error(`[newsletter] resend ${res.status}`);
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { action?: string; email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  if (body.action === "subscribe") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "invalid email" }, 400);

    const { data: existing } = await admin
      .from("newsletter_subscribers")
      .select("token,confirmed_at,created_at")
      .eq("email", email)
      .maybeSingle();
    if (existing?.confirmed_at) return json({ ok: true });
    if (existing && Date.now() - Date.parse(existing.created_at) < RESEND_AFTER_MS) return json({ ok: true });

    let token = existing?.token as string | undefined;
    if (existing) {
      // Re-requested after a while: fresh timestamp for the rate limit.
      await admin.from("newsletter_subscribers").update({ created_at: new Date().toISOString() }).eq("email", email);
    } else {
      const { data, error } = await admin.from("newsletter_subscribers").insert({ email }).select("token").single();
      if (error || !data) return json({ error: "failed" }, 500);
      token = data.token;
    }

    const ok = await sendMail(
      email,
      "Bitte bestätigen: Monatsbrief von EV4U",
      `Hoi!\n\nDu (oder jemand mit deiner Adresse) möchtest den Monatsbrief von EV4U bekommen: einmal im Monat, was sich bei gebrauchten E-Autos in der Schweiz bewegt.\n\nBestätigen: ${SITE}/monatsbrief/?bestaetigen=${token}\n\nWar das nicht du? Dann ignoriere diese Mail — ohne Bestätigung schicken wir nichts.\n— EV4U`,
    );
    return ok ? json({ ok: true }) : json({ error: "mail failed" }, 502);
  }

  if (body.action === "confirm" || body.action === "unsubscribe") {
    const token = String(body.token ?? "");
    if (!UUID_RE.test(token)) return json({ error: "invalid token" }, 400);
    if (body.action === "confirm") {
      const { data } = await admin
        .from("newsletter_subscribers")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("token", token)
        .select("email");
      return data?.length ? json({ ok: true }) : json({ error: "unknown token" }, 404);
    }
    const { data } = await admin.from("newsletter_subscribers").delete().eq("token", token).select("email");
    return data?.length ? json({ ok: true }) : json({ error: "unknown token" }, 404);
  }

  return json({ error: "unknown action" }, 400);
});
