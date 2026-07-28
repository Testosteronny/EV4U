/* ============================================================================
   fetch-fuel-prices.mjs — bakes the official Swiss average pump prices.

   Source (official, open, key-free): BFS Landesindex der Konsumentenpreise,
   "Durchschnittspreise für Energie und Treibstoffe" — stable order number
   su-d-05.02.91 on the BFS DAM hub. The BFS surveys pump prices twice a
   month; the table carries one national average per month (Bleifrei 95 /
   Bleifrei 98 / Diesel, CHF/L). One rate for all of Switzerland — the tax
   component of fuel is federal, canton averages differ by only a few
   Rappen (station-level competition dominates), so a national average is
   the honest model.

   Output: src/data/fuelPrices.json — { meta, benzin95, diesel }. Committed
   as the offline fallback; CI re-runs this before every build and a monthly
   scheduled deploy keeps the site current:

       npm run fetch:fuel

   Node 18+, zero dependencies.
   ============================================================================ */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/fuelPrices.json");

const ORDER_NR = "su-d-05.02.91";
const DAM_API = `https://dam-api.bfs.admin.ch/hub/api/dam/assets?orderNr=${ORDER_NR}`;
const SHEET_NAME = "Monat - Mois";
// Column letters in the monthly sheet (header row 5): V = Bleifrei 95,
// W = Bleifrei 98, X = Diesel — all CHF per litre.
const COL_B95 = "V";
const COL_DIESEL = "X";

/* --------------------------------------------------------------------------
   Minimal ZIP reader (central directory → single entry), avoids any deps.
   Same implementation as fetch-tariffs.mjs; XLSX is a ZIP of XML parts.
   -------------------------------------------------------------------------- */
function unzipEntry(buf, entrySuffix) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP: EOCD not found");
  let off = buf.readUInt32LE(eocd + 16);

  while (buf.readUInt32LE(off) === 0x02014b50) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    if (name.endsWith(entrySuffix)) {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      return method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`ZIP: entry *${entrySuffix} not found`);
}

/** Newest edition of the asset (the DAM keeps historic editions too). */
async function latestAssetMasterUrl() {
  const res = await fetch(DAM_API, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`DAM API ${res.status}`);
  const { data } = await res.json();
  if (!data?.length) throw new Error("DAM API: no assets for order number");
  const newest = [...data].sort((a, b) =>
    String(b.bfs?.embargo ?? "").localeCompare(String(a.bfs?.embargo ?? "")),
  )[0];
  const master = (newest.links ?? []).find((l) => l.rel === "master");
  if (!master) throw new Error("DAM API: master link missing");
  return master.href;
}

/** Sheet name → worksheet XML, via workbook.xml + its rels. */
function sheetXml(xlsx, sheetName) {
  const workbook = unzipEntry(xlsx, "xl/workbook.xml").toString("utf8");
  const sheet = [...workbook.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)].find(
    (m) => m[1] === sheetName,
  );
  if (!sheet) throw new Error(`XLSX: sheet "${sheetName}" not found`);
  const rels = unzipEntry(xlsx, "xl/_rels/workbook.xml.rels").toString("utf8");
  const rel = new RegExp(`Id="${sheet[2]}"[^>]*Target="([^"]*)"`).exec(rels);
  if (!rel) throw new Error(`XLSX: relationship ${sheet[2]} not found`);
  return unzipEntry(xlsx, rel[1].replace(/^\/?(xl\/)?/, "xl/")).toString("utf8");
}

/** Excel serial date (1900 system) → "YYYY-MM". */
function serialToMonth(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(serial)) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseLatestPrices(xml) {
  let latest = null;
  for (const row of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*>(?:[\s\S]*?<v>([^<]*)<\/v>)?/g)) {
      cells[c[1]] = c[2];
    }
    const b95 = Number(cells[COL_B95]);
    const diesel = Number(cells[COL_DIESEL]);
    if (cells.A && b95 > 0 && diesel > 0) {
      latest = { month: serialToMonth(cells.A), benzin95: b95, diesel };
    }
  }
  if (!latest) throw new Error("XLSX: no priced month found");
  return latest;
}

const masterUrl = await latestAssetMasterUrl();
console.log(`BFS asset: ${masterUrl}`);
const res = await fetch(masterUrl);
if (!res.ok) throw new Error(`Download ${res.status}`);
const xlsx = Buffer.from(await res.arrayBuffer());

const { month, benzin95, diesel } = parseLatestPrices(sheetXml(xlsx, SHEET_NAME));

// Sanity gate: a parsing drift must never silently poison the cost model.
const plausible = (v) => v > 0.8 && v < 4;
if (!plausible(benzin95) || !plausible(diesel) || month < "2024-01") {
  throw new Error(`Implausible result: ${month} B95=${benzin95} Diesel=${diesel}`);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: {
        source: `BFS LIK — Durchschnittspreise Treibstoffe (${ORDER_NR})`,
        url: `https://www.bfs.admin.ch/asset/de/${ORDER_NR}`,
        month,
        fetched: new Date().toISOString().slice(0, 10),
      },
      benzin95,
      diesel,
    },
    null,
    2,
  ) + "\n",
);
console.log(`OK: ${month} — Bleifrei 95 CHF ${benzin95}/L · Diesel CHF ${diesel}/L → ${OUT}`);
