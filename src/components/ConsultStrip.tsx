import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { Badge, Button } from "./ui";
import { GABRIEL } from "../data/evData";
import { supabase } from "../lib/supabase";

/* ============================================================================
   Beratungsstreifen — war die vierte Karte im Bento-Raster und stand damit
   gleichrangig neben «E-Auto finden». Ist es nicht: ein Angebot am Rand,
   für die Unentschlossenen. Also ein schmaler Streifen.
   ============================================================================ */

export default function ConsultStrip() {
  const [booked, setBooked] = useState<string | null>(null);
  const ref = booked ? `EV4U-G-${booked.replace(/[^A-Z0-9]/g, "")}` : "";

  const book = (slot: string) => {
    setBooked(slot);
    // Write-only (RLS: insert erlaubt, select verboten).
    void supabase?.from("bookings").insert({ consultant: GABRIEL.name, slot });
  };

  return (
    <section id="beratung" className="mx-auto max-w-352 px-4 py-10 sm:px-6">
      <div className="card flex flex-wrap items-center justify-between gap-x-8 gap-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-fg2">
            <PhoneCall size={19} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-h3 font-semibold text-fg">
              Unsicher? Zwanzig Minuten mit Gabriel.
            </h2>
            <p className="mt-1 max-w-prose text-body text-fg2">
              «{GABRIEL.intro}» Kein Verkaufsgespräch — Slot wählen, er ruft
              zurück.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {booked ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="positive">{booked} gebucht</Badge>
              <span className="text-small text-fg2">Referenz {ref}</span>
              <Button onClick={() => setBooked(null)} variant="ghost" size="sm">
                Stornieren
              </Button>
            </div>
          ) : (
            GABRIEL.slots.map((slot) => (
              <Button key={slot} onClick={() => book(slot)} variant="secondary" size="sm">
                {slot}
              </Button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
