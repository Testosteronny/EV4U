import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { Badge, Button, Segmented } from "./ui";
import { useListings } from "../hooks/useListings";
import { supabase, type ListingRow } from "../lib/supabase";
import { href } from "../lib/url";
import {
  LISTING_STATI,
  STATUS_LABEL,
  vehicleTitle,
  type ListingStatusFull,
} from "../utils/format";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   Moderation — nur für Konten mit ADMIN-Rolle. Die Oberfläche ist bloss ein
   Fenster: Lesen aller Inserate, Status überschreiben und Löschen erlaubt
   der Admin-Zweig der Listings-RLS-Policies via private.is_admin(). Ohne Rolle liefern die
   Abfragen nichts und die Mutationen werden von der Datenbank abgelehnt.
   ============================================================================ */

type AdminListing = Pick<
  ListingRow,
  "id" | "slug" | "brand" | "model" | "price" | "status" | "seller_name" | "owner"
>;

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

  const setStatus = async (id: string, status: ListingStatusFull) => {
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
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-h2 font-semibold text-fg">
          <ShieldAlert size={19} className="text-caution" aria-hidden />
          Moderation
        </h2>
        <span className="text-small text-fg3">
          {rows.length} Inserate · Rechte kommen aus den RLS-Policies, nicht aus
          dieser Oberfläche
        </span>
      </div>

      {error && <p className="mt-3 text-small text-caution">{error}</p>}

      <div className="mt-4 space-y-2">
        {rows.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
          >
            <div className="min-w-0">
              <a
                href={href(`/inserat/${l.slug}`)}
                className="text-body font-medium text-fg transition-colors hover:text-accent"
              >
                {vehicleTitle(l)}
              </a>
              <div className="flex items-center gap-2 text-small text-fg2">
                <span className="tabular">CHF {fmtCH(l.price)}</span>
                <span className="text-fg3">·</span>
                {l.seller_name}
                {l.owner === userId && <Badge>eigenes</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                size="sm"
                options={LISTING_STATI.map((s) => ({ key: s, label: STATUS_LABEL[s] }))}
                value={l.status}
                onChange={(s) => void setStatus(l.id, s)}
              />
              <Button
                onClick={() => void remove(l.id)}
                title="Inserat löschen"
                variant="danger"
                size="sm"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
