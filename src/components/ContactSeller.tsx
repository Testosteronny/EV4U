import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { href } from "../lib/url";
import type { Listing } from "../data/evData";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { Stamp } from "./ui";

/* ============================================================================
   ContactSeller — the inquiry panel on a listing detail page.
   Creates (or reuses) the conversation for (listing, buyer) and posts the
   message. Hidden for platform-seeded listings (no owner) and for the
   seller's own ads. RLS guarantees only the two participants ever read it.
   ============================================================================ */

export default function ContactSeller({ listing }: { listing: Listing }) {
  const { session } = useSession();
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Not messageable: no backend, platform listing, or my own ad.
  if (!supabase || !listing.uid || !listing.owner) return null;
  if (session && session.user.id === listing.owner) return null;

  const send = async () => {
    if (!session || !supabase || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const existing = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.uid)
        .eq("buyer", session.user.id)
        .maybeSingle();
      let convId = existing.data?.id as string | undefined;
      if (!convId) {
        const ins = await supabase
          .from("conversations")
          .insert({ listing_id: listing.uid, buyer: session.user.id })
          .select("id")
          .single();
        if (ins.error) throw ins.error;
        convId = ins.data.id as string;
      }
      const msg = await supabase
        .from("messages")
        .insert({ conversation_id: convId, sender: session.user.id, body: body.trim() });
      if (msg.error) throw msg.error;
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        <MessageSquare size={13} className="text-signal" />
        Nachricht an {listing.seller}
      </div>

      {sent ? (
        <div className="flex flex-wrap items-center gap-4">
          <Stamp>Gesendet</Stamp>
          <p className="font-mono text-[10px] tracking-[0.15em] text-muted">
            ANTWORTEN LANDEN IN DEINEM{" "}
            <a href={href("/konto")} className="text-signal hover:underline">
              POSTFACH AUF /KONTO
            </a>
            .
          </p>
        </div>
      ) : !session ? (
        <p className="font-mono text-[10px] leading-relaxed tracking-[0.15em] text-muted">
          ZUM SCHREIBEN ANMELDEN —{" "}
          <a href={href("/konto")} className="text-signal hover:underline">
            LOGIN-LINK AUF /KONTO
          </a>
          . DEINE NACHRICHT SIEHT NUR DER ANBIETER.
        </p>
      ) : (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={`Frage zu ${listing.brand} ${listing.model} — Probefahrt, Zustand, Preis…`}
            className="w-full resize-none border border-line bg-nacht px-4 py-3 font-mono text-sm text-ink placeholder:text-muted/50 focus:border-signal focus:outline-none"
          />
          {error && (
            <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-warn">
              {error.toUpperCase()}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] tracking-[0.12em] text-muted/60">
              NUR DU UND DER ANBIETER — KEINE ÖFFENTLICHEN KOMMENTARE.
            </span>
            <button
              onClick={() => void send()}
              disabled={busy || !body.trim()}
              className="border border-signal bg-signal px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
            >
              {busy ? "Sendet…" : "Senden"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
