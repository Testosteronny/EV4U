import { MapPin, Receipt, ShieldCheck } from "lucide-react";
import { TARIFF_META, fmtCH } from "../utils/swiss";

/* ============================================================================
   «Wie EV4U rechnet» — drei knappe Punkte statt vier Aktionskarten.

   Die alten Karten (finden · rechnen · verkaufen · beraten) waren
   Navigation, die daneben schon im Header steht. Was hier stattdessen
   gehört: warum die Preise auf dieser Seite anders sind als anderswo.
   ============================================================================ */

const POINTS = [
  {
    icon: MapPin,
    title: "Dein Gemeindetarif, nicht ein Durchschnitt",
    text: `Strompreise unterscheiden sich in der Schweiz um mehr als das Doppelte. EV4U rechnet mit dem Tarif deiner Gemeinde — ${fmtCH(TARIFF_META.municipalities)} davon, aus den ElCom-Daten ${TARIFF_META.period}.`,
  },
  {
    icon: Receipt,
    title: "Alles, was jährlich anfällt",
    text: "Energie zuhause und unterwegs, Wartung, kantonale Verkehrssteuer nach Gewicht. Nicht nur der Verbrauch auf dem Papier.",
  },
  {
    icon: ShieldCheck,
    title: "Gemessen, nicht behauptet",
    text: "Jedes Inserat trägt den State of Health seiner Batterie — der Wert, der bei einem gebrauchten E-Auto über den Preis entscheidet.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
      <h2 className="text-h2 font-semibold text-fg">Wie EV4U rechnet</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title} className="card p-5">
            <p.icon size={20} strokeWidth={1.75} className="text-fg2" aria-hidden />
            <h3 className="mt-3 text-h3 font-semibold text-fg">{p.title}</h3>
            <p className="mt-1.5 text-body text-fg2">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
