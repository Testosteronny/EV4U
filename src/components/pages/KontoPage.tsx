import { useCallback, useEffect, useState } from "react";
import { Bookmark, LogOut, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import AdminPanel from "../AdminPanel";
import Inbox from "../Inbox";
import ListingEditor, { type EditableListing } from "../ListingEditor";
import PhotoManager from "../PhotoManager";
import ProfilePanel from "../ProfilePanel";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  Segmented,
} from "../ui";
import { useListings } from "../../hooks/useListings";
import { useProfile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import { useUnread } from "../../hooks/useUnread";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { LISTING_STATI, STATUS_LABEL, vehicleTitle } from "../../utils/format";
import type { ListingStatusFull } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto — das Verkäufer-Dashboard, in Reitern statt einer einzigen langen
   Scrollstrecke: Inserate · Suchen · Nachrichten · Profil.
   RLS sorgt dafür, dass jede Abfrage nur eigene Zeilen sieht.
   ============================================================================ */

/** Die Spalten, die Liste UND Bearbeiten brauchen — eine Abfrage für beides. */
const MY_LISTING_COLUMNS =
  "id,slug,brand,model,segment,year,km,price,price_new,range_km,consumption,charge_min,dc_kw,battery_kwh,weight_kg,soh,bidi,seats,ort,note,status,photos";

type MyListing = EditableListing & {
  status: ListingStatusFull;
  photos: string[] | null;
};

type SavedSearch = { id: string; label: string; params: string };

type Tab = "inserate" | "suchen" | "nachrichten" | "profil";

export default function KontoPage() {
  const { session, ready } = useSession();
  const { profile, isAdmin, update } = useProfile(session?.user.id);
  const { refresh } = useListings();
  const unread = useUnread();

  const [tab, setTab] = useState<Tab>("inserate");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyListing[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [editing, setEditing] = useState<MyListing | null>(null);

  const loadMine = useCallback(async () => {
    if (!supabase || !session) return;
    const { data } = await supabase
      .from("listings")
      .select(MY_LISTING_COLUMNS)
      .eq("owner", session.user.id)
      .order("created_at", { ascending: false });
    setMine((data as unknown as MyListing[]) ?? []);
  }, [session]);

  const loadSearches = useCallback(async () => {
    if (!supabase || !session) return;
    const { data } = await supabase
      .from("saved_searches")
      .select("id,label,params")
      .order("created_at", { ascending: false });
    setSearches((data as SavedSearch[]) ?? []);
  }, [session]);

  useEffect(() => {
    void loadMine();
    void loadSearches();
  }, [loadMine, loadSearches]);

  const sendLink = async () => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${href("/konto")}` },
    });
    if (err) setError(err.message);
    else setSent(true);
  };

  const setStatus = async (slug: string, status: ListingStatusFull) => {
    if (!supabase) return;
    await supabase.from("listings").update({ status }).eq("slug", slug);
    await Promise.all([loadMine(), refresh()]);
  };

  const remove = async (l: MyListing) => {
    if (!supabase) return;
    if (!window.confirm(`«${vehicleTitle(l)}» endgültig löschen?`)) return;
    await supabase.from("listings").delete().eq("slug", l.slug);
    await Promise.all([loadMine(), refresh()]);
  };

  if (!supabase) {
    return (
      <div className="mx-auto max-w-352 px-4 py-10 sm:px-6">
        <PageHeader title="Konto" lead="Backend nicht konfiguriert." />
        <p className="mt-6 max-w-prose text-body text-fg2">
          <code className="rounded-chip bg-surface2 px-1.5 py-0.5 text-small">
            PUBLIC_SUPABASE_URL
          </code>{" "}
          und{" "}
          <code className="rounded-chip bg-surface2 px-1.5 py-0.5 text-small">
            PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          in <code className="text-small">.env</code> setzen. Der Katalog
          funktioniert ohne Konto weiter — er zeigt dann die mitgelieferten
          Beispielinserate.
        </p>
      </div>
    );
  }

  /* ---- Auf die Antwort warten ------------------------------------------
     Vorher rendete diese Seite in dieser Phase `null`: ein weisses Nichts
     zwischen Seitenaufruf und Auth-Antwort, das wie ein Fehler aussah. */
  if (!ready) {
    return (
      <div className="mx-auto max-w-352 px-4 py-10 sm:px-6">
        <PageHeader title="Konto" />
        <div className="card mx-auto mt-8 max-w-md p-6">
          <div className="h-4 w-32 animate-pulse rounded-sm bg-surface2" />
          <div className="mt-3 h-11 animate-pulse rounded-card bg-surface2" />
          <p className="mt-4 text-small text-fg3">Anmeldung wird geprüft…</p>
        </div>
      </div>
    );
  }

  /* ---- Nicht angemeldet: Login per Magic Link ---------------------------- */
  if (!session) {
    return (
      <div className="mx-auto max-w-352 animate-fade-in px-4 py-10 sm:px-6">
        <PageHeader title="Konto" lead="Anmelden ohne Passwort." />
        <div className="card mx-auto mt-8 max-w-md p-6">
          {sent ? (
            <div className="space-y-3">
              <Badge tone="positive">Link gesendet</Badge>
              <p className="text-body text-fg2">
                Prüf dein Postfach ({email}) — der Link meldet dich ohne Passwort
                an.
              </p>
            </div>
          ) : (
            <>
              <Field label="E-Mail-Adresse">
                <div className="relative">
                  <Mail
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendLink()}
                    placeholder="deine@mail.ch"
                    autoComplete="email"
                    className="field pl-9"
                  />
                </div>
              </Field>
              {error && <p className="mt-2 text-small text-caution">{error}</p>}
              <Button
                onClick={() => void sendLink()}
                disabled={!/.+@.+\..+/.test(email)}
                variant="primary"
                className="mt-4 w-full"
              >
                Login-Link senden
              </Button>
              <p className="mt-3 text-small text-fg3">
                Kein Passwort, kein Registrierungsformular — der erste Login legt
                dein Verkäuferprofil automatisch an.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "inserate", label: "Inserate", count: mine.length },
    { key: "suchen", label: "Suchen", count: searches.length },
    { key: "nachrichten", label: "Nachrichten", count: unread },
    { key: "profil", label: "Profil" },
  ];

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Konto" lead={session.user.email ?? undefined}>
        <Button onClick={() => supabase?.auth.signOut()} variant="secondary" size="sm">
          <LogOut size={14} aria-hidden /> Abmelden
        </Button>
      </PageHeader>

      {/* Reiter */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-body font-medium transition-colors ${
              tab === t.key
                ? "border-accent text-fg"
                : "border-transparent text-fg2 hover:text-fg"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`rounded-full px-1.5 text-small tabular ${
                  t.key === "nachrichten"
                    ? "bg-accent text-on-accent"
                    : "bg-surface2 text-fg3"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "inserate" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-prose text-body text-fg2">
                Status steuerst du hier; publiziert ist ein Inserat ab «Aktiv».
              </p>
              <LinkButton href={href("/verkaufen")} variant="primary" size="sm">
                <Plus size={14} aria-hidden /> Neues Inserat
              </LinkButton>
            </div>
            {mine.length === 0 ? (
              <EmptyState
                title="Noch keine Inserate."
                hint="Erfasse dein erstes Auto — als Entwurf. Publizieren kannst du danach hier."
              >
                <LinkButton href={href("/verkaufen")} variant="primary" size="sm">
                  Inserat erfassen
                </LinkButton>
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {mine.map((l) => (
                  <div key={l.slug} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <a
                          href={href(`/inserat/${l.slug}`)}
                          className="text-h3 font-semibold text-fg transition-colors hover:text-accent"
                        >
                          {vehicleTitle(l)}
                        </a>
                        <div className="text-body text-fg2 tabular">
                          CHF {fmtCH(l.price)}
                          <span className="ml-2 text-small text-fg3">
                            {l.year} · {fmtCH(l.km)} km
                          </span>
                        </div>
                        {l.status === "ENTWURF" && (
                          <p className="mt-1.5 max-w-prose text-small text-fg3">
                            Entwurf — nur für dich sichtbar. Ergänze Fotos und
                            Beschreibung, dann auf «Aktiv» stellen.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                          size="sm"
                          options={LISTING_STATI.map((s) => ({
                            key: s,
                            label: STATUS_LABEL[s],
                          }))}
                          value={l.status}
                          onChange={(s) => void setStatus(l.slug, s)}
                        />
                        <Button onClick={() => setEditing(l)} variant="secondary" size="sm">
                          <Pencil size={14} aria-hidden /> Bearbeiten
                        </Button>
                        <Button
                          onClick={() => void remove(l)}
                          title="Inserat löschen"
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 size={14} aria-hidden />
                          <span className="sr-only">Löschen</span>
                        </Button>
                      </div>
                    </div>
                    <PhotoManager
                      listingId={l.id}
                      slug={l.slug}
                      photos={l.photos ?? []}
                      userId={session.user.id}
                      onChanged={() => void Promise.all([loadMine(), refresh()])}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "suchen" && (
          <>
            {searches.length === 0 ? (
              <EmptyState
                title="Keine gespeicherten Suchen."
                hint="Stell im Katalog deine Filter ein und speichere sie — so kommst du mit einem Klick zurück."
              >
                <LinkButton href={href("/inserate")} variant="primary" size="sm">
                  Zum Katalog
                </LinkButton>
              </EmptyState>
            ) : (
              <>
                <div className="space-y-2">
                  {searches.map((s) => (
                    <div
                      key={s.id}
                      className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <a
                        href={`${href("/inserate")}?${s.params}`}
                        className="flex items-center gap-2 text-body text-fg transition-colors hover:text-accent"
                      >
                        <Bookmark size={15} className="text-fg3" aria-hidden />
                        {s.label}
                      </a>
                      <button
                        onClick={async () => {
                          await supabase?.from("saved_searches").delete().eq("id", s.id);
                          void loadSearches();
                        }}
                        title="Suche löschen"
                        className="grid h-8 w-8 place-items-center rounded-chip text-fg3 transition-colors hover:bg-surface2 hover:text-fg"
                      >
                        <Trash2 size={14} aria-hidden />
                        <span className="sr-only">Suche löschen</span>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-small text-fg3">
                  E-Mail-Benachrichtigung bei neuen Treffern ist geplant.
                </p>
              </>
            )}
          </>
        )}

        {tab === "nachrichten" && <Inbox userId={session.user.id} />}

        {tab === "profil" && (
          <div className="space-y-6">
            {profile && <ProfilePanel profile={profile} onSave={update} />}
            {isAdmin && <AdminPanel userId={session.user.id} />}
          </div>
        )}
      </div>

      {editing && (
        <ListingEditor
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void Promise.all([loadMine(), refresh()])}
        />
      )}
    </div>
  );
}
