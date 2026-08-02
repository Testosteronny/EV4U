import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, Button, EmptyState, LinkButton } from "./ui";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";

/* ============================================================================
   Postfach — die Reiterseite «Nachrichten» auf /konto. RLS beschränkt die
   Abfrage bereits auf Konversationen, an denen der Nutzer beteiligt ist.
   ============================================================================ */

type ConvRow = {
  id: string;
  buyer: string;
  created_at: string;
  listing: { slug: string; brand: string; model: string } | null;
};

type MsgRow = { id: string; sender: string; body: string; created_at: string };

export default function Inbox({ userId }: { userId: string }) {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadConvs = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("conversations")
      .select("id,buyer,created_at,listing:listings(slug,brand,model)")
      .order("created_at", { ascending: false });
    setConvs((data as unknown as ConvRow[]) ?? []);
  }, []);

  const loadThread = useCallback(
    async (convId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("messages")
        .select("id,sender,body,created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMsgs((data as MsgRow[]) ?? []);
      // Öffnen markiert empfangene Nachrichten als gelesen (read_at ist die
      // einzige Spalte, die der Empfänger schreiben darf).
      void supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .neq("sender", userId)
        .is("read_at", null);
    },
    [userId],
  );

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

  const sendReply = async () => {
    if (!supabase || !openId || !reply.trim()) return;
    setBusy(true);
    await supabase
      .from("messages")
      .insert({ conversation_id: openId, sender: userId, body: reply.trim() });
    setReply("");
    await loadThread(openId);
    setBusy(false);
  };

  if (convs.length === 0) {
    return (
      <EmptyState
        title="Noch keine Nachrichten."
        hint="Anfragen zu deinen Inseraten und deine eigenen Anfragen an andere Anbieter landen hier."
      >
        <LinkButton href={href("/inserate")} variant="secondary" size="sm">
          Zum Katalog
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {convs.map((c) => {
        const open = openId === c.id;
        const asBuyer = c.buyer === userId;
        return (
          <div key={c.id} className="card overflow-hidden">
            <button
              onClick={() => {
                setOpenId(open ? null : c.id);
                if (!open) void loadThread(c.id);
              }}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-h3 font-semibold text-fg">
                  {c.listing ? `${c.listing.brand} ${c.listing.model}` : "Inserat entfernt"}
                </span>
                <Badge>{asBuyer ? "als Käufer" : "als Verkäufer"}</Badge>
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`shrink-0 text-fg3 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && (
              <div className="border-t border-line p-5">
                {c.listing && (
                  <a
                    href={href(`/inserat/${c.listing.slug}`)}
                    className="text-small text-accent underline-offset-2 hover:underline"
                  >
                    Zum Inserat →
                  </a>
                )}
                <div className="mt-4 space-y-2">
                  {msgs.map((m) => {
                    const mine = m.sender === userId;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-card px-4 py-2.5 ${
                            mine ? "bg-accent/[0.09]" : "bg-surface2"
                          }`}
                        >
                          <p className="text-body text-fg">{m.body}</p>
                          <p className="mt-1 text-micro text-fg3">
                            {new Date(m.created_at).toLocaleString("de-CH")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendReply();
                    }}
                    maxLength={2000}
                    placeholder="Antworten…"
                    className="field"
                  />
                  <Button
                    onClick={() => void sendReply()}
                    disabled={busy || !reply.trim()}
                    variant="primary"
                  >
                    Senden
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
