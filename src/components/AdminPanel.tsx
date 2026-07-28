import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { Segmented } from "./ui";
import { useListings } from "../hooks/useListings";
import { supabase, type ListingRow } from "../lib/supabase";
import { href } from "../lib/url";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   AdminPanel — moderation view on /konto, rendered only for users with an
   ADMIN row in user_roles. The UI is just a window: reading all listings
   (incl. drafts), overriding status and deleting are each granted by their
   own RLS policy via is_admin() — without the role the queries return
   nothing and the mutations are rejected by the database.
   ============================================================================ */

type AdminListing = Pick<
  ListingRow,
  "id" | "slug" | "brand" | "model" | "price" | "status" | "seller_name" | "owner"
>;

const STATI = ["ENTWURF", "AKTIV", "RESERVIERT", "VERKAUFT"] as const;

export default function AdminPanel({ userId }: { userId: string }) {
  const { refresh } = useListings();
  const [rows, setRows] = useState<AdminListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("listings")
      .select("id,slug,brand,model,price,status,seller_name,owner")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setRows((data as AdminListing[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: (typeof STATI)[number]) => {
    if (!supabase) return;
    const { error: err } = await supabase.from("listings").update({ status }).eq("id", id);
    if (err) setError(err.message);
    await Promise.all([load(), refresh()]);
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Inserat endgültig löschen?")) return;
    const { error: err } = await supabase.from("listings").delete().eq("id", id);
    if (err) setError(err.message);
    await Promise.all([load(), refresh()]);
  };

  return (
    <div className="mt-12 border-t-2 border-warn/50 pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-warn">
          <ShieldAlert size={14} /> Moderation — alle Inserate ({rows.length})
        </span>
        <span className="font-mono text-[9px] tracking-[0.15em] text-muted/70">
          ADMIN-RECHTE: RLS-POLICIES, NICHT UI
        </span>
      </div>
      {error && (
        <p className="mb-3 font-mono text-[10px] tracking-[0.12em] text-warn">
          {error.toUpperCase()}
        </p>
      )}
      <div className="space-y-2">
        {rows.map((l) => (
          <div
            key={l.id}
            className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="min-w-0">
              <a
                href={href(`/inserat/${l.slug}`)}
                className="stretch-wide text-sm font-extrabold uppercase text-ink hover:text-signal"
              >
                {l.brand} {l.model}
              </a>
              <div className="mt-0.5 font-mono text-[9px] tracking-[0.12em] text-muted tabular">
                CHF {fmtCH(l.price)} · {l.seller_name.toUpperCase()}
                {l.owner === userId && " · EIGENES"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                options={STATI.map((s) => ({ key: s, label: s }))}
                value={l.status}
                onChange={(s) => void setStatus(l.id, s)}
              />
              <button
                onClick={() => void remove(l.id)}
                title="Inserat löschen (Moderation)"
                className="grid h-9 w-9 place-items-center border border-line text-muted transition-colors hover:border-warn hover:text-warn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
