import { useEffect, useMemo, useState } from "react";
import { Check, PhoneCall } from "lucide-react";
import { Avatar, Button, Field, Notice, PageHeader } from "../ui";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { GABRIEL } from "../../data/evData";

/* ============================================================================
   /beratung (was a strip on the home page) — twenty minutes on the phone
   with Gabriel. Slots are the next working days at fixed times, computed
   from today; the booking is write-only (RLS: insert, no select) and
   carries the contact for the callback, plus the listing when the visitor
   came from one (`?inserat=`).
   ============================================================================ */

const TIMES = ["12:15", "17:30", "19:00"];
const DAYS_AHEAD = 4;

function nextSlots(now: Date): { day: string; slots: string[] }[] {
  const out: { day: string; slots: string[] }[] = [];
  const d = new Date(now);
  while (out.length < DAYS_AHEAD) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    const day = d.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
    out.push({ day, slots: TIMES.map((t) => `${day}, ${t}`) });
  }
  return out;
}

const TOPICS = [
  "Welches E-Auto passt zu meinem Alltag?",
  "Ist dieses Inserat ein guter Deal?",
  "Laden zuhause: Wallbox, Mietwohnung, Solar",
  "Batterie und Garantie richtig einschätzen",
  "Verkaufen: Preis und Inserat",
];

export default function BeratungPage() {
  const [days, setDays] = useState<{ day: string; slots: string[] }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [listing, setListing] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Dates depend on today — computed after mount, not at build time.
  useEffect(() => {
    setDays(nextSlots(new Date()));
    setListing(new URLSearchParams(location.search).get("inserat"));
  }, []);

  const valid = useMemo(() => contact.trim().length >= 6, [contact]);

  const book = async () => {
    if (!slot || !valid) return;
    setState("sending");
    if (!supabase) {
      setState("error");
      return;
    }
    const { error } = await supabase.from("bookings").insert({
      consultant: GABRIEL.name,
      slot,
      contact: contact.trim().slice(0, 200),
      listing_slug: listing,
    });
    setState(error ? "error" : "sent");
  };

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        crumbs={[{ label: "Start", href: href("/") }, { label: "Beratung" }]}
        title={`Zwanzig Minuten mit ${GABRIEL.name}`}
        lead="Kostenlos, am Telefon, kein Verkaufsgespräch. Du wählst einen Termin, Gabriel ruft dich an."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <section className="card p-6">
          <div className="flex items-center gap-4">
            <Avatar name={GABRIEL.name} size={56} />
            <div>
              <p className="text-h3 font-bold text-fg">{GABRIEL.name}</p>
              <p className="text-small text-fg2">E-Auto-Berater bei EV4U</p>
            </div>
          </div>
          <p className="mt-4 text-body text-fg">«{GABRIEL.intro}»</p>
          <h2 className="mt-6 text-h3 font-bold text-fg">Worüber ihr reden könnt</h2>
          <ul className="mt-2 space-y-1.5">
            {TOPICS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-body text-fg2">
                <Check size={16} aria-hidden className="mt-1 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby="termin">
          <h2 id="termin" className="text-h2 font-bold text-fg">
            Termin wählen
          </h2>
          {state === "sent" ? (
            <Notice tone="success" className="mt-4">
              Gebucht: {slot}. {GABRIEL.name} ruft dich unter {contact.trim()} an.
            </Notice>
          ) : (
            <>
              <div className="mt-4 space-y-4">
                {days.map((d) => (
                  <div key={d.day}>
                    <p className="text-small font-semibold text-fg2">{d.day}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {d.slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlot(s)}
                          aria-pressed={slot === s}
                          className={`h-10 rounded-control border px-4 text-body font-semibold tabular transition-colors ${
                            slot === s ? "border-accent bg-soft text-accent" : "border-line2 text-fg hover:bg-surface2"
                          }`}
                        >
                          {s.split(", ").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Field label="Telefon oder E-Mail" hint="Nur für diesen Rückruf.">
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    autoComplete="tel"
                    maxLength={200}
                    placeholder="079 123 45 67"
                    className="field"
                  />
                </Field>
              </div>
              {listing && <p className="mt-3 text-small text-fg2">Es geht um das Inserat {listing} — Gabriel schaut es sich vorher an.</p>}
              {state === "error" && (
                <Notice tone="danger" className="mt-4">
                  Buchen hat nicht geklappt. Schreib uns an hallo@ev4u.ch.
                </Notice>
              )}
              <Button
                variant="primary"
                className="mt-5 w-full"
                disabled={!slot || !valid || state === "sending"}
                onClick={() => void book()}
              >
                <PhoneCall size={17} aria-hidden />
                {slot ? `${slot} buchen` : "Zuerst einen Termin wählen"}
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
