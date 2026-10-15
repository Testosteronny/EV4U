/* ============================================================================
   xlsx.mjs — just enough of an XLSX reader for curated data workbooks.

   An .xlsx file is a ZIP of XML parts. This reads the central directory,
   inflates the parts it needs and turns a worksheet into rows of cell
   values: strings (shared, inline or formula results), numbers and
   booleans. No styles, no dates, no formulas — the workbooks EV4U imports
   are plain tables, and anything fancier should fail loudly upstream rather
   than be half-understood here.

   Node 18+, zero dependencies.
   ============================================================================ */

import zlib from "node:zlib";

/** All entries of a ZIP archive: name → raw bytes (inflated on demand). */
function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("XLSX: not a ZIP archive (end of central directory missing)");

  const entries = new Map();
  let off = buf.readUInt32LE(eocd + 16);
  while (buf.readUInt32LE(off) === 0x02014b50) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    entries.set(name, () => {
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`XLSX: unsupported compression method ${method} for ${name}`);
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML text → string: entities and numeric character references. */
export function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(cp);
    }
    return ENTITIES[e] ?? m;
  });
}

/** The concatenated text of all <t> runs (rich text splits a string). */
const textRuns = (xml) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)]
    .map((m) => decodeXml(m[1] ?? ""))
    .join("");

/** "AB" → 27 (0-based column index). */
function columnIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const attr = (attrs, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

/**
 * Open a workbook.
 * @param {Buffer} buf  the .xlsx file
 * @returns {{ sheetNames: string[], rows: (name: string) => { row: number, cells: unknown[] }[] }}
 */
export function readWorkbook(buf) {
  const entries = zipEntries(buf);
  const part = (path) => {
    const get = entries.get(path);
    if (!get) throw new Error(`XLSX: part ${path} missing`);
    return get().toString("utf8");
  };

  const shared = entries.has("xl/sharedStrings.xml")
    ? [...part("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]))
    : [];

  const rels = new Map(
    [...part("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [
      attr(m[1], "Id"),
      attr(m[1], "Target"),
    ]),
  );
  const sheets = new Map(
    [...part("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
      const target = rels.get(attr(m[1], "r:id"));
      if (!target) throw new Error(`XLSX: no relationship for sheet ${attr(m[1], "name")}`);
      // Targets are relative to xl/ ("worksheets/sheet1.xml") or absolute ("/xl/…").
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      return [decodeXml(attr(m[1], "name") ?? ""), path];
    }),
  );

  function rows(name) {
    const path = sheets.get(name);
    if (!path) throw new Error(`XLSX: sheet «${name}» not found (have: ${[...sheets.keys()].join(", ")})`);
    const out = [];
    for (const r of part(path).matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells = [];
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], "r");
        const col = ref ? columnIndex(/^[A-Z]+/.exec(ref)[0]) : cells.length;
        const type = attr(c[1], "t") ?? "n";
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = null;
        if (type === "inlineStr") value = textRuns(body);
        else if (v === undefined) value = null;
        else if (type === "s") value = shared[Number(v)];
        else if (type === "str") value = decodeXml(v);
        else if (type === "b") value = v === "1";
        else if (type === "e") throw new Error(`XLSX: error value ${v} in ${name}!${ref}`);
        else value = Number(v);
        cells[col] = value;
      }
      out.push({ row: Number(attr(r[1], "r") ?? out.length + 1), cells: Array.from(cells, (x) => x ?? null) });
    }
    return out;
  }

  return { sheetNames: [...sheets.keys()], rows };
}
