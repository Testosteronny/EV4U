import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button, Chip, LinkButton, Notice, Sheet } from "../ui";
import { useSession } from "../../hooks/useSession";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Kontakt mit Absicht (F14) — the message sheet opens with intents that
   pre-fill the text, so the first message already says what the buyer
   wants. Same backend as before: one conversation per buyer and listing,
   readable only by the two of them (RLS); the seller gets an e-mail
   (Edge Function `notify-message`).

   Logged out, the button leads to /login and back with `kontakt=1`, which
   opens this sheet again — the intent is not lost.
   ============================================================================ */

export type Intent = "verfuegbar" | "probefahrt" | "batterie" | "preis";

export const INTENTS: { key: Intent; label: string; text: (l: Listing) => string }[] = [
  {
    key: "verfuegbar",
    label: "Noch verfügbar?",
    text: (l) => `Grüezi, ist der ${vehicleTitle(l)} noch verfügbar?`,
  },
  {
    key: "probefahrt",
    label: "Probefahrt",
    text: (l) =>
      `Grüezi, ich interessiere mich für den ${vehicleTitle(l)} und würde ihn gerne Probe fahren. Wann würde es Ihnen passen?`,
  },
  {
    key: "batterie",
    label: "Frage zur Batterie",
    text: (l) =>
      `Grüezi, wie wurde der Batteriezustand (SOH ${l.soh} %) gemessen, und gibt es ein Protokoll oder einen Ausdruck dazu?`,
  },
  {
    key: "preis",
    label: "Preisvorschlag",
    text: (l) =>
      `Grüezi, ich interessiere mich für den ${vehicleTitle(l)}. Wären Sie mit CHF ${fmtCH(Math.round((l.price * 0.95) / 100) * 100)} einverstanden?`,
  },
];

/** Can this listing be written to at all, and by whom? */
export function contactState(listing: Listing, userId: string | undefined) {
  if (listing.isDemo) return "demo" as const;
  if (!supabase || !listing.uid || !listing.owner) return "platform" as const;
  if (userId && listing.owner === userId) return "mine" as const;
  if (listing.status === "VERKAUFT") return "sold" as const;
  return "open" as const;
}

export default function ContactSheet({
  listing,
  intent,
  onClose,
}: {
  listing: Listing;
  intent?: Intent;
  onClose: () => void;
}) {
  const { session, ready } = useSession();
  const [chosen, setChosen] = useState<Intent | null>(intent ?? null);
  const [body, setBody] = useState(intent ? INTENTS.find((i) => i.key === intent)!.text(listing) : "");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [convId, setConvId] = useState<string | null>(null);
  const [next, setNext] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("kontakt", "1");
    setNext(`${window.location.pathname}?${sp.toString()}`);
  }, []);

  const pick = (i: (typeof INTENTS)[number]) => {
    setChosen(i.key);
    setBody(i.text(listing));
  };

  const send = async () => {
    if (!session || !supabase || !body.trim() || !listing.uid) return;
    setState("sending");
    try {
      const existing = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.uid)
        .eq("buyer", session.user.id)
        .maybeSingle();
      let id = existing.data?.id as string | undefined;
      if (!id) {
        const ins = await supabase
          .from("conversations")
          .insert({ listing_id: listing.uid, buyer: session.user.id })
          .select("id")
          .single();
        if (ins.error) throw ins.error;
        id = ins.data.id as string;
      }
      const msg = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender: session.user.id, body: body.trim().slice(0, 2000) });
      if (msg.error) throw msg.error;
      void supabase.rpc("track_listing_event", { p_listing: listing.uid, p_kind: "CONTACT" });
      setConvId(id);
      setState("sent");
    } catch {
      setState("error");
    }
  };

  const loggedIn = ready && session;

  return (
    <Sheet
      title={`Nachricht an ${listing.seller}`}
      onClose={onClose}
      footer={
        state === "sent" ? (
          <>
            <a href={`${href("/konto/nachrichten")}?c=${convId}`} className="link text-body font-semibold">
              Zum Gespräch
            </a>
            <Button variant="primary" onClick={onClose}>
              Fertig
            </Button>
          </>
        ) : loggedIn ? (
          <>
            <span className="text-small text-fg3">Nur du und der Anbieter lesen mit.</span>
            <Button variant="primary" onClick={() => void send()} disabled={state === "sending" || !body.trim()}>
              {state === "sending" ? "Sendet…" : "Senden"}
            </Button>
          </>
        ) : undefined
      }
    >
      {state === "sent" ? (
        <Notice tone="success">
          Gesendet. Die Antwort findest du in deinem Konto unter Nachrichten.
        </Notice>
      ) : !loggedIn ? (
        <div className="space-y-4">
          <p className="text-body text-fg2">
            Zum Schreiben brauchst du ein Konto — ohne Passwort, per Login-Link an deine E-Mail. Danach geht es genau
            hier weiter.
          </p>
          <LinkButton href={`${href("/login")}?next=${encodeURIComponent(next)}`} variant="primary" className="w-full">
            Anmelden und schreiben
          </LinkButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Worum geht es?">
            {INTENTS.map((i) => (
              <Chip key={i.key} active={chosen === i.key} onClick={() => pick(i)}>
                {i.label}
              </Chip>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-small font-semibold text-fg2">Deine Nachricht</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={`Frage zu ${vehicleTitle(listing)} — Probefahrt, Zustand, Preis…`}
              className="field resize-y"
            />
          </label>
          {state === "error" && <Notice tone="danger">Senden hat nicht geklappt. Bitte nochmals versuchen.</Notice>}
          <p className="flex items-start gap-2 text-small text-fg2">
            <ShieldAlert size={15} aria-hidden className="mt-0.5 shrink-0 text-fg3" />
            <span>
              Nie im Voraus bezahlen und keine Ausweiskopie verschicken.{" "}
              <a href={href("/sicherheit")} className="link">
                Sicher kaufen
              </a>
            </span>
          </p>
        </div>
      )}
    </Sheet>
  );
}
