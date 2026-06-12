/* ============================================================================
   fetch-tariffs.mjs — bakes the official Swiss electricity-tariff lookup.

   Sources (both official, open, key-free):
   1. ElCom electricity-price cube on LINDAS (lindas.admin.ch) —
      the federal regulator's tariff of EVERY grid operator in EVERY
      municipality. We take: latest period · category H4 (typical household,
      4'500 kWh/a) · standard product · measure "total" in Rp./kWh
      (energy + grid + levies + community fees, excl. VAT).
   2. swisstopo "Amtliches Ortschaftenverzeichnis mit PLZ" (AMTOVZ) —
      PLZ → municipality (BFS no.), canton, LV95 coordinates.

   Output: src/data/tariffs.json — { meta, plz: { "4616": [name, canton,
   rpPerKwh, e, n], ... } }. Commit the JSON; re-run once a year when ElCom
   publishes the new tariffs (early September):

       npm run fetch:tariffs

   Node 18+, zero dependencies.
   ============================================================================ */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/tariffs.json");

const SPARQL_ENDPOINT = "https://lindas.admin.ch/query";
const EP = "https://energy.ld.admin.ch/elcom/electricityprice";
const AMTOVZ_ZIP =
  "https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz_2056.csv.zip";
const AMTOVZ_ENTRY = "AMTOVZ_CSV_LV95.csv";

/* --------------------------------------------------------------------------
   SPARQL helpers
   -------------------------------------------------------------------------- */
async function sparql(query, accept) {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: { Accept: accept, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}: ${await res.text()}`);
  return res.text();
}

async function latestPeriod() {
  const json = JSON.parse(
    await sparql(
      `SELECT (MAX(?p) AS ?period) WHERE { ?obs <${EP}/dimension/period> ?p }`,
      "application/sparql-results+json",
    ),
  );
  return json.results.bindings[0].period.value; // e.g. "2026"
}

/** BFS municipality number → list of operator totals (Rp./kWh). */
async function fetchTariffs(period) {
  const csv = await sparql(
    `PREFIX ep: <${EP}/dimension/>
     SELECT ?municipality ?total WHERE {
       ?obs ep:period "${period}"^^<http://www.w3.org/2001/XMLSchema#gYear> ;
            ep:category <${EP}/category/H4> ;
            ep:product <${EP}/product/standard> ;
            ep:municipality ?municipality ;
            ep:total ?total .
     }`,
    "text/csv",
  );
  const byBfs = new Map();
  for (const line of csv.trim().split("\n").slice(1)) {
    const [uri, total] = line.split(",");
    const bfs = uri.trim().split("/").pop();
    const rp = parseFloat(total);
    if (!bfs || !Number.isFinite(rp)) continue;
    if (!byBfs.has(bfs)) byBfs.set(bfs, []);
    byBfs.get(bfs).push(rp);
  }
  return byBfs;
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* --------------------------------------------------------------------------
   Minimal ZIP reader (central directory → single entry), avoids any deps.
   -------------------------------------------------------------------------- */
function unzipEntry(buf, entrySuffix) {
  // End-of-central-directory record: scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP: EOCD not found");
  let off = buf.readUInt32LE(eocd + 16); // central directory offset

  while (buf.readUInt32LE(off) === 0x02014b50) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    if (name.endsWith(entrySuffix)) {
      // Local header repeats name/extra with possibly different extra length.
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

/** PLZ → { name, canton, bfs, e, n } from the swisstopo locality directory. */
async function fetchLocalities() {
  const res = await fetch(AMTOVZ_ZIP);
  if (!res.ok) throw new Error(`AMTOVZ ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  // UTF-8, semicolon-separated.
  const text = unzipEntry(zip, AMTOVZ_ENTRY).toString("utf8");

  const rows = text.trim().split(/\r?\n/).slice(1);
  const byPlz = new Map();
  for (const row of rows) {
    const c = row.split(";");
    if (c.length < 10) continue;
    const entry = {
      // "Lausanne 25" → "Lausanne": strip delivery-district numbers
      name: c[0].replace(/\s+\d+$/, ""),
      plz: c[1],
      zusatz: c[2],
      gemeinde: c[4],
      bfs: c[5],
      canton: c[6],
      share: parseFloat(c[7]) || 0, // "Adressenanteil", e.g. "100 %"
      e: Math.round(parseFloat(c[8])),
      n: Math.round(parseFloat(c[9])),
    };
    if (!byPlz.has(entry.plz)) byPlz.set(entry.plz, []);
    byPlz.get(entry.plz).push(entry);
  }

  // Candidates per PLZ, preference-sorted: base entry (Zusatzziffer 00)
  // first, then by share of addresses. Kept as a LIST so the join can fall
  // back to the next municipality if the dominant one has no ElCom entry.
  for (const list of byPlz.values()) {
    list.sort(
      (a, b) => (a.zusatz === "00" ? -1 : 0) - (b.zusatz === "00" ? -1 : 0) || b.share - a.share,
    );
  }
  return byPlz;
}

/* --------------------------------------------------------------------------
   Main: join + write
   -------------------------------------------------------------------------- */
const period = await latestPeriod();
console.log(`ElCom period: ${period}`);

const [tariffsByBfs, localities] = await Promise.all([fetchTariffs(period), fetchLocalities()]);
console.log(`Municipalities with tariff: ${tariffsByBfs.size}`);
console.log(`Localities (PLZ): ${localities.size}`);

const plzMap = {};
let matched = 0;
const reachableBfs = new Set();
for (const [plz, candidates] of [...localities].sort()) {
  // First preference-ordered municipality that actually has an ElCom tariff —
  // covers PLZ whose dominant municipality is missing from the cube.
  const loc = candidates.find((c) => tariffsByBfs.has(c.bfs));
  if (!loc) continue; // truly no tariff → app falls back gracefully
  matched++;
  reachableBfs.add(loc.bfs);
  const totals = tariffsByBfs.get(loc.bfs);
  // Median across operators serving that municipality. BFS number included
  // so the app can resolve Postfach-/Sonder-PLZ by municipality vote.
  plzMap[plz] = [
    loc.name,
    loc.canton,
    +median(totals).toFixed(2),
    loc.e,
    loc.n,
    +loc.bfs,
  ];
}

const chMedianRp = +median([...tariffsByBfs.values()].map(median)).toFixed(2);
console.log(
  `Municipalities reachable as dominant PLZ municipality: ${reachableBfs.size}/${tariffsByBfs.size}`,
);

const out = {
  meta: {
    period,
    category: "H4",
    product: "standard",
    unit: "Rp./kWh (exkl. MwSt.)",
    chMedianRp,
    municipalities: tariffsByBfs.size,
    plzCount: matched,
    sources: ["ElCom via lindas.admin.ch", "swisstopo AMTOVZ (PLZ-Verzeichnis)"],
    generated: new Date().toISOString().slice(0, 10),
  },
  plz: plzMap,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(
  `Wrote ${OUT}\n  ${matched} PLZ entries · CH median ${chMedianRp} Rp./kWh · period ${period}`,
);
