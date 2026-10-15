import { useEffect, useState } from "react";
import { Notice } from "../ui";
import { supabase } from "../../lib/supabase";

/* ============================================================================
   /monatsbrief?bestaetigen=<token> and ?abmelden=<token> — the two links
   the newsletter mails carry. The token is the only key; the Edge Function
   `newsletter` checks it.
   ============================================================================ */

type State = "idle" | "working" | "confirmed" | "unsubscribed" | "invalid";

export default function MonatsbriefStatus() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const confirm = sp.get("bestaetigen");
    const leave = sp.get("abmelden");
    const token = confirm ?? leave;
    if (!token || !supabase) return;
    setState("working");
    void supabase.functions
      .invoke("newsletter", { body: { action: confirm ? "confirm" : "unsubscribe", token } })
      .then(({ error }) => {
        setState(error ? "invalid" : confirm ? "confirmed" : "unsubscribed");
        history.replaceState(null, "", location.pathname);
      });
  }, []);

  if (state === "idle") return null;
  if (state === "working") return <Notice>Einen Moment…</Notice>;
  if (state === "confirmed")
    return <Notice tone="success">Bestätigt — der nächste Monatsbrief kommt zu dir. Danke!</Notice>;
  if (state === "unsubscribed")
    return <Notice tone="success">Abgemeldet. Wir haben deine Adresse gelöscht und schicken dir nichts mehr.</Notice>;
  return (
    <Notice tone="caution">
      Dieser Link ist nicht mehr gültig — vielleicht wurde er schon verwendet. Melde dich unten einfach neu an.
    </Notice>
  );
}
