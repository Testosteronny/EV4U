import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button, ChipGroup, Field, LinkButton, Notice, Sheet } from "../ui";
import { useSession } from "../../hooks/useSession";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";

/* ============================================================================
   «Suchabo speichern» (Konzept F7) — a saved search with e-mail alerts.

   Logged out, the button leads to /login and comes back with `abo=1`, which
   opens the dialog again — the click is never lost. The search itself is
   the URL query, the same one the results page reads.
   ============================================================================ */

export type Frequency = "SOFORT" | "TAEGLICH" | "WOECHENTLICH" | "AUS";

export const FREQUENCIES: { key: Frequency; label: string; hint: string }[] = [
  { key: "SOFORT", label: "Sofort", hint: "Eine E-Mail, sobald ein passendes Auto online ist" },
  { key: "TAEGLICH", label: "Täglich", hint: "Höchstens eine E-Mail pro Tag" },
  { key: "WOECHENTLICH", label: "Wöchentlich", hint: "Eine Zusammenfassung pro Woche" },
  { key: "AUS", label: "Keine E-Mails", hint: "Nur im Konto sichtbar" },
];

/** Opens the dialog when the page was reached with `abo=1` (after login). */
export function useAboParam(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("abo") !== "1") return;
    sp.delete("abo");
    const qs = sp.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
    setOpen(true);
  }, []);
  return [open, () => setOpen(false)];
}

export default function SaveSearch({
  params,
  label,
  variant = "secondary",
  compact = false,
  autoOpen = false,
  onAutoOpenHandled,
}: {
  /** The filter query, exactly as /inserate reads it. */
  params: string;
  /** Suggested name, e.g. «Tesla Model Y bis CHF 40'000». */
  label: string;
  variant?: "primary" | "secondary" | "onForest";
  compact?: boolean;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}) {
  const { session, ready } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const [frequency, setFrequency] = useState<Frequency>("TAEGLICH");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [next, setNext] = useState("");

  useEffect(() => setName(label), [label]);
  useEffect(() => {
    const sp = new URLSearchParams(params);
    sp.set("abo", "1");
    setNext(`${window.location.pathname}?${sp.toString()}`);
  }, [params]);
  useEffect(() => {
    if (autoOpen && ready && session) {
      setOpen(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpen, ready, session, onAutoOpenHandled]);

  const save = async () => {
    if (!supabase || !session) return;
    setState("saving");
    const { error } = await supabase.from("saved_searches").insert({
      user_id: session.user.id,
      label: name.trim().slice(0, 120) || "Meine Suche",
      params: params.slice(0, 500),
      frequency,
    });
    setState(error ? "error" : "saved");
  };

  const icon = state === "saved" ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />;
  const text = state === "saved" ? "Suchabo gespeichert" : "Suchabo speichern";

  if (!ready || !session) {
    return (
      <LinkButton
        href={`${href("/login")}?next=${encodeURIComponent(next)}`}
        variant={variant}
        size={compact ? "sm" : "md"}
        aria-label={compact ? text : undefined}
      >
        {icon}
        {!compact && text}
      </LinkButton>
    );
  }

  return (
    <>
      <Button
        onClick={() => {
          setState("idle");
          setOpen(true);
        }}
        variant={variant}
        size={compact ? "sm" : "md"}
        aria-label={compact ? text : undefined}
      >
        {icon}
        {!compact && text}
      </Button>
      {open && (
        <Sheet
          title="Suchabo speichern"
          onClose={() => setOpen(false)}
          footer={
            state === "saved" ? (
              <>
                <a href={href("/konto/suchabos")} className="link text-body font-semibold">
                  Suchabos verwalten
                </a>
                <Button variant="primary" onClick={() => setOpen(false)}>
                  Fertig
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button variant="primary" onClick={() => void save()} disabled={state === "saving"}>
                  {state === "saving" ? "Speichert…" : "Speichern"}
                </Button>
              </>
            )
          }
        >
          {state === "saved" ? (
            <Notice tone="success">
              Gespeichert. {frequency === "AUS"
                ? "Neue Treffer siehst du im Konto unter Suchabos."
                : `Neue Treffer kommen per E-Mail an ${session.user.email}.`}
            </Notice>
          ) : (
            <div className="space-y-5">
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="field" />
              </Field>
              <div>
                <span className="mb-1.5 block text-small font-semibold text-fg2">Benachrichtigung</span>
                <ChipGroup
                  label="Wie oft benachrichtigen?"
                  options={FREQUENCIES.map((f) => ({ key: f.key, label: f.label, hint: f.hint }))}
                  value={frequency}
                  onChange={setFrequency}
                />
                <p className="mt-1.5 text-small text-fg3">{FREQUENCIES.find((f) => f.key === frequency)?.hint}</p>
              </div>
              {state === "error" && <Notice tone="danger">Speichern hat nicht geklappt. Bitte nochmals versuchen.</Notice>}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
