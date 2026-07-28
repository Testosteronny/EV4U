import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Calculator,
  PhoneCall,
  Search,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { GABRIEL } from "../data/evData";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";
import { SectionHeader, Stamp } from "./ui";

/* ============================================================================
   BentoHub — the four things you can do here, as plain action cards:
   finden · rechnen · beraten lassen · verkaufen. Icons instead of animated
   scenes; every card says in one sentence what happens behind it.
   ============================================================================ */

const cardMotion = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.4, delay: i * 0.06 },
});

function ActionCard({
  icon: Icon,
  title,
  text,
  cta,
  to,
  i,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  cta: string;
  to: string;
  i: number;
}) {
  return (
    <motion.div {...cardMotion(i)}>
      <a
        href={href(to)}
        className="panel group flex h-full flex-col gap-4 p-6 transition-colors duration-300 hover:border-signal/60"
      >
        <span className="grid h-11 w-11 place-items-center border border-line text-signal transition-colors group-hover:border-signal/60">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted transition-colors group-hover:text-signal">
          {cta}
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </span>
      </a>
    </motion.div>
  );
}

export default function BentoHub() {
  const [booking, setBooking] = useState<string | null>(null);

  const refCode = booking ? `EV4U-G-${booking.replace(/[^A-Z0-9]/g, "")}` : "";

  const book = (slot: string) => {
    setBooking(slot);
    // Write-only booking request (RLS: insert allowed, select denied).
    void supabase?.from("bookings").insert({ consultant: GABRIEL.name, slot });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
      <SectionHeader
        title="So funktioniert's"
        claim="Finden, rechnen, beraten lassen, verkaufen — alles an einem Ort."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <ActionCard
          i={0}
          icon={Search}
          title="E-Auto finden"
          text="Alle offenen Inserate, filterbar nach Marke, Karosserie, Sitzen und Preis — jedes mit Energiekosten in deiner Gemeinde."
          cta="Zu den Inseraten"
          to="/inserate"
        />
        <ActionCard
          i={1}
          icon={Calculator}
          title="Kosten rechnen"
          text="Benzin gegen Strom, bevor du entscheidest — mit deinem Tarif, deinem Solardach und deinem Lade-Mix."
          cta="Zum Rechenwerk"
          to="/rechenwerk"
        />
        <ActionCard
          i={2}
          icon={Tag}
          title="Verkaufen"
          text="Privat oder Garage — dein Inserat mit gemessenem SOH-Zertifikat. Käufer sehen den Wert, nicht nur den Preis."
          cta="Inserat aufgeben"
          to="/verkaufen"
        />

        {/* Beratung — the one card with an action inside */}
        <motion.div {...cardMotion(3)} id="beratung" className="scroll-mt-20">
          <div className="panel flex h-full flex-col gap-4 p-6">
            <span className="grid h-11 w-11 place-items-center border border-line text-signal">
              <PhoneCall size={20} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-extrabold text-ink">
                Unsicher? <span className="text-signal">Red mit Gabriel.</span>
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                «{GABRIEL.intro}» — 20 Minuten, kein Verkaufsgespräch. Slot
                wählen, Gabriel ruft dich an.
              </p>
            </div>
            <div>
              <div className="flex flex-wrap gap-1.5">
                {GABRIEL.slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => book(slot)}
                    className={`px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] transition-colors ${
                      booking === slot
                        ? "bg-signal text-nacht"
                        : "bg-nacht text-muted hover:bg-panel2 hover:text-ink"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {booking && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-signal/50 bg-signal/[0.05] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center bg-signal text-nacht">
                        <PhoneCall size={13} strokeWidth={1.5} />
                      </span>
                      <div>
                        <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.1em] text-ink">
                          {booking}{" "}
                          <Stamp className="!px-1.5 !py-0 text-[8px]">Gebucht</Stamp>
                        </span>
                        <span className="text-[10px] text-muted">
                          Ref. {refCode} — Gabriel ruft dich an.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setBooking(null)}
                      title="Stornieren"
                      className="text-muted transition-colors hover:text-signal"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
