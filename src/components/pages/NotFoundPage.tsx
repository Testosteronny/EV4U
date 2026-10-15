import ListingPage from "./ListingPage";
import GarageProfile from "../garage/GarageProfile";
import { EmptyState, LinkButton } from "../ui";
import { href } from "../../lib/url";

/* ============================================================================
   404 fallback — GitHub Pages serves 404.html for everything that was not
   prerendered. Listings and garage pages newer than the last build (and
   sold listings) still work: the slug is read from the URL and the island
   loads live. Anything else gets an honest error page.
   ============================================================================ */

export default function NotFoundPage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname;
  const rest = path.startsWith(base) ? path.slice(base.length) : path;

  const listing = /^\/inserat\/([^/]+)\/?$/.exec(rest);
  if (listing) return <ListingPage slug={decodeURIComponent(listing[1])} />;

  const garage = /^\/garagen\/([a-z0-9-]+)\/?$/.exec(rest);
  if (garage) return <GarageProfile slug={garage[1]} />;

  return (
    <div className="mx-auto max-w-page px-4 py-16 sm:px-6">
      <EmptyState title="Diese Seite gibt es nicht." hint="Die Adresse stimmt nicht, oder die Seite wurde verschoben.">
        <LinkButton href={href("/")} variant="primary" size="sm">
          Zur Startseite
        </LinkButton>
        <LinkButton href={href("/inserate")} variant="secondary" size="sm">
          Zu den Inseraten
        </LinkButton>
      </EmptyState>
    </div>
  );
}
