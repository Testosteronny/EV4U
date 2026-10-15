import { useState } from "react";
import { BadgeCheck, Building2, MapPin, User } from "lucide-react";
import { Badge, Button, LinkButton } from "./ui";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";
import { SELLER_LABEL, vehicleTitle } from "../utils/format";
import type { Listing } from "../data/evData";

/* ============================================================================
   Verkäuferpanel — wer verkauft, und der direkte Draht dorthin.

   Vorher lag die Kontaktaufnahme weit unten und nur für Inserate mit
   Besitzer; für Plattform-Inserate gab es gar nichts. Auf einem Marktplatz
   ist das die Konversion — sie steht jetzt immer da, und die Fälle ohne
   Postfach sagen wenigstens ehrlich, was möglich ist.

   RLS garantiert, dass nur die beiden Beteiligten den Thread lesen.
   ============================================================================ */

export default function ContactSeller({ listing }: { listing: Listing }) {
  const { session } = useSession();
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const messageable = Boolean(supabase && listing.uid && listing.owner);
  const isMine = Boolean(session && listing.owner === session.user.id);
  const isGarage = listing.sellerType === "GARAGE";
  const sellerLabel = SELLER_LABEL[listing.sellerType];

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
    <section id="kontakt" className="card p-5 sm:p-6">
      <h2 className="text-h2 font-semibold text-fg">Anbieter</h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-fg2">
            {isGarage ? <Building2 size={19} /> : <User size={19} />}
          </span>
          <div>
            <div className="flex items-center gap-2 text-h3 font-semibold text-fg">
              {listing.seller}
              <Badge tone="neutral">
                {isGarage && <BadgeCheck size={13} aria-hidden />}
                {sellerLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-small text-fg2">
              <MapPin size={13} aria-hidden className="text-fg3" />
              {listing.ort}
            </div>
          </div>
        </div>
        <LinkButton href={href("/#beratung")} variant="ghost" size="sm">
          Unsicher? Frag Gabriel
        </LinkButton>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        {sent ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="positive">Nachricht gesendet</Badge>
            <p className="text-body text-fg2">
              Antworten landen in deinem{" "}
              <a
                href={href("/konto")}
                className="text-accent underline-offset-2 hover:underline"
              >
                Postfach
              </a>
              .
            </p>
          </div>
        ) : isMine ? (
          <p className="text-body text-fg2">
            Das ist dein eigenes Inserat. Anfragen erscheinen in deinem{" "}
            <a
              href={href("/konto")}
              className="text-accent underline-offset-2 hover:underline"
            >
              Postfach
            </a>
            .
          </p>
        ) : listing.isDemo ? (
          <p className="text-body text-fg2">
            Demo-Inserat — hinter diesem Auto steht kein Anbieter. Echte
            Inserate schreibst du hier direkt an.
          </p>
        ) : !messageable ? (
          <p className="text-body text-fg2">
            Dieses Inserat wird von EV4U selbst geführt — schreib uns an{" "}
            <a
              href="mailto:hallo@ev4u.ch"
              className="text-accent underline-offset-2 hover:underline"
            >
              hallo@ev4u.ch
            </a>
            , wir stellen den Kontakt her.
          </p>
        ) : !session ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-body text-fg2">
              Zum Schreiben anmelden — ohne Passwort, per Login-Link. Deine
              Nachricht sieht nur der Anbieter.
            </p>
            <LinkButton href={href("/konto")} variant="primary" size="sm">
              Anmelden & schreiben
            </LinkButton>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-small font-medium text-fg2">
                Deine Nachricht an {listing.seller}
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={`Frage zu ${vehicleTitle(listing)} — Probefahrt, Zustand, Preis…`}
                className="field resize-none"
              />
            </label>
            {error && <p className="mt-2 text-small text-caution">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-small text-fg3">
                Nur du und der Anbieter — keine öffentlichen Kommentare.
              </span>
              <Button
                onClick={() => void send()}
                disabled={busy || !body.trim()}
                variant="primary"
                size="sm"
              >
                {busy ? "Sendet…" : "Nachricht senden"}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
