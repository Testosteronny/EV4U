import { useEffect, type ReactNode } from "react";
import { useStore } from "@nanostores/react";
import { Field } from "./ui";
import { useVehicleVariants } from "../hooks/useVehicleCatalog";
import { $vehicleCatalog, loadVehicleCatalog } from "../stores/vehicleCatalog";
import {
  modelOptionLabel,
  type CatalogBrand,
  type CatalogModel,
  type CatalogVariant,
} from "../lib/vehicleCatalog";
import type { LoadStatus } from "../stores/vehicleCatalog";
import { brandName } from "../utils/format";
import { fold } from "../utils/search";

/* ============================================================================
   VehicleFilter — Marke → Modell → Variante für Käufer, aus demselben
   Katalog, aus dem Verkäufer ihr Auto wählen.

   Native Selects wie im Verkaufs-Assistenten (87 Marken wählt man im
   System-Picker schneller als in jeder eigenen Liste). Jede Stufe zeigt
   zuerst, was im Bestand ist, mit Trefferzahl — und danach den ganzen
   Katalog: auch ein Modell ohne Inserat lässt sich wählen und als Suche
   merken, damit man beim ersten Treffer Bescheid bekommt.

   In der URL steht die Marke als Name (wie bisher — alte Links und die
   KI-Suche setzen «TESLA») und Modell/Variante als Katalog-Slug.
   ============================================================================ */

export type VehicleFilterValue = { marke: string; modell: string; variante: string };

export type VehicleSelection = {
  status: LoadStatus;
  brands: CatalogBrand[];
  brand: CatalogBrand | null;
  model: CatalogModel | null;
  variants: CatalogVariant[];
  variantStatus: LoadStatus;
  variant: CatalogVariant | null;
};

/** Die Filterwerte, gegen den Katalog aufgelöst. Lädt den Katalog nur, wenn
 *  `load` — die Seite braucht ihn erst für ein Modell in der URL oder
 *  sobald jemand den Filter öffnet. */
export function useVehicleSelection(v: VehicleFilterValue, load: boolean): VehicleSelection {
  const { brands, status } = useStore($vehicleCatalog);
  useEffect(() => {
    if (load) loadVehicleCatalog();
  }, [load]);

  const brand = v.marke === "ALLE" ? null : (brands.find((b) => fold(b.name) === fold(v.marke)) ?? null);
  const pool = brand ? brand.models : brands.flatMap((b) => b.models);
  const model = v.modell ? (pool.find((m) => m.slug === v.modell) ?? null) : null;
  const { variants, status: variantStatus } = useVehicleVariants(model?.id ?? null);
  const variant = v.variante ? (variants.find((x) => x.slug === v.variante) ?? null) : null;

  return { status, brands, brand, model, variants, variantStatus, variant };
}

/** Wie die Auswahl in Chips und Filterknopf heisst. */
export function selectionLabels(v: VehicleFilterValue, sel: VehicleSelection) {
  return {
    brand: sel.brand?.name ?? brandName(v.marke),
    model: sel.model?.name ?? "Modell",
    variant: sel.variant?.name ?? "Variante",
  };
}

type CountKey = keyof VehicleFilterValue;

export default function VehicleFilter({
  value,
  onChange,
  count,
  stockBrands,
}: {
  value: VehicleFilterValue;
  onChange: (next: VehicleFilterValue) => void;
  /** Trefferzahl, wenn dieser Wert gesetzt würde (alles andere bleibt). */
  count: (key: CountKey, val: string) => number;
  /** Marken im Bestand, wie sie in den Inseraten stehen — reicht, solange
   *  der Katalog fehlt, und deckt eingetippte Marken ausserhalb ab. */
  stockBrands: string[];
}) {
  const sel = useVehicleSelection(value, true);
  const ready = sel.status === "ready";

  /* ---- Marken: Katalog + eingetippte Bestandsmarken ---------------------- */
  const extraBrands = ready
    ? stockBrands.filter((s) => !sel.brands.some((b) => fold(b.name) === fold(s)))
    : stockBrands;
  const brandOptions = [
    ...(ready ? sel.brands.map((b) => ({ value: b.name, label: b.name })) : []),
    ...extraBrands.map((s) => ({ value: s, label: brandName(s) })),
  ].map((o) => ({ ...o, n: count("marke", o.value) }));
  const brandValue =
    value.marke === "ALLE"
      ? ""
      : (brandOptions.find((o) => fold(o.value) === fold(value.marke))?.value ?? value.marke);

  /* ---- Modelle der gewählten Katalog-Marke ------------------------------- */
  const modelOptions = (sel.brand?.models ?? []).map((m) => ({
    value: m.slug,
    label: modelOptionLabel(m),
    n: count("modell", m.slug),
  }));

  const variantOptions = sel.variants.map((x) => ({
    value: x.slug,
    label: x.name,
    n: count("variante", x.slug),
  }));

  return (
    <div className="grid gap-3">
      <Field label="Marke">
        <select
          value={brandValue}
          onChange={(e) => onChange({ marke: e.target.value || "ALLE", modell: "", variante: "" })}
          className="field"
        >
          <option value="">Alle Marken ({count("marke", "ALLE")})</option>
          <Grouped options={brandOptions} restLabel="Weitere Marken" />
        </select>
      </Field>

      {sel.status === "loading" && value.marke !== "ALLE" && (
        <p className="text-small text-fg3" aria-live="polite">
          Modelle werden geladen…
        </p>
      )}

      {sel.brand && (
        <Field label="Modell">
          <select
            value={sel.model ? value.modell : ""}
            onChange={(e) => onChange({ ...value, modell: e.target.value, variante: "" })}
            className="field"
          >
            <option value="">Alle Modelle von {sel.brand.name}</option>
            <Grouped options={modelOptions} restLabel="Weitere Modelle" />
          </select>
        </Field>
      )}

      {sel.model && (
        <Field label="Variante">
          <select
            value={sel.variant ? value.variante : ""}
            onChange={(e) => onChange({ ...value, variante: e.target.value })}
            disabled={sel.variantStatus === "loading"}
            className="field"
          >
            <option value="">
              {sel.variantStatus === "loading" ? "Varianten werden geladen…" : "Alle Varianten"}
            </option>
            {variantOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {withCount(o.label, o.n)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {sel.status === "error" && (
        <p className="text-small text-fg2">
          Der Modellkatalog ist gerade nicht erreichbar — gefiltert wird nach Marke.{" "}
          <button
            type="button"
            onClick={loadVehicleCatalog}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Nochmals laden
          </button>
        </p>
      )}

      {sel.brand && (
        <p className="text-micro text-fg3">
          Modell und Variante finden Inserate, die aus dem Fahrzeugkatalog erfasst wurden.
        </p>
      )}
    </div>
  );
}

/** Was im Bestand ist zuerst (mit Zahl), danach der Rest des Katalogs. */
function Grouped({
  options,
  restLabel,
}: {
  options: { value: string; label: string; n: number }[];
  restLabel: string;
}): ReactNode {
  const inStock = options.filter((o) => o.n > 0);
  const rest = options.filter((o) => o.n === 0);
  const render = (list: typeof options) =>
    list.map((o) => (
      <option key={o.value} value={o.value}>
        {withCount(o.label, o.n)}
      </option>
    ));
  if (inStock.length === 0) return render(rest);
  return (
    <>
      <optgroup label="Im Bestand">{render(inStock)}</optgroup>
      {rest.length > 0 && <optgroup label={restLabel}>{render(rest)}</optgroup>}
    </>
  );
}

const withCount = (label: string, n: number): string => (n > 0 ? `${label} (${n})` : label);
