import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, LogOut, Mail, Plus, Trash2 } from "lucide-react";
import Inbox from "../Inbox";
import PhotoManager from "../PhotoManager";
import { SectionHeader, Segmented, Stamp } from "../ui";
import { useListings } from "../../hooks/useListings";
import { useSession } from "../../hooks/useSession";
import { supabase, type ListingRow } from "../../lib/supabase";
import { href } from "../../lib/url";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto — the seller dashboard, no admin backend needed.
   Login: passwordless magic link (ideal for one-time private sellers).
   Logged in: my Inserate with status control (ENTWURF → AKTIV → RESERVIERT →
   VERKAUFT) and delete. RLS guarantees users only ever see and touch their
   own rows — the UI doesn't need to check anything.
   ============================================================================ */

type MyListing = Pick<
  ListingRow,
  "id" | "slug" | "brand" | "model" | "price" | "status" | "photos"
>;

type SavedSearch = { id: string; label: string; params: string };

const STATI = ["ENTWURF", "AKTIV", "RESERVIERT", "VERKAUFT"] as const;

export default function Konto() {
  const { session, ready } = useSession();
  const { refresh } = useListings();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyListing[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  const loadMine = useCallback(async () => {
    if (!supabase || !session) return;
    // RLS scopes this to the logged-in owner automatically.
    const { data } = await supabase
      .from("listings")
      .select("id,slug,brand,model,price,status,photos")
      .eq("owner", session.user.id)
      .order("created_at", { ascending: false });
    setMine((data as MyListing[]) ?? []);
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

  const setStatus = async (slug: string, status: (typeof STATI)[number]) => {
    if (!supabase) return;
    await supabase.from("listings").update({ status }).eq("slug", slug);
    await Promise.all([loadMine(), refresh()]);
  };

  const remove = async (slug: string) => {
    if (!supabase) return;
    await supabase.from("listings").delete().eq("slug", slug);
    await Promise.all([loadMine(), refresh()]);
  };

  if (!supabase) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <SectionHeader index="01" title="Konto" claim="Backend nicht konfiguriert" />
        <p className="mt-8 font-mono text-[10px] tracking-[0.15em] text-muted">
          VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY IN .ENV SETZEN.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        index="01"
        title="Konto"
        claim={session ? session.user.email ?? "Angemeldet" : "Anmelden ohne Passwort"}
      >
        {session && (
          <button
            onClick={() => supabase?.auth.signOut()}
            className="flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:border-signal hover:text-signal"
          >
            <LogOut size={12} /> Abmelden
          </button>
        )}
      </SectionHeader>

      {!ready ? null : !session ? (
        /* ---- Login: magic link ------------------------------------------- */
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="panel bg-blueprint mx-auto mt-10 max-w-lg p-6"
        >
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Login-Link anfordern
          </div>
          {sent ? (
            <div className="space-y-3">
              <Stamp>Link gesendet</Stamp>
              <p className="font-mono text-[10px] leading-relaxed tracking-[0.12em] text-muted">
                POSTFACH {email.toUpperCase()} PRÜFEN — DER LINK MELDET DICH
                OHNE PASSWORT AN.
              </p>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-3 border border-line bg-nacht px-4 py-3 focus-within:border-signal/60">
                <Mail size={16} className="shrink-0 text-muted" strokeWidth={1.5} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@mail.ch"
                  className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-muted/60 focus:outline-none"
                  aria-label="E-Mail"
                />
              </label>
              {error && (
                <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-warn">
                  {error.toUpperCase()}
                </p>
              )}
              <button
                onClick={() => void sendLink()}
                disabled={!/.+@.+\..+/.test(email)}
                className="mt-4 w-full border border-signal bg-signal px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
              >
                Login-Link senden
              </button>
              <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-muted/70">
                KEIN PASSWORT, KEIN KONTO-FORMULAR — DER ERSTE LOGIN ERSTELLT
                DEIN VERKÄUFERPROFIL AUTOMATISCH.
              </p>
            </>
          )}
        </motion.div>
      ) : (
        /* ---- Dashboard: my listings -------------------------------------- */
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
              Meine Inserate ({mine.length})
            </span>
            <a
              href={href("/verkaufen")}
              className="flex items-center gap-2 border border-signal bg-signal px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-signal-dim"
            >
              <Plus size={12} /> Neues Inserat
            </a>
          </div>
          {mine.length === 0 ? (
            <div className="panel px-6 py-12 text-center">
              <p className="stretch-wide text-lg font-extrabold uppercase text-ink">
                Noch keine Inserate.
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
                ERFASSE DEIN ERSTES AUF /VERKAUFEN — ALS ENTWURF, PUBLIZIEREN
                KANNST DU HIER.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mine.map((l) => (
                <div key={l.slug} className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <a
                        href={href(`/inserat/${l.slug}`)}
                        className="stretch-wide text-lg font-extrabold uppercase text-ink hover:text-signal"
                      >
                        {l.brand} {l.model}
                      </a>
                      <div className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted tabular">
                        CHF {fmtCH(l.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Segmented
                        options={STATI.map((s) => ({ key: s, label: s }))}
                        value={l.status}
                        onChange={(s) => void setStatus(l.slug, s)}
                      />
                      <button
                        onClick={() => void remove(l.slug)}
                        title="Inserat löschen"
                        className="grid h-9 w-9 place-items-center border border-line text-muted transition-colors hover:border-signal hover:text-signal"
                      >
                        <Trash2 size={14} />
                      </button>
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

          {/* Saved searches */}
          {searches.length > 0 && (
            <div className="mt-12">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                Gespeicherte Suchen ({searches.length})
              </div>
              <div className="space-y-2">
                {searches.map((s) => (
                  <div
                    key={s.id}
                    className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <a
                      href={href(`/inserate?${s.params}`)}
                      className="flex items-center gap-2 font-mono text-xs tracking-[0.1em] text-ink hover:text-signal"
                    >
                      <Bookmark size={12} className="text-signal" />
                      {s.label}
                    </a>
                    <button
                      onClick={async () => {
                        await supabase?.from("saved_searches").delete().eq("id", s.id);
                        void loadSearches();
                      }}
                      title="Suche löschen"
                      className="text-muted transition-colors hover:text-signal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[8px] tracking-[0.12em] text-muted/60">
                E-MAIL-ALARME BEI NEUEN TREFFERN: GEPLANT (SIEHE BACKLOG).
              </p>
            </div>
          )}

          {/* Buyer ↔ seller conversations */}
          <Inbox userId={session.user.id} />
        </div>
      )}
    </section>
  );
}
