import EngineCore from "../EngineCore";
import { Field, LinkButton, PageHeader } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /rechenwerk — «Was kostet mich ein E-Auto?»

   Kein Navigationsziel mehr (die Rechnung sitzt an jedem Inserat), aber die
   URL bleibt: als Einstiegsseite für genau diese Frage, mit Trichter zurück
   in den Bestand. Die Eingabespalte ist entfallen — die Werte stehen in der
   Kontextleiste über der Seite.
   ============================================================================ */

export default function RechenwerkPage({ initial }: { initial?: Listing[] }) {
  const { listing, setListingId } = useCockpit();
  const { active } = useListings(initial);

  return (
    <div className="mx-auto max-w-[88rem] animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Was kostet mich ein E-Auto?"
        lead="Wähle ein Auto aus dem Bestand — EV4U rechnet es gegen dein heutiges Auto durch, mit dem Stromtarif deiner Gemeinde."
      />

      <div className="mt-6 max-w-md">
        <Field
          label="Auto in der Rechnung"
          hint="Alle offenen Inserate. Die Rechnung darunter gilt für dieses Auto."
        >
          <select
            value={listing.id}
            onChange={(e) => setListingId(e.target.value)}
            className="field"
          >
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.brand} {l.model} — CHF {fmtCH(l.price)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6">
        <EngineCore listing={listing} />
      </div>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="max-w-prose text-body text-fg2">
          Die Zahlen passen? Dieses Auto steht wirklich zum Verkauf.
        </p>
        <LinkButton href={href(`/inserat/${listing.id}`)} variant="primary">
          {listing.brand} {listing.model} ansehen →
        </LinkButton>
      </div>
    </div>
  );
}
