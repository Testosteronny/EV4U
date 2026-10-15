import { useState } from "react";
import { Mail } from "lucide-react";
import { Button, Notice } from "../ui";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";

/* ============================================================================
   Monatsbrief (F21) — one e-mail a month: market, new posts, price drops.
   Double opt-in (revDSG): the Edge Function `newsletter` stores the address
   unconfirmed and sends a confirmation link; only a click on it subscribes.
   ============================================================================ */

export default function MonatsbriefBox({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async () => {
    if (!supabase || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setState("sending");
    const { error } = await supabase.functions.invoke("newsletter", {
      body: { action: "subscribe", email: email.trim() },
    });
    setState(error ? "error" : "sent");
  };

  return (
    <div className={`not-prose rounded-card bg-faint ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-accent">
          <Mail size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-h3 font-bold text-fg">Der Monatsbrief</p>
          <p className="mt-0.5 text-body text-fg2">
            Einmal im Monat: neue Beiträge, Modelle und was sich am Markt tut. Abmelden mit einem Klick.
          </p>
          {state === "sent" ? (
            <Notice tone="success" className="mt-4">
              Fast geschafft: Bitte bestätige deine Adresse über den Link in der E-Mail, die wir dir eben geschickt
              haben.
            </Notice>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="mt-4 flex flex-wrap gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                aria-label="E-Mail-Adresse"
                autoComplete="email"
                className="field min-w-0 flex-1 basis-56"
              />
              <Button type="submit" variant="primary" disabled={state === "sending" || !supabase}>
                {state === "sending" ? "Sendet…" : "Anmelden"}
              </Button>
            </form>
          )}
          {state === "error" && (
            <Notice tone="danger" className="mt-3">
              Das hat nicht geklappt. Bitte später nochmals versuchen.
            </Notice>
          )}
          <p className="mt-2 text-micro text-fg3">
            Wir verwenden deine Adresse nur für den Monatsbrief.{" "}
            <a href={href("/datenschutz")} className="underline">
              Datenschutz
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
