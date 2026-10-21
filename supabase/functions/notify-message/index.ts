/* ============================================================================
   Edge Function `notify-message` — «Neue Nachricht» per E-Mail.

   Called by the pg_net trigger messages_notify on every insert into
   messages. Looks the message up server-side (a forged payload does
   nothing), finds the OTHER participant and mails them a link straight
   into the thread (/konto/nachrichten?c=…). Each message is claimed once
   (messages.notified_at) and only while it is fresh — the anon key that
   opens this function is public, and a replayed call must not mail the
   other participant again. Quiet when
   · the recipient switched message mails off (account_settings),
   · the sender already wrote in the last 30 minutes and the recipient has
     not read it yet — one mail per burst, not one per line.
   Without RESEND_API_KEY it logs and exits 200; messaging never depends on
   mail.
   ============================================================================ */

import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const SITE = (Deno.env.get("SITE_URL") ?? "https://testosteronny.github.io/EV4U").replace(/\/$/, "");
const RESEND = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("MAIL_FROM") ?? "EV4U <noreply@ev4u.ch>";
const BURST_MS = 30 * 60_000;
/** pg_net calls within seconds; anything older is a replay. */
const FRESH_MS = 10 * 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Msg = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
  conversation_id: string;
  conversation: {
    buyer: string;
    listing: { slug: string; brand: string; model: string; owner: string | null } | null;
  } | null;
};

Deno.serve(async (req) => {
  try {
    const { message_id } = await req.json();
    if (typeof message_id !== "string") return json({ error: "bad request" }, 400);

    // Claim: only the first call for a fresh message gets the row back.
    const { data } = await admin
      .from("messages")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", message_id)
      .is("notified_at", null)
      .gte("created_at", new Date(Date.now() - FRESH_MS).toISOString())
      .select("id,sender,body,created_at,conversation_id,conversation:conversations(buyer,listing:listings(slug,brand,model,owner))")
      .maybeSingle();
    const msg = data as unknown as Msg | null;
    if (!msg?.conversation) return json({ skipped: "unknown or already notified" });

    const conv = msg.conversation;
    const recipient = msg.sender === conv.buyer ? conv.listing?.owner : conv.buyer;
    if (!recipient) return json({ skipped: "no recipient" });

    const { data: settings } = await admin
      .from("account_settings")
      .select("notify_messages")
      .eq("user_id", recipient)
      .maybeSingle();
    if (settings?.notify_messages === false) return json({ skipped: "off" });

    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", msg.conversation_id)
      .eq("sender", msg.sender)
      .is("read_at", null)
      .neq("id", msg.id)
      .gte("created_at", new Date(Date.parse(msg.created_at) - BURST_MS).toISOString());
    if (count) return json({ skipped: "burst" });

    const { data: user } = await admin.auth.admin.getUserById(recipient);
    const email = user?.user?.email;
    if (!email) return json({ skipped: "no email" });

    const { data: profile } = await admin.from("profiles").select("name").eq("id", msg.sender).maybeSingle();
    const from = profile?.name?.trim() || (msg.sender === conv.buyer ? "Eine Interessentin oder ein Interessent" : "Der Anbieter");
    const about = conv.listing ? `zum ${conv.listing.brand} ${conv.listing.model}` : "zu deinem Inserat";
    const subject = `${from} schreibt dir ${about}`;
    const text =
      `${from} schreibt dir auf EV4U ${about}:\n\n«${msg.body.slice(0, 500)}»\n\n` +
      `Antworten: ${SITE}/konto/nachrichten/?c=${msg.conversation_id}\n\n` +
      `Zahle nie im Voraus und gib keine Ausweiskopien weiter: ${SITE}/sicherheit/\n` +
      `Diese E-Mails abbestellen: ${SITE}/konto/einstellungen/\n— EV4U`;

    if (!RESEND) {
      console.log(`[notify-message] RESEND_API_KEY not set — would mail ${email}: ${subject}`);
      return json({ skipped: "no RESEND_API_KEY" });
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, text }),
    });
    if (!res.ok) console.error(`[notify-message] resend ${res.status}`);
    return json({ sent: res.ok });
  } catch (e) {
    console.error("[notify-message]", e);
    return json({ error: "failed" }, 500);
  }
});
