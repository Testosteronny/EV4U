import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button, Field, Notice } from "../ui";
import { useSession } from "../../hooks/useSession";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";

/* ============================================================================
   /login (Konzept §4.11) — one magic-link page instead of inline prompts
   scattered over components. `next` is where the link brings you back:
   the listing you wanted to write to, the search you wanted to save. Only
   paths on this site are accepted (no open redirect).
   ============================================================================ */

function safeNext(raw: string | null): string {
  const fallback = href("/konto");
  // Browsers read «/\evil.com» as «//evil.com», so resolve the URL instead
  // of trusting a prefix check.
  if (!raw?.startsWith("/") || raw.includes("\\")) return fallback;
  try {
    const url = new URL(raw, location.origin);
    const base = href("/").replace(/\/$/, "");
    if (url.origin !== location.origin || !`${url.pathname}/`.startsWith(`${base}/`)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export default function LoginPage() {
  const { session, ready } = useSession();
  const [next, setNext] = useState(href("/konto"));
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(location.search).get("next")));
  }, []);

  // Already logged in (or just came back from the link): straight on.
  useEffect(() => {
    if (ready && session) window.location.replace(next);
  }, [ready, session, next]);

  const send = async () => {
    if (!supabase || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setState("sending");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}${next}` },
    });
    if (err) {
      setError(err.message);
      setState("error");
    } else setState("sent");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-display font-bold text-fg">Anmelden</h1>
      <p className="mt-2 text-body text-fg2">
        Ohne Passwort: Wir schicken dir einen Link per E-Mail. Beim ersten Mal entsteht dein Konto automatisch.
      </p>
      <div className="card mt-6 p-6">
        {!supabase ? (
          <Notice>Anmelden geht in dieser Umgebung nicht — das Backend ist nicht konfiguriert.</Notice>
        ) : state === "sent" ? (
          <Notice tone="success">
            Prüf dein Postfach ({email.trim()}): Der Link meldet dich an und bringt dich zurück, wo du warst.
          </Notice>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Field label="E-Mail-Adresse">
              <div className="relative">
                <Mail size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@email.ch"
                  autoComplete="email"
                  autoFocus
                  className="field pl-9"
                />
              </div>
            </Field>
            {state === "error" && <Notice tone="danger" className="mt-3">{error || "Das hat nicht geklappt."}</Notice>}
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sendet…" : "Login-Link senden"}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-4 text-small text-fg3">
        Mit dem Anmelden akzeptierst du die{" "}
        <a href={href("/agb")} className="link">
          AGB
        </a>{" "}
        und die{" "}
        <a href={href("/datenschutz")} className="link">
          Datenschutzerklärung
        </a>
        .
      </p>
    </div>
  );
}
