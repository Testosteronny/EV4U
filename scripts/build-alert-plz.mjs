// Writes supabase/functions/alerts/plz.json — PLZ → LV95 coordinates in
// hectometres, so the `alerts` Edge Function can apply the «Umkreis» filter
// of a saved search exactly like /inserate does. Run after fetch:tariffs,
// then redeploy `alerts`.
import { readFileSync, writeFileSync } from "node:fs";

const tariffs = JSON.parse(readFileSync(new URL("../src/data/tariffs.json", import.meta.url), "utf8"));
const out = {};
for (const [zip, entry] of Object.entries(tariffs.plz)) {
  const [, , , e, n] = entry;
  out[zip] = [Math.round(e / 100), Math.round(n / 100)];
}
const target = new URL("../supabase/functions/alerts/plz.json", import.meta.url);
writeFileSync(target, JSON.stringify(out));
console.log(`plz.json: ${Object.keys(out).length} PLZ`);
