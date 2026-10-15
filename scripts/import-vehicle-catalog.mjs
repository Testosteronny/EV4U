/* ============================================================================
   import-vehicle-catalog.mjs — the EV catalog, from the EV4U variant database.

   Input: the curated workbook «EV4U_Elektroauto_Varianten_Europa_*.xlsx»,
   sheets «Modelle & Varianten» (sold new) and «Auslauf & Occasion» (used
   only). One row per drivetrain/battery variant; the ID column
   («marke_modell_variante») is the stable key.

   Output:
     supabase/seed/vehicle_catalog.sql  — one transaction that upserts brands,
       models and variants on their source keys and deletes what the
       workbook no longer lists. Ids survive re-imports, so listings keep
       their links; a dropped variant only unlinks its listings.
     src/data/vehicleCatalogMeta.json   — edition date and counts, bundled.

       npm run catalog:import -- ~/Downloads/EV4U_Elektroauto_Varianten_Europa_2026.xlsx
       psql "$DATABASE_URL" -f supabase/seed/vehicle_catalog.sql

   (or paste the SQL file into the Supabase SQL editor). Commit both outputs:
   the SQL diff is the review of what changed in the catalog.

   Every cell is validated — type, range, vocabulary — and every model-level
   column must be the same on all of a model's rows. Any problem aborts with
   sheet, row and column: a half-understood workbook never reaches the
   database. As a last gate the counts must match the workbook's own
   «Übersicht».

   Node 18+, zero dependencies.
   ============================================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook } from "./lib/xlsx.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_SQL = resolve(ROOT, "supabase/seed/vehicle_catalog.sql");
const OUT_META = resolve(ROOT, "src/data/vehicleCatalogMeta.json");

const SHEETS = ["Modelle & Varianten", "Auslauf & Occasion"];
const OVERVIEW = "Übersicht";

/* --------------------------------------------------------------------------
   Cell parsers. Each returns the typed value or throws a message; `null`
   means «no value» and is only allowed where the column says so.
   -------------------------------------------------------------------------- */

const EMPTY = new Set(["", "–", "—", "-"]);
const isEmpty = (v) => v === null || v === undefined || (typeof v === "string" && EMPTY.has(v.trim()));

const required = (parse) => (v) => {
  if (isEmpty(v)) throw "required value missing";
  return parse(v);
};
const optional = (parse) => (v) => (isEmpty(v) ? null : parse(v));

const text = (max) => (v) => {
  const s = String(v).replace(/\s+/g, " ").trim();
  if (s.length > max) throw `longer than ${max} characters`;
  return s;
};

/** A number with at most `digits` decimals, within [min, max]. Excel stores
 *  doubles, so 7.3 may arrive as 7.2999999999999998 — round, but refuse a
 *  value that really has more precision than the column keeps. */
const num = ({ digits = 0, min = -Infinity, max = Infinity }) => (v) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/['’\s]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw `not a number: «${v}»`;
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  if (Math.abs(r - n) > 1e-9 * Math.max(1, Math.abs(n))) throw `more than ${digits} decimals: ${n}`;
  if (r < min || r > max) throw `${r} outside ${min}–${max}`;
  return r;
};

/** Vocabulary → stored code. Unknown values abort: a new category needs a
 *  conscious decision (and a CHECK constraint update), not a silent pass. */
const oneOf = (map) => (v) => {
  const s = String(v).trim();
  if (!Object.hasOwn(map, s)) throw `unknown value «${s}» (expected: ${Object.keys(map).join(", ")})`;
  return map[s];
};
const same = (...values) => Object.fromEntries(values.map((x) => [x, x]));

/** «8 J. / 160'000 km», «bis 10 J. / 250'000 km». */
const warranty = (v) => {
  const m = /^(bis\s+)?(\d{1,2})\s*J\.?\s*\/\s*([\d'’]+)\s*km$/i.exec(String(v).trim());
  if (!m) throw `unreadable battery warranty «${v}»`;
  return { conditional: Boolean(m[1]), years: Number(m[2]), km: Number(m[3].replace(/['’]/g, "")) };
};

/** «2021 (Facelift 2024)», «2019–2022», «Herbst 2026», «offen». The label
 *  is kept as published; the years are what the site can compute with. */
const launch = (v) => {
  const label = text(80)(v);
  const range = /^((?:19|20)\d{2})\s*[–-]\s*((?:19|20)\d{2})$/.exec(label);
  const first = /(?:19|20)\d{2}/.exec(label);
  return {
    label,
    launchYear: first ? Number(first[0]) : null,
    endYear: range ? Number(range[2]) : null,
  };
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* --------------------------------------------------------------------------
   Columns: header as in the workbook → field, parser, level.
   `model` columns must be constant per model (verified below).
   -------------------------------------------------------------------------- */

const COLUMNS = [
  ["ID", "id", required(text(160)), "variant"],
  ["Marke", "brand", required(text(60)), "model"],
  ["Modell", "model", required(text(80)), "model"],
  ["Variante", "name", required(text(80)), "variant"],
  ["Fahrzeugklasse", "vehicle_class", required(oneOf(same("M1", "N1", "L6e", "L7e", "L6e/L7e"))), "variant"],
  ["Segment", "segment", required(oneOf(same("Kleinwagen", "Kompaktklasse", "Mittelklasse", "Oberklasse", "SUV", "VAN/BUS", "Sportwagen", "Pick-up"))), "model"],
  ["Karosserie", "body_type", required(oneOf(same("Schrägheck", "Limousine", "Kombi", "SUV", "Coupé-SUV", "Coupé", "Cabrio", "Roadster", "Van", "Hochdachkombi", "Microcar", "Pick-up"))), "model"],
  ["Sitzplätze", "seats", required(num({ min: 1, max: 9 })), "variant"],
  ["Antrieb", "drive", required(oneOf(same("FWD", "RWD", "AWD"))), "variant"],
  ["Motoren", "motors", required(num({ min: 1, max: 4 })), "variant"],
  ["Leistung (kW)", "power_kw", optional(num({ min: 1, max: 2000 })), "variant"],
  ["Leistung (PS)", "power_ps", optional(num({ min: 1, max: 2800 })), "variant"],
  ["0–100 km/h (s)", "accel_0_100_s", optional(num({ digits: 2, min: 1, max: 40 })), "variant"],
  ["Vmax (km/h)", "top_speed_kmh", optional(num({ min: 20, max: 500 })), "variant"],
  ["Batterie brutto (kWh)", "battery_gross_kwh", optional(num({ digits: 1, min: 1, max: 300 })), "variant"],
  ["Batterie netto (kWh)", "battery_net_kwh", optional(num({ digits: 1, min: 1, max: 300 })), "variant"],
  ["Zellchemie", "cell_chemistry", required(oneOf(same("NMC", "NCA", "LFP", "LMFP", "Na-Ion"))), "variant"],
  ["Bordnetz (V)", "system_voltage_v", required(num({ min: 12, max: 1500 })), "variant"],
  ["Reichweite WLTP (km)", "range_wltp_km", optional(num({ min: 20, max: 1500 })), "variant"],
  ["Verbrauch (kWh/100km)", "consumption_kwh_100km", optional(num({ digits: 1, min: 3, max: 60 })), "variant"],
  ["DC max (kW)", "dc_max_kw", optional(num({ min: 5, max: 2000 })), "variant"],
  ["DC 10–80% (min)", "dc_10_80_min", optional(num({ min: 3, max: 240 })), "variant"],
  ["AC max (kW)", "ac_max_kw", required(num({ digits: 1, min: 0.5, max: 50 })), "variant"],
  ["Ladeanschluss", "charge_port", required(oneOf(same("CCS2", "Typ 2", "Typ 2 / CCS2", "CHAdeMO", "Schuko"))), "variant"],
  ["V2L", "v2l", required(oneOf({ Ja: true, Nein: false })), "variant"],
  ["Kofferraum (l)", "trunk_l", optional(num({ min: 0, max: 5000 })), "variant"],
  ["Frunk (l)", "frunk_l", optional(num({ min: 0, max: 1000 })), "variant"],
  ["Anhängelast (kg)", "towing_kg", optional(num({ min: 0, max: 10000 })), "variant"],
  ["Länge (mm)", "length_mm", optional(num({ min: 1000, max: 8000 })), "variant"],
  ["Breite (mm)", "width_mm", optional(num({ min: 500, max: 3000 })), "variant"],
  ["Höhe (mm)", "height_mm", optional(num({ min: 500, max: 4000 })), "variant"],
  ["Radstand (mm)", "wheelbase_mm", optional(num({ min: 500, max: 5000 })), "variant"],
  ["Leergewicht (kg)", "curb_weight_kg", optional(num({ min: 200, max: 5000 })), "variant"],
  ["Batteriegarantie", "warranty", optional(warranty), "variant"],
  ["Garantierte Restkapazität (%)", "battery_warranty_soh_pct", optional(num({ min: 50, max: 100 })), "variant"],
  ["Neupreis ab (CHF)", "price_new_chf", optional(num({ min: 1000, max: 10_000_000 })), "variant"],
  ["Verfügbarkeit CH", "availability", required(oneOf({ Ja: "LIEFERBAR", Import: "IMPORT", Angekündigt: "ANGEKUENDIGT", Auslauf: "AUSLAUF", Occasion: "OCCASION" })), "model"],
  ["Marktstart", "launch", required(launch), "model"],
  ["Herkunftsland", "origin_country", optional(text(80)), "model"],
  ["Konzern", "manufacturer_group", optional(text(80)), "model"],
  ["Bemerkung", "remark", optional(text(500)), "model"],
];

const normHeader = (h) => String(h ?? "").replace(/\s+/g, " ").trim();

/* --------------------------------------------------------------------------
   Read + validate
   -------------------------------------------------------------------------- */

const input = process.argv[2];
if (!input) {
  console.error("usage: npm run catalog:import -- <path/to/EV4U_Elektroauto_Varianten_*.xlsx>");
  process.exit(2);
}

const wb = readWorkbook(readFileSync(input));
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

/** One parsed record per variant row, with its sheet position for messages. */
const records = [];
const perSheet = new Map();

for (const sheet of SHEETS) {
  const [head, ...body] = wb.rows(sheet);
  const headers = head.cells.map(normHeader);
  const index = new Map(headers.map((h, i) => [h, i]));
  for (const [h] of COLUMNS) if (!index.has(h)) fail(sheet, `column «${h}» missing`);
  for (const h of headers) if (h && !COLUMNS.some(([c]) => c === h)) fail(sheet, `unexpected column «${h}» — map it in COLUMNS or remove it`);
  if (errors.length) continue;

  let count = 0;
  for (const { row, cells } of body) {
    if (cells.every(isEmpty)) continue;
    count++;
    const rec = { sheet, row };
    for (const [header, key, parse] of COLUMNS) {
      try {
        rec[key] = parse(cells[index.get(header)]);
      } catch (msg) {
        fail(`${sheet}!${row} «${header}»`, msg instanceof Error ? msg.message : msg);
      }
    }
    records.push(rec);
  }
  perSheet.set(sheet, count);
}
if (errors.length) abort();

const brands = new Map(); // slug → { slug, name }
const models = new Map(); // slug → { slug, brandSlug, rows[] , …model fields }
const variants = new Map(); // slug → variant record

const MODEL_FIELDS = COLUMNS.filter(([, , , level]) => level === "model").map(([h, key]) => [h, key]);
const same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const r of records) {
  const where = `${r.sheet}!${r.row}`;
  const parts = r.id.split("_");
  if (parts.length !== 3 || !parts.every((p) => SLUG.test(p))) {
    fail(where, `ID «${r.id}» is not «marke_modell_variante» in lowercase-dashed form`);
    continue;
  }
  const [brandSlug, modelPart] = parts;
  const modelSlug = `${brandSlug}_${modelPart}`;

  const dup = variants.get(r.id);
  if (dup) {
    fail(where, `duplicate ID «${r.id}» (first in ${dup.sheet}!${dup.row})`);
    continue;
  }
  variants.set(r.id, { ...r, modelSlug });

  const b = brands.get(brandSlug);
  if (!b) brands.set(brandSlug, { slug: brandSlug, name: r.brand });
  else if (b.name !== r.brand) fail(where, `brand key «${brandSlug}» is used for «${b.name}» and «${r.brand}»`);

  const m = models.get(modelSlug);
  if (!m) {
    models.set(modelSlug, { slug: modelSlug, brandSlug, first: r, variantNames: new Set([r.name]) });
  } else {
    for (const [header, key] of MODEL_FIELDS) {
      if (!same2(m.first[key], r[key])) {
        fail(where, `«${header}» differs within model «${r.brand} ${r.model}» (${m.first.sheet}!${m.first.row}: ${JSON.stringify(m.first[key])} vs ${JSON.stringify(r[key])}) — it is a model-level column`);
      }
    }
    if (m.variantNames.has(r.name)) fail(where, `variant name «${r.name}» twice in model «${r.model}»`);
    m.variantNames.add(r.name);
  }
  if (r.battery_net_kwh !== null && r.battery_gross_kwh !== null && r.battery_net_kwh > r.battery_gross_kwh) {
    fail(where, `net battery ${r.battery_net_kwh} kWh exceeds gross ${r.battery_gross_kwh} kWh`);
  }
}

// Brand names and model names must be unique, too — they are what people pick.
const seen = new Map();
for (const b of brands.values()) {
  if (seen.has(b.name)) fail("brands", `«${b.name}» has two keys: ${seen.get(b.name)}, ${b.slug}`);
  seen.set(b.name, b.slug);
}
const modelNames = new Map();
for (const m of models.values()) {
  const k = `${m.brandSlug}|${m.first.model}`;
  if (modelNames.has(k)) fail("models", `«${m.first.brand} ${m.first.model}» has two keys: ${modelNames.get(k)}, ${m.slug}`);
  modelNames.set(k, m.slug);
}
if (errors.length) abort();

/* --------------------------------------------------------------------------
   Last gate: the workbook's own «Übersicht» totals (new-car sheet). A sheet
   cut short by a filter or a stray blank row shows up here.
   -------------------------------------------------------------------------- */

let edition = null;
if (wb.sheetNames.includes(OVERVIEW)) {
  const overview = wb.rows(OVERVIEW);
  const label = (l) => overview.find((r) => normHeader(r.cells[0]) === l)?.cells[1];
  const stand = overview.map((r) => String(r.cells[0] ?? "")).join("\n").match(/Stand:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (stand) edition = `${stand[3]}-${stand[2].padStart(2, "0")}-${stand[1].padStart(2, "0")}`;

  const newSheet = records.filter((r) => r.sheet === SHEETS[0]);
  const expect = [
    ["Marken", new Set(newSheet.map((r) => r.brand)).size],
    ["Modelle", new Set(newSheet.map((r) => `${r.brand}|${r.model}`)).size],
    ["Varianten (neu erhältlich)", perSheet.get(SHEETS[0])],
    ["Varianten (Auslauf/Occasion)", perSheet.get(SHEETS[1])],
  ];
  for (const [l, actual] of expect) {
    const stated = label(l);
    if (stated === undefined) console.warn(`warning: «${OVERVIEW}» has no «${l}» — not cross-checked`);
    else if (Number(stated) !== actual) fail(OVERVIEW, `«${l}» says ${stated}, the sheets hold ${actual}`);
  }
} else {
  console.warn(`warning: no «${OVERVIEW}» sheet — totals not cross-checked`);
}
if (!edition) fail(OVERVIEW, "no «Stand: TT.MM.JJJJ» found — the edition date labels every price on the site");
if (errors.length) abort();

function abort() {
  console.error(`\n${errors.length} problem(s) in ${basename(input)}:\n`);
  for (const e of errors.slice(0, 200)) console.error(`  · ${e}`);
  if (errors.length > 200) console.error(`  … and ${errors.length - 200} more`);
  console.error("\nNothing written.");
  process.exit(1);
}

/* --------------------------------------------------------------------------
   SQL
   -------------------------------------------------------------------------- */

const lit = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const tuple = (values) => `  (${values.map(lit).join(", ")})`;
const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

const brandRows = [...brands.values()].sort(bySlug);
const modelRows = [...models.values()].sort(bySlug).map((m) => ({ slug: m.slug, brandSlug: m.brandSlug, ...m.first }));
const variantRows = [...variants.values()].map((v) => ({ ...v, slug: v.id })).sort(bySlug);

const MODEL_COLS = [
  ["slug", "text", (m) => m.slug],
  ["brand_slug", "text", (m) => m.brandSlug],
  ["name", "text", (m) => m.model],
  ["segment", "text", (m) => m.segment],
  ["body_type", "text", (m) => m.body_type],
  ["availability", "text", (m) => m.availability],
  ["market_launch", "text", (m) => m.launch.label],
  ["launch_year", "smallint", (m) => m.launch.launchYear],
  ["end_year", "smallint", (m) => m.launch.endYear],
  ["origin_country", "text", (m) => m.origin_country],
  ["manufacturer_group", "text", (m) => m.manufacturer_group],
  ["remark", "text", (m) => m.remark],
];

const VARIANT_COLS = [
  ["slug", "text", (v) => v.slug],
  ["model_slug", "text", (v) => v.modelSlug],
  ["name", "text", (v) => v.name],
  ["vehicle_class", "text", (v) => v.vehicle_class],
  ["seats", "smallint", (v) => v.seats],
  ["drive", "text", (v) => v.drive],
  ["motors", "smallint", (v) => v.motors],
  ["power_kw", "smallint", (v) => v.power_kw],
  ["power_ps", "smallint", (v) => v.power_ps],
  ["accel_0_100_s", "numeric", (v) => v.accel_0_100_s],
  ["top_speed_kmh", "smallint", (v) => v.top_speed_kmh],
  ["battery_gross_kwh", "numeric", (v) => v.battery_gross_kwh],
  ["battery_net_kwh", "numeric", (v) => v.battery_net_kwh],
  ["cell_chemistry", "text", (v) => v.cell_chemistry],
  ["system_voltage_v", "smallint", (v) => v.system_voltage_v],
  ["range_wltp_km", "smallint", (v) => v.range_wltp_km],
  ["consumption_kwh_100km", "numeric", (v) => v.consumption_kwh_100km],
  ["dc_max_kw", "smallint", (v) => v.dc_max_kw],
  ["dc_10_80_min", "smallint", (v) => v.dc_10_80_min],
  ["ac_max_kw", "numeric", (v) => v.ac_max_kw],
  ["charge_port", "text", (v) => v.charge_port],
  ["v2l", "boolean", (v) => v.v2l],
  ["trunk_l", "smallint", (v) => v.trunk_l],
  ["frunk_l", "smallint", (v) => v.frunk_l],
  ["towing_kg", "smallint", (v) => v.towing_kg],
  ["length_mm", "smallint", (v) => v.length_mm],
  ["width_mm", "smallint", (v) => v.width_mm],
  ["height_mm", "smallint", (v) => v.height_mm],
  ["wheelbase_mm", "smallint", (v) => v.wheelbase_mm],
  ["curb_weight_kg", "smallint", (v) => v.curb_weight_kg],
  ["battery_warranty_years", "smallint", (v) => v.warranty?.years ?? null],
  ["battery_warranty_km", "integer", (v) => v.warranty?.km ?? null],
  ["battery_warranty_conditional", "boolean", (v) => v.warranty?.conditional ?? false],
  ["battery_warranty_soh_pct", "smallint", (v) => v.battery_warranty_soh_pct],
  ["price_new_chf", "integer", (v) => v.price_new_chf],
];

/** `insert … select … from (values …) join <parent> on conflict (slug) do update`. */
function upsert({ table, cols, rows, parent }) {
  const [parentTable, parentKey, fk] = parent;
  const own = cols.filter(([c]) => c !== parentKey);
  const target = ["slug", fk, ...own.filter(([c]) => c !== "slug").map(([c]) => c)];
  const select = [
    "v.slug",
    "p.id",
    // Explicit casts: a VALUES column that is null on every row would
    // otherwise be typed text and refuse to go into a numeric column.
    ...own.filter(([c]) => c !== "slug").map(([c, type]) => (type === "text" ? `v.${c}` : `v.${c}::${type}`)),
  ];
  const updates = target.filter((c) => c !== "slug").map((c) => `  ${c} = excluded.${c}`);
  return [
    `insert into public.${table} (${target.join(", ")})`,
    `select ${select.join(", ")}`,
    "from (values",
    rows.map((r) => tuple(cols.map(([, , get]) => get(r)))).join(",\n"),
    `) as v (${cols.map(([c]) => c).join(", ")})`,
    `join public.${parentTable} p on p.slug = v.${parentKey}`,
    "on conflict (slug) do update set",
    `${updates.join(",\n")};`,
  ].join("\n");
}

const keep = (rows) => `array[\n${rows.map((r) => `  ${lit(r.slug)}`).join(",\n")}\n]::text[]`;

const sql = `-- ============================================================================
-- EV4U vehicle catalog — GENERATED, do not edit by hand.
--
--   source:  ${basename(input)} (Stand ${edition})
--   content: ${brandRows.length} brands · ${modelRows.length} models · ${variantRows.length} variants
--   by:      npm run catalog:import -- <workbook.xlsx>
--
-- Idempotent: upserts on the source keys (slug) and deletes what the
-- workbook no longer lists. Listings linked to a deleted model/variant keep
-- their own data; only the link is cleared (on delete set null).
-- Apply: psql "$DATABASE_URL" -f supabase/seed/vehicle_catalog.sql
-- ============================================================================

begin;

insert into public.vehicle_brands (slug, name) values
${brandRows.map((b) => tuple([b.slug, b.name])).join(",\n")}
on conflict (slug) do update set name = excluded.name;

${upsert({ table: "vehicle_models", cols: MODEL_COLS, rows: modelRows, parent: ["vehicle_brands", "brand_slug", "brand_id"] })}

${upsert({ table: "vehicle_variants", cols: VARIANT_COLS, rows: variantRows, parent: ["vehicle_models", "model_slug", "model_id"] })}

-- Whatever the workbook no longer lists. Children first.
delete from public.vehicle_variants where slug <> all (${keep(variantRows)});

delete from public.vehicle_models where slug <> all (${keep(modelRows)});

delete from public.vehicle_brands where slug <> all (${keep(brandRows)});

-- The gate: exactly what the workbook holds, nothing else.
do $$
begin
  if (select count(*) from public.vehicle_brands) <> ${brandRows.length}
     or (select count(*) from public.vehicle_models) <> ${modelRows.length}
     or (select count(*) from public.vehicle_variants) <> ${variantRows.length} then
    raise exception 'vehicle catalog import: row counts do not match the workbook';
  end if;
end $$;

commit;
`;

const meta = {
  source: "EV4U Elektroauto-Variantendatenbank Europa",
  edition,
  brands: brandRows.length,
  models: modelRows.length,
  variants: variantRows.length,
};

mkdirSync(dirname(OUT_SQL), { recursive: true });
writeFileSync(OUT_SQL, sql);
writeFileSync(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

console.log(
  `✓ ${basename(input)} (Stand ${edition}): ${meta.brands} brands · ${meta.models} models · ${meta.variants} variants\n` +
    `  ${SHEETS.map((s) => `${s}: ${perSheet.get(s)}`).join(" · ")}\n` +
    `  → ${OUT_SQL}\n  → ${OUT_META}`,
);
