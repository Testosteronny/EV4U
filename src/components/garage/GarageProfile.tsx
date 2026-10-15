import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Clock, Globe, MapPin, Phone, Timer } from "lucide-react";
import ListingCard from "../listing/ListingCard";
import { Badge, Breadcrumbs, EmptyState, LinkButton } from "../ui";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { GARAGE_COLUMNS, type GarageInfo } from "../../lib/buildGarages";
import { responseLabel } from "../../lib/listingFacts";
import { photoUrl, supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /garagen/[slug] (Konzept §4.9) — a garage's public page: name, logo,
   «Verifizierte Garage» (UID checked by EV4U), address with a link to the
   federal map, hours, response time, and every car it has online.
   Prerendered for known garages; the 404 fallback renders it with `slug`
   alone and loads the profile live.
   ============================================================================ */

export default function GarageProfile({
  slug,
  garage: initialGarage,
  initial,
}: {
  slug: string;
  garage?: GarageInfo;
  initial?: Listing[];
}) {
  const [garage, setGarage] = useState<GarageInfo | null | undefined>(initialGarage);
  const [response, setResponse] = useState<number | null>(null);
  const { active } = useListings(initial);
  const stock = useMemo(() => active.filter((l) => l.sellerSlug === slug), [active, slug]);
  const market = useMarket(stock);

  useEffect(() => {
    if (initialGarage || !supabase) return;
    void supabase
      .from("profiles")
      .select(GARAGE_COLUMNS)
      .eq("slug", slug)
      .eq("type", "GARAGE")
      .maybeSingle()
      .then(({ data }) => setGarage((data as GarageInfo | null) ?? null));
  }, [initialGarage, slug]);

  useEffect(() => {
    if (!garage || !supabase) return;
    void supabase
      .rpc("seller_response_minutes", { p_owner: garage.id })
      .then(({ data }) => setResponse(typeof data === "number" ? data : null));
  }, [garage]);

  const crumbs = [
    { label: "Start", href: href("/") },
    { label: "Garagen", href: href("/garagen") },
    { label: garage?.name ?? "Garage" },
  ];

  if (garage === undefined) {
    return (
      <Shell>
        <div className="h-48 animate-pulse rounded-card bg-surface2" aria-busy="true" />
      </Shell>
    );
  }
  if (garage === null) {
    return (
      <Shell>
        <EmptyState title="Diese Garage gibt es nicht (mehr)." hint="Vielleicht hat sie ihre Seite umbenannt.">
          <LinkButton href={href("/garagen")} variant="primary" size="sm">
            Alle Garagen
          </LinkButton>
        </EmptyState>
      </Shell>
    );
  }

  const reply = responseLabel(response);
  const hours = garage.opening_hours.trim();

  return (
    <Shell>
      <Breadcrumbs items={crumbs} />
      <header className="mt-6 flex flex-wrap items-start gap-5">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-surface text-fg3">
          {garage.logo_path ? (
            <img src={photoUrl(garage.logo_path)} alt={`Logo ${garage.name}`} className="h-full w-full object-contain p-1" />
          ) : (
            <Building2 size={30} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-display font-bold text-fg">{garage.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {garage.verified && (
              <Badge tone="positive" title="UID im Handelsregister von EV4U geprüft">
                <BadgeCheck size={13} aria-hidden /> Verifizierte Garage
              </Badge>
            )}
            <Badge>
              {stock.length} {stock.length === 1 ? "Auto" : "Autos"} online
            </Badge>
            {reply && (
              <Badge>
                <Timer size={13} aria-hidden /> {reply}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <dl className="card space-y-3 p-5 text-body">
            {garage.address && (
              <Fact icon={<MapPin size={16} aria-hidden />} label="Adresse">
                {garage.address}
                <a
                  href={`https://map.geo.admin.ch/?swisssearch=${encodeURIComponent(garage.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mt-0.5 block text-small"
                >
                  Auf der Karte
                </a>
              </Fact>
            )}
            {garage.phone && (
              <Fact icon={<Phone size={16} aria-hidden />} label="Telefon">
                <a href={`tel:${garage.phone.replace(/[^\d+]/g, "")}`} className="link">
                  {garage.phone}
                </a>
              </Fact>
            )}
            {hours && (
              <Fact icon={<Clock size={16} aria-hidden />} label="Öffnungszeiten">
                <span className="whitespace-pre-line">{hours}</span>
              </Fact>
            )}
            {garage.website && /^https?:\/\//i.test(garage.website) && (
              <Fact icon={<Globe size={16} aria-hidden />} label="Website">
                <a href={garage.website} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">
                  {garage.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </Fact>
            )}
          </dl>
          {garage.about.trim() && (
            <div className="card p-5">
              <h2 className="text-h3 font-bold text-fg">Über uns</h2>
              <p className="mt-2 whitespace-pre-line text-body text-fg2">{garage.about}</p>
            </div>
          )}
        </aside>

        <section aria-labelledby="bestand" className="min-w-0">
          <h2 id="bestand" className="text-h2 font-bold text-fg">
            Autos von {garage.name}
          </h2>
          {stock.length === 0 ? (
            <p className="mt-3 text-body text-fg2">Gerade keine Autos online.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stock.map((l, i) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  priority={i < 3}
                  monthly={market.monthly.get(l.id) ?? null}
                  distance={market.distance.get(l.id) ?? null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-page animate-fade-in px-4 py-8 sm:px-6 sm:py-10">{children}</div>;
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-fg3">{icon}</span>
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="text-fg">{children}</dd>
      </div>
    </div>
  );
}
