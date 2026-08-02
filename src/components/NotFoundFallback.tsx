import InseratDetailPage from "./pages/InseratDetailPage";
import { EmptyState, LinkButton } from "./ui";
import { href } from "../lib/url";

/* ============================================================================
   404-Fallback — GitHub Pages liefert diese Seite für alles, was nicht
   vorgerendert wurde. Inserate, die NACH dem letzten Build entstanden sind,
   funktionieren trotzdem: wir lesen den Slug aus der URL und rendern die
   Detail-Insel, die live aus Supabase lädt. Alles andere bekommt eine
   ehrliche Fehlseite.
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
    <div className="mx-auto max-w-[88rem] px-4 py-16 sm:px-6">
      <EmptyState
        title="Diese Seite gibt es nicht."
        hint="Die URL stimmt nicht, oder die Seite wurde verschoben."
      >
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
