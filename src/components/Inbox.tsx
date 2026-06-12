import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";

/* ============================================================================
   Inbox — conversations on /konto. RLS already scopes the query to
   conversations the user participates in (as buyer or as listing owner),
   so the client just renders what it gets.
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
      // Opening the thread marks received messages as read (read_at is the
      // only column the recipient may update — column-level grant).
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

  if (convs.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        Postfach ({convs.length})
      </div>
      <div className="space-y-3">
        {convs.map((c) => {
          const open = openId === c.id;
          const role = c.buyer === userId ? "ALS KÄUFER" : "ALS VERKÄUFER";
          return (
            <div key={c.id} className="panel">
              <button
                onClick={() => {
                  setOpenId(open ? null : c.id);
                  if (!open) void loadThread(c.id);
                }}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <div>
                  <span className="stretch-wide text-base font-extrabold uppercase text-ink">
                    {c.listing ? `${c.listing.brand} ${c.listing.model}` : "Inserat entfernt"}
                  </span>
                  <span className="ml-3 font-mono text-[9px] tracking-[0.2em] text-signal">
                    {role}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-muted transition-transform ${open ? "rotate-180 text-signal" : ""}`}
                />
              </button>

              {open && (
                <div className="border-t border-dashed border-line p-5">
                  {c.listing && (
                    <Link
                      to={`/inserat/${c.listing.slug}`}
                      className="font-mono text-[9px] tracking-[0.2em] text-muted hover:text-signal"
                    >
                      → ZUM INSERAT
                    </Link>
                  )}
                  <div className="mt-4 space-y-2">
                    {msgs.map((m) => {
                      const mine = m.sender === userId;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] border px-4 py-2.5 ${
                              mine
                                ? "border-signal/40 bg-signal/[0.07]"
                                : "border-line bg-nacht"
                            }`}
                          >
                            <p className="text-sm leading-relaxed text-ink">{m.body}</p>
                            <p className="mt-1 font-mono text-[8px] tracking-[0.15em] text-muted/60">
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
                      className="w-full border border-line bg-nacht px-4 py-2.5 font-mono text-sm text-ink placeholder:text-muted/50 focus:border-signal focus:outline-none"
                    />
                    <button
                      onClick={() => void sendReply()}
                      disabled={busy || !reply.trim()}
                      className="border border-signal bg-signal px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
                    >
                      Senden
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
