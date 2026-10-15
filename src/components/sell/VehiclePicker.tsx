import { useEffect, useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Field } from "../ui";
import {
  EMPTY_CHOICE,
  OTHER,
  UNKNOWN,
  useVehicleCatalog,
  useVehicleVariants,
  type VehicleChoice,
} from "../../hooks/useVehicleCatalog";
import {
  CATALOG_META,
  MODEL_GROUPS,
  catalogEdition,
  modelOptionLabel,
  variantFacts,
} from "../../lib/vehicleCatalog";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   VehiclePicker — Marke → Modell → Variante aus dem Fahrzeugkatalog.

   Marke und Modell als native Selects: 87 Marken wählt man auf dem Handy im
   System-Picker schneller als in jeder eigenen Liste, und am Desktop
   springt die Tastatur per Anfangsbuchstabe. Die Variante dagegen als
   Karten — dort entscheidet man an Batterie, Leistung und Antrieb, und das
   passt in keine <option>.

   Kontrolliert: der Zustand liegt beim Aufrufer (Schritt 1 des
   Verkaufsassistenten, der ihn zwischenspeichert). Was nicht im Katalog steht, lässt
   sich auf jeder Stufe eintippen.
   ============================================================================ */

export default function VehiclePicker({
  value,
  onChange,
}: {
  value: VehicleChoice;
  onChange: (next: VehicleChoice) => void;
}) {
  const catalog = useVehicleCatalog();
  const manualBrand = value.brandId === OTHER || catalog.status === "offline";
  const brand = manualBrand ? null : (catalog.brands.find((b) => b.id === value.brandId) ?? null);
  const manualModel = manualBrand || value.modelId === OTHER;
  const model = brand && !manualModel ? (brand.models.find((m) => m.id === value.modelId) ?? null) : null;
  const variants = useVehicleVariants(model?.id ?? null);
  const radioName = useId();

  const patch = (p: Partial<VehicleChoice>) => onChange({ ...value, ...p });

  // Gibt es nur eine Variante, ist nichts zu entscheiden.
  const only = variants.status === "ready" && variants.variants.length === 1 ? variants.variants[0].id : null;
  useEffect(() => {
    if (only && !value.variantId) onChange({ ...value, variantId: only });
  }, [only, value, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {catalog.status === "error" && !manualBrand && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-surface2 px-4 py-3 sm:col-span-2">
          <p className="text-body text-fg2">Der Modellkatalog ist gerade nicht erreichbar.</p>
          <TextButton onClick={catalog.retry}>Nochmals laden</TextButton>
          <TextButton onClick={() => onChange({ ...EMPTY_CHOICE, brandId: OTHER })}>
            Marke und Modell eintippen
          </TextButton>
        </div>
      )}

      {manualBrand ? (
        <Field label="Marke" hint="So, wie sie der Hersteller schreibt — «Polestar», nicht «POLESTAR».">
          <input
            value={value.brandText}
            onChange={(e) => patch({ brandText: e.target.value })}
            maxLength={40}
            autoComplete="off"
            className="field"
          />
        </Field>
      ) : (
        <Field label="Marke">
          <select
            value={value.brandId}
            onChange={(e) => onChange({ ...EMPTY_CHOICE, brandId: e.target.value })}
            disabled={catalog.status !== "ready"}
            className="field"
          >
            <option value="">
              {catalog.status === "loading" ? "Katalog wird geladen…" : "Bitte wählen"}
            </option>
            {catalog.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={OTHER}>Andere Marke (nicht im Katalog)</option>
          </select>
        </Field>
      )}

      {manualModel ? (
        <Field label="Modell">
          <input
            value={value.modelText}
            onChange={(e) => patch({ modelText: e.target.value })}
            maxLength={60}
            autoComplete="off"
            className="field"
          />
        </Field>
      ) : (
        <Field label={brand ? `Modell (${brand.models.length})` : "Modell"}>
          <select
            value={value.modelId}
            onChange={(e) =>
              patch({ modelId: e.target.value, variantId: "", modelText: "", variantText: "" })
            }
            disabled={!brand}
            className="field"
          >
            <option value="">{brand ? "Bitte wählen" : "Zuerst die Marke"}</option>
            {brand &&
              MODEL_GROUPS.map((group) => {
                const models = brand.models.filter((m) => group.includes.includes(m.availability));
                return (
                  models.length > 0 && (
                    <optgroup key={group.label} label={group.label}>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {modelOptionLabel(m)}
                        </option>
                      ))}
                    </optgroup>
                  )
                );
              })}
            {brand && <option value={OTHER}>Modell nicht in der Liste</option>}
          </select>
        </Field>
      )}

      {manualModel && (
        <Field
          label="Variante (optional)"
          hint="Wie im Fahrzeugausweis oder Prospekt, z. B. «Long Range AWD»."
        >
          <input
            value={value.variantText}
            onChange={(e) => patch({ variantText: e.target.value })}
            maxLength={80}
            autoComplete="off"
            className="field"
          />
        </Field>
      )}

      {manualBrand && catalog.status === "ready" && (
        <div className="sm:col-span-2">
          <TextButton onClick={() => onChange(EMPTY_CHOICE)}>Doch aus dem Katalog wählen</TextButton>
        </div>
      )}
      {brand && value.modelId === OTHER && (
        <div className="sm:col-span-2">
          <TextButton onClick={() => patch({ modelId: "", modelText: "", variantText: "" })}>
            Zurück zu den Modellen von {brand.name}
          </TextButton>
        </div>
      )}

      {model && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-small font-medium text-fg2">
            Variante
            {variants.status === "ready" && variants.variants.length > 1
              ? ` (${variants.variants.length})`
              : ""}
          </legend>
          {variants.status === "loading" ? (
            <p className="rounded-card bg-surface2 px-4 py-3 text-body text-fg3" aria-live="polite">
              Varianten werden geladen…
            </p>
          ) : variants.status === "error" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-surface2 px-4 py-3">
              <p className="text-body text-fg2">Die Varianten liessen sich nicht laden.</p>
              <TextButton onClick={variants.retry}>Nochmals laden</TextButton>
            </div>
          ) : (
            <div className="grid gap-2">
              {variants.variants.map((v) => {
                const facts = variantFacts(v);
                return (
                  <VariantOption
                    key={v.id}
                    name={radioName}
                    checked={value.variantId === v.id}
                    onSelect={() => patch({ variantId: v.id })}
                    title={v.name}
                    facts={facts.length > 0 ? facts.join(" · ") : "Technische Daten noch nicht publiziert"}
                    aside={
                      v.price_new_chf !== null && (
                        <>
                          <span className="block text-micro text-fg3">neu ab</span>
                          CHF {fmtCH(v.price_new_chf)}
                        </>
                      )
                    }
                  />
                );
              })}
              <VariantOption
                name={radioName}
                checked={value.variantId === UNKNOWN}
                onSelect={() => patch({ variantId: UNKNOWN })}
                title="Weiss ich nicht genau"
                facts="Die technischen Daten prüfst du gleich darunter selbst."
              />
            </div>
          )}
        </fieldset>
      )}

      {!manualBrand && (
        <p className="text-micro text-fg3 sm:col-span-2">
          Katalog: {CATALOG_META.brands} Marken · {CATALOG_META.models} Modelle ·{" "}
          {CATALOG_META.variants} Varianten, Stand {catalogEdition()}. Neupreise sind Schweizer
          Richtpreise ohne Optionen.
        </p>
      )}
    </div>
  );
}

/** Eine Variante als Radio-Karte. Das echte Radio bleibt im DOM (Tastatur,
 *  Screenreader, Pfeiltasten innerhalb der Gruppe); gezeichnet wird die
 *  Karte, und sie trägt den Fokusring des versteckten Feldes. */
function VariantOption({
  name,
  checked,
  onSelect,
  title,
  facts,
  aside,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  facts: string;
  aside?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-card border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        checked ? "border-accent bg-accent/5" : "border-line2 bg-surface hover:bg-surface2"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
            checked ? "border-accent bg-accent text-on-accent" : "border-line2 bg-surface"
          }`}
        >
          {checked && <Check size={10} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-body font-medium text-fg">{title}</span>
          <span className="mt-0.5 block text-small text-fg2 tabular">{facts}</span>
        </span>
      </span>
      {aside && <span className="shrink-0 text-right text-small text-fg2 tabular">{aside}</span>}
    </label>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-small font-medium text-accent underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}
