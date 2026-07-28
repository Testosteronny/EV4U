/* ============================================================================
   submit-indexnow.mjs — pushes every sitemap URL to IndexNow after a deploy.
   IndexNow feeds Bing (which powers ChatGPT search) and other engines, so
   new listings surface in LLM answers within hours instead of weeks.
   Runs in CI after `deploy-pages` (deploy.yml); the key file lives at
   public/<KEY>.txt so the engines can verify ownership. Node 18+.
   ============================================================================ */

// Not a secret — IndexNow keys only prove the submitter controls the host.
const KEY = "ba0ad174268af2859f979a893e6f314f";
const SITE = (process.env.SITE_URL ?? "https://ev4u.ch").replace(/\/$/, "");

// Read the just-deployed sitemap — its <loc> entries are the URL list.
const res = await fetch(`${SITE}/sitemap.xml`);
if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
const xml = await res.text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) throw new Error("sitemap contained no URLs");

const submit = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList,
  }),
});
// 200/202 = accepted; anything else is worth seeing in the CI log.
console.log(`IndexNow: ${submit.status} ${submit.statusText} — ${urlList.length} URLs submitted`);
if (!submit.ok && submit.status !== 202) process.exit(1);
