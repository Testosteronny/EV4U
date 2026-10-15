import { useEffect, useState } from "react";
import { BadgeCheck, Trash2 } from "lucide-react";
import KontoLayout, { type KontoCtx } from "./KontoLayout";
import { FahrprofilForm } from "../layout/Fahrprofil";
import { useTheme } from "../layout/ThemeToggle";
import { Badge, Button, Field, Notice, Segmented, Toggle } from "../ui";
import { useAccountSettings } from "../../hooks/useAccountSettings";
import type { Profile } from "../../hooks/useProfile";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";

/* ============================================================================
   /konto/einstellungen — account, Fahrprofil, e-mails, look, and leaving.
   The Fahrprofil fields are the same ones as in the header sheet; with an
   account AccountSync mirrors them into account_settings. Deleting the
   account runs the `delete-account` Edge Function (photos, then the auth
   user; the database cascades the rest).
   ============================================================================ */

export default function EinstellungenPage() {
  return (
    <KontoLayout active="einstellungen" title="Einstellungen">
      {(ctx) => <Settings {...ctx} />}
    </KontoLayout>
  );
}

function Settings({ userId, email, profile, updateProfile }: KontoCtx) {
  return (
    <div className="space-y-6">
      <AccountCard email={email} profile={profile} onSave={updateProfile} />
      <section className="card p-5 sm:p-6" aria-labelledby="fahrprofil">
        <h2 id="fahrprofil" className="text-h2 font-bold text-fg">
          Fahrprofil
        </h2>
        <p className="mt-1 max-w-prose text-body text-fg2">
          Damit rechnet EV4U jede Zahl für dich: Stromtarif deiner Gemeinde, Verkehrssteuer, Distanz. Mit Konto auf allen
          Geräten gleich.
        </p>
        <div className="mt-6">
          <FahrprofilForm />
        </div>
      </section>
      <NotifyCard userId={userId} />
      <LookCard />
      <DeleteCard />
    </div>
  );
}

function AccountCard({
  email,
  profile,
  onSave,
}: {
  email: string;
  profile: Profile | null;
  onSave: KontoCtx["updateProfile"];
}) {
  const [type, setType] = useState<Profile["type"]>(profile?.type ?? "PRIVAT");
  const [name, setName] = useState(profile?.name ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setType(profile?.type ?? "PRIVAT");
    setName(profile?.name ?? "");
  }, [profile]);

  const dirty = type !== (profile?.type ?? "PRIVAT") || name.trim() !== (profile?.name ?? "");

  const save = async () => {
    setState("saving");
    setError(null);
    const err = await onSave({ type, name: name.trim().slice(0, 80) });
    if (err) {
      setError(err);
      setState("idle");
    } else setState("saved");
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="konto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="konto" className="text-h2 font-bold text-fg">
          Konto
        </h2>
        {profile?.verified && (
          <Badge tone="positive">
            <BadgeCheck size={13} aria-hidden /> Verifizierte Garage
          </Badge>
        )}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="E-Mail" hint="Zum Anmelden und für Benachrichtigungen. Käufer sehen sie nie.">
          <input value={email} readOnly className="field bg-surface2 text-fg2" />
        </Field>
        <div>
          <span className="mb-1.5 block text-small font-semibold text-fg2">Ich verkaufe als</span>
          <Segmented
            label="Kontotyp"
            options={[
              { key: "PRIVAT" as const, label: "Privatperson" },
              { key: "GARAGE" as const, label: "Garage" },
            ]}
            value={type}
            onChange={(t) => {
              setType(t);
              setState("idle");
            }}
          />
        </div>
        <Field
          label={type === "GARAGE" ? "Name der Garage" : "Anzeigename"}
          hint="Steht als Anbieter auf deinen Inseraten und in Nachrichten."
        >
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setState("idle");
            }}
            maxLength={80}
            autoComplete={type === "GARAGE" ? "organization" : "nickname"}
            className="field"
          />
        </Field>
      </div>
      {type === "GARAGE" && (
        <p className="mt-4 text-small text-fg2">
          Adresse, UID, Öffnungszeiten und deine öffentliche Garagenseite pflegst du unter{" "}
          <a href={href("/konto/garage")} className="link font-semibold">
            Garage
          </a>
          .
        </p>
      )}
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
        {state === "saved" && !dirty && <span className="text-small font-semibold text-accent">Gespeichert</span>}
        <Button variant="primary" onClick={() => void save()} disabled={!dirty || !name.trim() || state === "saving"}>
          {state === "saving" ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}

function NotifyCard({ userId }: { userId: string }) {
  const { settings, update } = useAccountSettings(userId);
  const [error, setError] = useState<string | null>(null);
  const set = async (fields: { notify_messages?: boolean; notify_alerts?: boolean }) => {
    setError(await update(fields));
  };
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="mails">
      <h2 id="mails" className="text-h2 font-bold text-fg">
        E-Mails
      </h2>
      <div className="mt-5 space-y-5">
        <Toggle
          label="Neue Nachrichten"
          hint="Wenn dir jemand zu einem Inserat schreibt oder antwortet."
          checked={settings?.notify_messages ?? true}
          disabled={!settings}
          onChange={(v) => void set({ notify_messages: v })}
        />
        <Toggle
          label="Suchabos und Merkliste"
          hint="Neue Treffer deiner Suchabos, Preissenkungen und Statuswechsel gemerkter Autos."
          checked={settings?.notify_alerts ?? true}
          disabled={!settings}
          onChange={(v) => void set({ notify_alerts: v })}
        />
      </div>
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <p className="mt-4 text-small text-fg3">
        Den Rhythmus jedes Suchabos stellst du unter{" "}
        <a href={href("/konto/suchabos")} className="link">
          Suchabos
        </a>{" "}
        ein. Den{" "}
        <a href={href("/monatsbrief")} className="link">
          Monatsbrief
        </a>{" "}
        abonnierst du separat, mit Bestätigung per E-Mail.
      </p>
    </section>
  );
}

function LookCard() {
  const [dark, toggle] = useTheme();
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="look">
      <h2 id="look" className="text-h2 font-bold text-fg">
        Darstellung
      </h2>
      <div className="mt-5">
        <Toggle label="Dunkler Modus" hint="Gilt für dieses Gerät." checked={dark} onChange={() => toggle()} />
      </div>
    </section>
  );
}

function DeleteCard() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");

  const remove = async () => {
    if (!supabase || confirm.trim().toUpperCase() !== "LÖSCHEN") return;
    setState("deleting");
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      setState("error");
      return;
    }
    await supabase.auth.signOut();
    window.location.assign(href("/"));
  };

  return (
    <section className="card border-danger/30 p-5 sm:p-6" aria-labelledby="loeschen">
      <h2 id="loeschen" className="text-h2 font-bold text-fg">
        Konto löschen
      </h2>
      <p className="mt-1 max-w-prose text-body text-fg2">
        Löscht dein Konto mit allen Inseraten, Fotos, Nachrichten, Suchabos und der Merkliste. Das lässt sich nicht
        rückgängig machen.
      </p>
      {!open ? (
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 size={16} aria-hidden /> Konto löschen…
        </Button>
      ) : (
        <form
          className="mt-4 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void remove();
          }}
        >
          <Field label="Zur Bestätigung LÖSCHEN eintippen">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="field" />
          </Field>
          {state === "error" && (
            <Notice tone="danger" className="mt-3">
              Löschen hat nicht geklappt. Schreib uns an hallo@ev4u.ch, wir erledigen es von Hand.
            </Notice>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="submit"
              variant="danger"
              disabled={confirm.trim().toUpperCase() !== "LÖSCHEN" || state === "deleting"}
            >
              {state === "deleting" ? "Löscht…" : "Endgültig löschen"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
