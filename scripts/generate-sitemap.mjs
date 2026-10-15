/* ============================================================================
   generate-sitemap.mjs — writes public/sitemap.xml: the indexable pages,
   blog posts and guides (from src/content), model and brand pages (from the
   vehicle catalog), garage pages and every live listing (from Supabase).
   Runs in CI before `astro build` (deploy.yml) and locally via
   `npm run sitemap`. Credentials come from process.env first (CI) and fall
   back to .env (local). Node 18+, zero dependencies.

   Left out on purpose: noindex pages (Konto, Login, Merkliste, Vergleich,
   the sell wizard) and demo listings.
   ============================================================================ */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Full public origin incl. base path, no trailing slash — set SITE_URL in CI
// (currently the GitHub Pages URL, later https://ev4u.ch).
const SITE = (process.env.SITE_URL ?? "https://ev4u.ch").replace(/\/$/, "");

// Minimal .env reader (no dotenv dependency); CI has no .env file.
const dotenv = existsSync(resolve(ROOT, ".env"))
  ? Object.fromEntries(
      readFileSync(resolve(ROOT, ".env"), "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const env = (key) => process.env[key] ?? dotenv[key];

async function rest(path) {
  const res = await fetch(`${env("PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    headers: { apikey: env("PUBLIC_SUPABASE_PUBLISHABLE_KEY") },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]} fetch failed: ${res.status}`);
  return res.json();
}

const [listings, brands, garages] = await Promise.all([
  rest("listings?select=slug,updated_at&status=in.(AKTIV,RESERVIERT)&is_demo=is.false&hidden_at=is.null"),
  rest("vehicle_brands?select=slug,models:vehicle_models(slug)"),
  rest("profiles?select=slug&type=eq.GARAGE&slug=not.is.null"),
]);

/** Frontmatter fields of the MDX files in one content collection. */
function collection(name) {
  const dir = resolve(ROOT, "src/content", name);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => {
      const head = readFileSync(resolve(dir, f), "utf8").split(/^---\s*$/m)[1] ?? "";
      const field = (k) => new RegExp(`^${k}:\\s*["']?([^"'\\n]+)`, "m").exec(head)?.[1]?.trim();
      return { id: f.replace(/\.mdx?$/, ""), date: field("updated") ?? field("date"), category: field("category") };
    });
}

const today = new Date().toISOString().slice(0, 10);
const page = (path, lastmod = today) => ({ loc: `${SITE}/${path ? `${path}/` : ""}`, lastmod });

const STATIC = [
  "", "inserate", "finder", "kosten", "modelle", "blog", "ratgeber", "ratgeber/ladekarten", "beratung",
  "verkaufen", "verkaufen/preis-check", "garagen", "monatsbrief", "hilfe", "sicherheit", "ueber-uns",
  "kontakt", "impressum", "datenschutz", "agb",
];

const posts = collection("blog");
const guides = collection("ratgeber");
const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];

const urls = [
  ...STATIC.map((p) => page(p)),
  ...posts.map((p) => page(`blog/${p.id}`, p.date)),
  ...categories.map((c) => page(`blog/kategorie/${c}`)),
  ...guides.map((g) => page(`ratgeber/${g.id}`, g.date)),
  ...brands.flatMap((b) => [
    page(`modelle/${b.slug}`),
    ...b.models.map((m) => page(`modelle/${b.slug}/${m.slug.slice(m.slug.indexOf("_") + 1)}`)),
  ]),
  ...garages.map((g) => page(`garagen/${g.slug}`)),
  ...listings.map((l) => page(`inserat/${l.slug}`, l.updated_at.slice(0, 10))),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;

writeFileSync(resolve(ROOT, "public/sitemap.xml"), xml);
console.log(
  `Wrote public/sitemap.xml — ${urls.length} URLs (${listings.length} listings, ${posts.length} posts, ${guides.length} guides, ${garages.length} garages)`,
);
