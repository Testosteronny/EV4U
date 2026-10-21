import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Car, MessageSquare, Send, ShieldAlert } from "lucide-react";
import KontoLayout from "./KontoLayout";
import { Avatar, Badge, Button, EmptyState, LinkButton, Notice } from "../ui";
import { refreshUnread } from "../../hooks/useUnread";
import { photoUrl, supabase, type ListingRowStatus } from "../../lib/supabase";
import { href } from "../../lib/url";
import { STATUS_LABEL, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto/nachrichten (Konzept §4.11) — conversations on the left, the
   thread on the right (one at a time on the phone). `?c=<id>` opens a
   thread directly — the contact sheet and the notification e-mail link
   here. Every thread carries its listing on top, so «ist er noch da?»
   never needs a second tab.

   Incoming messages are checked against the patterns of the classic
   classifieds scams (payment in advance, a forwarding agent, money
   transfer services, moving to a messenger) — a warning, never a block.
   ============================================================================ */

type ConvListing = {
  slug: string;
  brand: string;
  model: string;
  price: number;
  photos: string[] | null;
  owner: string | null;
  status: ListingRowStatus;
  seller_name: string;
};

type Conv = {
  id: string;
  buyer: string;
  created_at: string;
  listing: ConvListing | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const SCAM_PATTERNS: RegExp[] = [
  /western\s*union|moneygram|\bria\b|wise\.com|krypto|bitcoin/i,
  /vorauskasse|im\s+voraus|anzahlung|kaution|reservations?geb(ü|ue)hr/i,
  /spedition|transport(firma|unternehmen)|lieferung\s+(per|mit|durch)|shipping/i,
  /whats\s*app|telegram/i,
  /paypal.{0,30}(freunde|friends)|friends\s*(and|&)\s*family/i,
  /gutschein|gift\s*card|voucher/i,
  /(bin|wohne|arbeite)\s+(gerade\s+|zurzeit\s+|momentan\s+)?im\s+ausland/i,
];

export const looksLikeScam = (body: string): boolean => SCAM_PATTERNS.some((p) => p.test(body));

const QUICK_REPLIES = {
  seller: [
    "Ja, das Auto ist noch verfügbar.",
    "Gerne — wann passt dir eine Probefahrt?",
    "Den Batteriebericht schicke ich dir gerne.",
  ],
  buyer: [
    "Ist das Auto noch verfügbar?",
    "Wann wäre eine Probefahrt möglich?",
    "Gibt es einen aktuellen Batteriebericht (SoH)?",
  ],
};

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString("de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function NachrichtenPage() {
  return (
    <KontoLayout active="nachrichten" title="Nachrichten">
      {({ userId }) => <Inbox userId={userId} />}
    </KontoLayout>
  );
}

function Inbox({ userId }: { userId: string }) {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("conversations")
      .select("id,buyer,created_at,listing:listings(slug,brand,model,price,photos,owner,status,seller_name)")
      .order("created_at", { ascending: false });
    const list = (data as unknown as Conv[]) ?? [];
    const ids = list.map((c) => c.id);
    const buyers = [...new Set(list.filter((c) => c.buyer !== userId).map((c) => c.buyer))];
    const [{ data: m }, { data: p }] = await Promise.all([
      ids.length
        ? supabase
            .from("messages")
            .select("id,conversation_id,sender,body,created_at,read_at")
            .in("conversation_id", ids)
            // The newest 2000 — oldest first would drop today's messages
            // once an inbox outgrows the limit.
            .order("created_at", { ascending: false })
            .limit(2000)
        : Promise.resolve({ data: [] }),
      buyers.length ? supabase.from("profiles").select("id,name").in("id", buyers) : Promise.resolve({ data: [] }),
    ]);
    setMsgs(((m as Msg[]) ?? []).reverse());
    setNames(new Map(((p as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name])));
    setConvs(list);
  }, [userId]);

  useEffect(() => {
    void load();
    setOpenId(new URLSearchParams(location.search).get("c"));
  }, [load]);

  // New messages while the page is open: every 20 s, and on return to the tab.
  useEffect(() => {
    const tick = () => !document.hidden && void load();
    const timer = window.setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const byConv = useMemo(() => {
    const m = new Map<string, Msg[]>();
    for (const msg of msgs) {
      const list = m.get(msg.conversation_id);
      if (list) list.push(msg);
      else m.set(msg.conversation_id, [msg]);
    }
    return m;
  }, [msgs]);

  const sorted = useMemo(() => {
    const last = (c: Conv) => byConv.get(c.id)?.at(-1)?.created_at ?? c.created_at;
    return [...(convs ?? [])].sort((a, b) => last(b).localeCompare(last(a)));
  }, [convs, byConv]);

  const open = sorted.find((c) => c.id === openId) ?? null;
  const thread = open ? byConv.get(open.id) ?? [] : [];

  // Opening a thread marks what came in as read.
  useEffect(() => {
    if (!supabase || !open) return;
    const unread = thread.filter((m) => m.sender !== userId && !m.read_at);
    if (!unread.length) return;
    const now = new Date().toISOString();
    void supabase
      .from("messages")
      .update({ read_at: now })
      .eq("conversation_id", open.id)
      .neq("sender", userId)
      .is("read_at", null)
      .then(() => {
        setMsgs((all) => all.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read_at: now } : m)));
        refreshUnread();
      });
  }, [open, thread, userId]);

  const select = (id: string | null) => {
    setOpenId(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set("c", id);
    else url.searchParams.delete("c");
    history.replaceState(null, "", url);
  };

  const counterpart = (c: Conv): string =>
    c.buyer === userId ? c.listing?.seller_name || "Anbieter" : names.get(c.buyer) || "Interessent";

  if (convs === null) {
    return <div className="h-96 animate-pulse rounded-card bg-surface2" aria-busy="true" />;
  }

  if (convs.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={22} aria-hidden />}
        title="Noch keine Nachrichten."
        hint="Anfragen zu deinen Inseraten und deine Fragen an Anbieter landen hier — mit dem Inserat gleich oben im Gespräch."
      >
        <LinkButton href={href("/inserate")} variant="primary">
          Autos ansehen
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="card grid h-[calc(100dvh-15rem)] min-h-[30rem] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]">
      <ul
        aria-label="Gespräche"
        className={`min-h-0 overflow-y-auto border-line lg:block lg:border-r ${open ? "hidden" : "block"}`}
      >
        {sorted.map((c) => {
          const list = byConv.get(c.id) ?? [];
          const last = list.at(-1);
          const unread = list.filter((m) => m.sender !== userId && !m.read_at).length;
          const active = c.id === openId;
          return (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => select(c.id)}
                aria-current={active || undefined}
                className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${
                  active ? "bg-soft" : "hover:bg-surface2"
                }`}
              >
                <Avatar name={counterpart(c)} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-body text-fg ${unread ? "font-bold" : "font-semibold"}`}>
                      {counterpart(c)}
                    </span>
                    {last && <span className="shrink-0 text-micro text-fg3">{fmtTime(last.created_at)}</span>}
                  </span>
                  <span className="block truncate text-small text-fg2">
                    {c.listing ? vehicleTitle(c.listing) : "Inserat entfernt"} · {c.buyer === userId ? "du fragst" : "fragt dich"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-small ${unread ? "text-fg" : "text-fg3"}`}>
                      {last ? `${last.sender === userId ? "Du: " : ""}${last.body}` : "—"}
                    </span>
                    {unread > 0 && (
                      <span className="rounded-full bg-accent px-1.5 text-micro font-bold text-on-accent tabular">
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open ? (
        <Thread
          key={open.id}
          conv={open}
          msgs={thread}
          userId={userId}
          counterpart={counterpart(open)}
          onBack={() => select(null)}
          onSent={load}
        />
      ) : (
        <div className="hidden place-items-center p-8 text-center lg:grid">
          <div>
            <MessageSquare size={28} aria-hidden className="mx-auto text-fg3" />
            <p className="mt-3 text-body text-fg2">Wähle links ein Gespräch.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Thread({
  conv,
  msgs,
  userId,
  counterpart,
  onBack,
  onSent,
}: {
  conv: Conv;
  msgs: Msg[];
  userId: string;
  counterpart: string;
  onBack: () => void;
  onSent: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const asBuyer = conv.buyer === userId;
  const l = conv.listing;
  const warn = msgs.some((m) => m.sender !== userId && looksLikeScam(m.body));
  const closed = !l || l.status === "VERKAUFT";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs.length]);

  const send = async () => {
    const body = draft.trim();
    if (!supabase || !body) return;
    setBusy(true);
    setError(false);
    const { error: err } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, sender: userId, body: body.slice(0, 2000) });
    if (err) setError(true);
    else {
      setDraft("");
      await onSent();
    }
    setBusy(false);
  };

  return (
    <section aria-label={`Gespräch mit ${counterpart}`} className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-fg2 hover:bg-surface2 lg:hidden"
          aria-label="Zurück zu den Gesprächen"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        {l ? (
          <a href={href(`/inserat/${l.slug}`)} className="group flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-surface2 text-fg3">
              {l.photos?.[0] ? (
                <img src={photoUrl(l.photos[0])} alt="" className="h-full w-full object-cover" />
              ) : (
                <Car size={18} aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold text-fg group-hover:text-accent">
                {vehicleTitle(l)}
              </span>
              <span className="flex items-center gap-2 text-small text-fg2">
                <span className="font-bold text-fg tabular">CHF {fmtCH(l.price)}</span>
                {l.status !== "AKTIV" && <Badge tone={l.status === "VERKAUFT" ? "danger" : "caution"}>{STATUS_LABEL[l.status]}</Badge>}
                <span className="truncate">· {asBuyer ? counterpart : `mit ${counterpart}`}</span>
              </span>
            </span>
          </a>
        ) : (
          <p className="flex-1 text-body text-fg2">Das Inserat ist nicht mehr online.</p>
        )}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {warn && (
          <Notice tone="caution" className="mb-3">
            <span className="flex gap-2">
              <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Vorsicht: Diese Nachricht enthält Muster, die oft bei Betrug vorkommen — Vorauskasse, Spedition,
                Geldtransfer oder der Wechsel in einen Messenger. Zahle nie, bevor du das Auto gesehen hast.{" "}
                <a href={href("/sicherheit")} className="font-semibold underline">
                  So erkennst du Betrug
                </a>
              </span>
            </span>
          </Notice>
        )}
        {msgs.map((m) => {
          const mine = m.sender === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-card px-3.5 py-2.5 sm:max-w-[75%] ${
                  mine ? "bg-soft text-fg" : "bg-surface2 text-fg"
                }`}
              >
                <p className="whitespace-pre-line break-words text-body">{m.body}</p>
                <p className="mt-1 text-micro text-fg3">
                  {fmtTime(m.created_at)}
                  {mine && m.read_at && " · gelesen"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t border-line px-4 py-3">
        {closed ? (
          <p className="text-small text-fg3">Dieses Auto ist verkauft oder nicht mehr online — das Gespräch bleibt zum Nachlesen.</p>
        ) : (
          <>
            <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
              {QUICK_REPLIES[asBuyer ? "buyer" : "seller"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setDraft((d) => (d ? `${d} ${q}` : q))}
                  className="h-8 shrink-0 rounded-full border border-line2 px-3 text-small text-fg2 transition-colors hover:border-fg3 hover:text-fg"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">Nachricht an {counterpart}</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="Antworten… (Shift+Enter für neue Zeile)"
                  className="field min-h-11 resize-none py-2.5"
                />
              </label>
              <Button type="submit" variant="primary" disabled={busy || !draft.trim()} aria-label="Senden">
                <Send size={16} aria-hidden />
                <span className="hidden sm:inline">Senden</span>
              </Button>
            </form>
            {error && <p className="mt-2 text-small text-danger">Senden hat nicht geklappt. Bitte nochmals versuchen.</p>}
            <p className="mt-2 text-micro text-fg3">Tipp: Probefahrt vor Ort, bezahlt wird erst bei der Übergabe.</p>
          </>
        )}
      </footer>
    </section>
  );
}
