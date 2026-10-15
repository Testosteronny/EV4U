import EngineCore from "../EngineCore";
import { EmptyState, Field, LinkButton, PageHeader } from "../ui";
import { useCockpit, useSimulatedListing } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import { vehicleTitle } from "../../utils/format";
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
  const { setListingId } = useCockpit();
  const { active } = useListings(initial);
  const listing = useSimulatedListing(initial);

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Was kostet mich ein E-Auto?"
        lead="Wähle ein Auto aus dem Bestand — EV4U rechnet es gegen dein heutiges Auto durch, mit dem Stromtarif deiner Gemeinde."
      />

      {listing ? (
        <>
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
                    {vehicleTitle(l)} — CHF {fmtCH(l.price)}
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
              {vehicleTitle(listing)} ansehen →
            </LinkButton>
          </div>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Gerade steht kein offenes Inserat bereit."
            hint="Die Rechnung braucht ein echtes Auto — sobald wieder eines im Katalog ist, steht sie hier."
          >
            <LinkButton href={href("/inserate")} variant="primary" size="sm">
              Zum Katalog
            </LinkButton>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
