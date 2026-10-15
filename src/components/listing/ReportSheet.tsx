import { useState } from "react";
import { Button, ChipGroup, Field, Notice, Sheet } from "../ui";
import { supabase } from "../../lib/supabase";
import type { Listing } from "../../data/evData";

/* ============================================================================
   «Inserat melden» (Konzept §5.2) — goes to the admin queue (/admin).
   Anyone may report; three reports from different logged-in people hide
   the listing until an admin has looked at it (DB trigger).
   ============================================================================ */

export type ReportReason = "BETRUG" | "FALSCHE_ANGABEN" | "NICHT_VERFUEGBAR" | "DOPPELT" | "ANDERES";

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: "BETRUG", label: "Verdacht auf Betrug" },
  { key: "FALSCHE_ANGABEN", label: "Falsche Angaben" },
  { key: "NICHT_VERFUEGBAR", label: "Nicht mehr verfügbar" },
  { key: "DOPPELT", label: "Doppelt inseriert" },
  { key: "ANDERES", label: "Anderes" },
];

export default function ReportSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("FALSCHE_ANGABEN");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async () => {
    if (!supabase || !listing.uid) return;
    setState("sending");
    const { error } = await supabase
      .from("reports")
      .insert({ listing_id: listing.uid, reason, detail: detail.trim().slice(0, 1000) });
    setState(error ? "error" : "sent");
  };

  return (
    <Sheet
      title="Inserat melden"
      onClose={onClose}
      footer={
        state === "sent" ? (
          <Button variant="primary" onClick={onClose} className="ml-auto">
            Schliessen
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => void send()} disabled={state === "sending" || !listing.uid}>
              {state === "sending" ? "Sendet…" : "Melden"}
            </Button>
          </>
        )
      }
    >
      {state === "sent" ? (
        <Notice tone="success">Danke. Wir schauen uns das Inserat an.</Notice>
      ) : (
        <div className="space-y-5">
          <div>
            <span className="mb-1.5 block text-small font-semibold text-fg2">Was stimmt nicht?</span>
            <ChipGroup label="Grund" options={REPORT_REASONS} value={reason} onChange={setReason} />
          </div>
          <Field label="Details" optional hint="Was ist dir aufgefallen? Hilft uns beim Prüfen.">
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              maxLength={1000}
              className="field resize-y"
            />
          </Field>
          {!listing.uid && <Notice>Dieses Inserat lässt sich offline nicht melden.</Notice>}
          {state === "error" && <Notice tone="danger">Melden hat nicht geklappt. Bitte nochmals versuchen.</Notice>}
        </div>
      )}
    </Sheet>
  );
}
