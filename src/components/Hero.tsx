import SearchBox from "./SearchBox";
import { LinkButton } from "./ui";
import { useListings } from "../hooks/useListings";
import { href } from "../lib/url";
import { TARIFF_META, fmtCH } from "../utils/swiss";

/* ============================================================================
   Hero — ein Satz, die Suche, zwei Zahlen. Sonst nichts.

   Das Tarif-Widget ist hier raus: es lebt jetzt in der Kontextleiste über
   der Seite, wo es auf jeder Route gilt statt nur auf der Startseite. Die
   Kennzahl «0 Verkaufsdruck» ist gestrichen — eine Pointe, keine Zahl.
   ============================================================================ */

export default function Hero() {
  const { listings, active } = useListings();

  return (
    <section className="mx-auto max-w-352 px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16">
      <h1 className="max-w-3xl text-display font-semibold text-fg sm:text-display-lg">
        E-Autos kaufen und verkaufen — mit den Kosten, die du wirklich hast.
      </h1>
      <p className="mt-3 max-w-prose text-body text-fg2">
        Occasion vom Privaten oder Vorführwagen von der Garage. EV4U rechnet
        jedes Inserat mit deinem Gemeindetarif, deinen Kilometern und deinem
        Ladeverhalten durch.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <SearchBox className="w-full max-w-md" />
        <LinkButton href={href("/inserate")} variant="primary">
          Alle {listings.length} Inserate
        </LinkButton>
      </div>

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <dt className="text-small text-fg2">Offene Inserate</dt>
          <dd className="text-h2 font-semibold text-fg tabular">{active.length}</dd>
        </div>
        <div>
          <dt className="text-small text-fg2">
            Gemeindetarife {TARIFF_META.period}
          </dt>
          <dd className="text-h2 font-semibold text-fg tabular">
            {fmtCH(TARIFF_META.municipalities)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
