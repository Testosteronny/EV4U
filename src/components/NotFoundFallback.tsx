import InseratDetailPage from "./pages/InseratDetailPage";
import { href } from "../lib/url";

/* ============================================================================
   404 fallback — GitHub Pages serves this for paths that weren't
   prerendered. Listings created AFTER the last build still work: we parse
   the slug from the URL and render the detail island, which loads the
   listing live from Supabase. Everything else gets an honest not-found.
   ============================================================================ */

export default function NotFoundFallback() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname;
  const match = path.startsWith(base)
    ? /^\/inserat\/([^/]+)\/?$/.exec(path.slice(base.length))
    : null;

  if (match) {
    return <InseratDetailPage slug={decodeURIComponent(match[1])} />;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
      <div className="panel px-6 py-16 text-center">
        <p className="stretch-wide text-2xl font-extrabold uppercase text-ink">
          Seite nicht gefunden.
        </p>
        <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted">
          FALSCHE URL ODER ABGESCHALTETER STROMKREIS.
        </p>
        <a
          href={href("/")}
          className="mt-6 inline-block border border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink transition-colors hover:border-signal hover:text-signal"
        >
          ← Zur Startseite
        </a>
      </div>
    </section>
  );
}
