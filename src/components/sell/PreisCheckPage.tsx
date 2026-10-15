import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Tag } from "lucide-react";
import ListingCard from "../listing/ListingCard";
import { useVehicleSelection } from "../search/VehicleFilter";
import { Field, LinkButton, Notice, PageHeader, Select } from "../ui";
import { useListings } from "../../hooks/useListings";
import { PRICE_METHOD, estimatePrice } from "../../lib/priceCheck";
import { href } from "../../lib/url";
import { MODEL_GROUPS, modelOptionLabel } from "../../lib/vehicleCatalog";
import { loadVehicleCatalog } from "../../stores/vehicleCatalog";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /verkaufen/preis-check (Konzept F8) — what is my EV worth? No account.
   Marke → Modell → Variante, Jahrgang, km, SOH → a range with its method
   and the comparable listings it came from. The CTA carries everything
   into the sell wizard, so nothing is typed twice.
   ============================================================================ */

type Input = { marke: string; modell: string; variante: string; jahr: string; km: string; soh: string };
const EMPTY: Input = { marke: "", modell: "", variante: "", jahr: "", km: "", soh: "" };

export default function PreisCheckPage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const [v, setV] = useState<Input>(EMPTY);
  const sel = useVehicleSelection({ marke: v.marke, modell: v.modell, variante: v.variante }, true);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const get = (k: keyof Input) => (sp.get(k) ?? "").slice(0, 120);
    setV({ marke: get("marke"), modell: get("modell"), variante: get("variante"), jahr: get("jahr").replace(/\D/g, ""), km: get("km").replace(/\D/g, ""), soh: get("soh").replace(/\D/g, "") });
  }, []);

  // Keep the URL shareable.
  useEffect(() => {
    const sp = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val) sp.set(k, val);
    const qs = sp.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  }, [v]);

  const set = (p: Partial<Input>) => setV((x) => ({ ...x, ...p }));
  const year = Number(v.jahr);
  const km = Number(v.km);
  const ready = Boolean(sel.model && year >= 2008 && v.km !== "");

  const priceNew =
    sel.variant?.price_new_chf ??
    (sel.variants.map((x) => x.price_new_chf).filter((p): p is number => p !== null).sort((a, b) => a - b)[0] ?? null);

  const estimate = useMemo(
    () =>
      ready && sel.model
        ? estimatePrice(listings, {
            modelSlug: sel.model.slug,
            brand: sel.brand?.name ?? v.marke,
            model: sel.model.name,
            year,
            km,
            soh: Number(v.soh) || null,
            priceNew,
          })
        : null,
    [ready, sel.model, sel.brand, v.marke, v.soh, listings, year, km, priceNew],
  );

  const wizard = new URLSearchParams();
  for (const k of ["marke", "modell", "variante", "jahr", "km", "soh"] as const) if (v[k]) wizard.set(k, v[k]);

  const years = Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        crumbs={[
          { label: "Start", href: href("/") },
          { label: "Verkaufen", href: href("/verkaufen") },
          { label: "Preis-Check" },
        ]}
        title="Was ist dein E-Auto wert?"
        lead="Gratis und ohne Konto: eine Preisspanne aus vergleichbaren Inseraten — mit der Rechnung dazu."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <form className="card space-y-4 self-start p-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Marke">
            <Select
              value={sel.brand?.name ?? v.marke}
              onFocus={loadVehicleCatalog}
              onChange={(e) => set({ marke: e.target.value, modell: "", variante: "" })}
            >
              <option value="">{sel.status === "loading" ? "Katalog wird geladen…" : "Bitte wählen"}</option>
              {sel.brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Modell">
            <Select value={v.modell} disabled={!sel.brand} onChange={(e) => set({ modell: e.target.value, variante: "" })}>
              <option value="">{sel.brand ? "Bitte wählen" : "Zuerst die Marke"}</option>
              {sel.brand &&
                MODEL_GROUPS.map((g) => {
                  const models = sel.brand!.models.filter((m) => g.includes.includes(m.availability));
                  return (
                    models.length > 0 && (
                      <optgroup key={g.label} label={g.label}>
                        {models.map((m) => (
                          <option key={m.id} value={m.slug}>
                            {modelOptionLabel(m)}
                          </option>
                        ))}
                      </optgroup>
                    )
                  );
                })}
            </Select>
          </Field>
          <Field label="Variante" optional>
            <Select value={v.variante} disabled={!sel.model} onChange={(e) => set({ variante: e.target.value })}>
              <option value="">Alle Varianten</option>
              {sel.variants.map((x) => (
                <option key={x.id} value={x.slug}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jahrgang">
              <Select value={v.jahr} onChange={(e) => set({ jahr: e.target.value })}>
                <option value="">Jahr</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kilometer">
              <input
                value={v.km}
                onChange={(e) => set({ km: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                inputMode="numeric"
                placeholder="45000"
                className="field tabular"
              />
            </Field>
          </div>
          <Field label="Batteriezustand (SOH) %" optional>
            <input
              value={v.soh}
              onChange={(e) => set({ soh: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              inputMode="numeric"
              placeholder="94"
              className="field tabular"
            />
          </Field>
        </form>

        <section aria-live="polite" className="min-w-0">
          {!ready ? (
            <div className="card grid min-h-64 place-items-center p-8 text-center">
              <div>
                <Tag size={28} aria-hidden className="mx-auto text-fg3" />
                <p className="mt-3 text-body text-fg2">Modell, Jahrgang und Kilometer wählen — die Schätzung erscheint hier.</p>
              </div>
            </div>
          ) : !estimate ? (
            <Notice>
              Für den {sel.model?.name} haben wir noch zu wenige Vergleichsinserate und keinen Neupreis im Katalog. Inseriere
              mit deinem Wunschpreis — der Preis-Check im Inserat lernt mit jedem neuen Auto dazu.
            </Notice>
          ) : (
            <div className="card p-5 sm:p-6">
              <p className="eyebrow">Geschätzter Angebotspreis</p>
              <p className="mt-1 text-display font-bold text-fg tabular sm:text-display-lg">
                CHF {fmtCH(estimate.low)} – {fmtCH(estimate.high)}
              </p>
              <p className="mt-1 text-body text-fg2">
                Mitte: <span className="font-semibold text-fg tabular">CHF {fmtCH(estimate.mid)}</span> für einen{" "}
                {sel.brand?.name} {sel.model?.name} {year} mit {fmtCH(km)} km
                {v.soh ? ` und ${v.soh} % SOH` : ""}.
              </p>
              <p className="mt-4 max-w-prose text-small text-fg3">{PRICE_METHOD[estimate.method]}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href={`${href("/verkaufen/neu")}?${wizard}`} variant="primary">
                  Jetzt inserieren <ArrowRight size={16} aria-hidden />
                </LinkButton>
                <span className="self-center text-small text-fg2">Die Daten sind schon ausgefüllt.</span>
              </div>
            </div>
          )}

          {estimate && estimate.comparables.length > 0 && (
            <div className="mt-8">
              <h2 className="text-h2 font-bold text-fg">Vergleichbare Inserate</h2>
              <p className="mt-1 text-small text-fg2">Die nächsten nach Jahrgang und Kilometerstand.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {estimate.comparables.slice(0, 6).map((c) => (
                  <div key={c.listing.id}>
                    <ListingCard listing={c.listing} />
                    <p className="mt-1.5 text-micro text-fg3 tabular">
                      Umgerechnet auf dein Auto: CHF {fmtCH(Math.round(c.adjusted / 100) * 100)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
