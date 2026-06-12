/* ============================================================================
   generate-sitemap.mjs — writes public/sitemap.xml from the live listings.
   Run before deploying (`npm run sitemap`); uses the public REST API with
   the publishable key from .env. Node 18+, zero dependencies.
   ============================================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.SITE_URL ?? "https://ev4u.ch";

// Minimal .env reader (no dotenv dependency).
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const res = await fetch(
  `${env.VITE_SUPABASE_URL}/rest/v1/listings?select=slug,updated_at&status=in.(AKTIV,RESERVIERT)`,
  { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY } },
);
if (!res.ok) throw new Error(`listings fetch failed: ${res.status}`);
const listings = await res.json();

const staticRoutes = ["", "inserate", "rechenwerk", "verkaufen"];
const today = new Date().toISOString().slice(0, 10);

const urls = [
  ...staticRoutes.map((r) => ({ loc: `${SITE}/${r}`, lastmod: today })),
  ...listings.map((l) => ({
    loc: `${SITE}/inserat/${l.slug}`,
    lastmod: l.updated_at.slice(0, 10),
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;

writeFileSync(resolve(ROOT, "public/sitemap.xml"), xml);
console.log(`Wrote public/sitemap.xml — ${urls.length} URLs (${listings.length} listings)`);
