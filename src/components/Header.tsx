import { useEffect, useState } from "react";
import { GitCompareArrows, Heart, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import SearchBox from "./SearchBox";
import { IconButton, LinkButton } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useFavorites } from "../hooks/useFavorites";
import { useUnread } from "../hooks/useUnread";
import { href } from "../lib/url";

/* ============================================================================
   Header — zwei Ziele statt fünf.

   Links die Marke, in der Mitte die Suche (das primäre Werkzeug eines
   Marktplatzes), rechts der persönliche Zustand: Merkliste, Vergleich,
   Konto. Rechenwerk und Vergleich sind keine Navigationsziele mehr —
   Rechenwerk sitzt an jedem Inserat und in der Kontextleiste, Vergleich
   erscheint erst, wenn etwas darin liegt.
   ============================================================================ */

/** Zähler an einem Icon — Merkliste, Vergleich, ungelesene Nachrichten. */
function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent tabular"
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    // Die theme-color-Angaben im <head> hängen an prefers-color-scheme und
    // wissen von einer ausdrücklichen Wahl nichts — die Browser-UI bliebe
    // sonst in der Systemfarbe stehen, während die Seite umschaltet.
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = next ? "#0E0F0E" : "#FBFBFA";
    document.head.appendChild(meta);
    try {
      localStorage.setItem("ev4u.theme", next ? "dark" : "light");
    } catch {
      /* privater Modus — die Wahl gilt nur für diese Sitzung */
    }
  };

  return (
    <IconButton
      onClick={toggle}
      aria-label={dark ? "Hellen Modus einschalten" : "Dunklen Modus einschalten"}
      title={dark ? "Heller Modus" : "Dunkler Modus"}
      className="border-transparent bg-transparent"
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </IconButton>
  );
}

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href={href("/")}
      onClick={onClick}
      className="flex shrink-0 items-center gap-2"
      aria-label="EV4U — Startseite"
    >
      <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-accent" aria-hidden>
        <span className="relative block h-3.5 w-3.5">
          <span className="absolute left-0 top-1.5 h-0.5 w-3.5 rounded-full bg-on-accent" />
          <span className="absolute left-1.5 top-0 h-3.5 w-0.5 rounded-full bg-on-accent" />
        </span>
      </span>
      <span className="text-h3 font-semibold tracking-tight text-fg">EV4U</span>
    </a>
  );
}

export default function Header() {
  const { compareIds } = useCockpit();
  const { favorites } = useFavorites();
  const unread = useUnread();
  const [menu, setMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [path, setPath] = useState("");
  // Zähler erst nach dem Mount — der prerenderte HTML kennt weder Konto
  // noch localStorage, sonst gäbe es einen Hydration-Mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setPath(window.location.pathname.replace(/\/+$/, ""));
    setMounted(true);
  }, []);

  const compare = mounted ? compareIds.length : 0;
  const favs = mounted ? favorites.length : 0;
  const at = (to: string) => path === href(to);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menu]);

  /** Icon-Ziel rechts im Header. */
  const iconLink = (
    to: string,
    label: string,
    icon: React.ReactNode,
    count = 0,
    countLabel?: string,
  ) => (
    <a
      href={href(to)}
      title={label}
      aria-current={at(to.split("?")[0]) ? "page" : undefined}
      className={`relative hidden h-9 w-9 place-items-center rounded-card transition-colors sm:grid ${
        at(to.split("?")[0])
          ? "bg-surface2 text-fg"
          : "text-fg2 hover:bg-surface2 hover:text-fg"
      }`}
    >
      {icon}
      <Count value={count} />
      <span className="sr-only">
        {label}
        {count > 0 && ` (${count}${countLabel ? ` ${countLabel}` : ""})`}
      </span>
    </a>
  );

  return (
    <>
      <div className="mx-auto flex h-14 max-w-352 items-center gap-3 px-4 sm:px-6">
        <Wordmark />

        <SearchBox className="mx-2 hidden flex-1 md:block md:max-w-md" />

        <nav className="ml-auto flex items-center gap-1" aria-label="Hauptnavigation">
          <a
            href={href("/inserate")}
            aria-current={at("/inserate") ? "page" : undefined}
            className={`hidden h-9 items-center rounded-card px-3 text-body font-medium transition-colors md:inline-flex ${
              at("/inserate")
                ? "bg-surface2 text-fg"
                : "text-fg2 hover:bg-surface2 hover:text-fg"
            }`}
          >
            Inserate
          </a>
          <a
            href={href("/verkaufen")}
            aria-current={at("/verkaufen") ? "page" : undefined}
            className={`hidden h-9 items-center rounded-card px-3 text-body font-medium transition-colors sm:inline-flex ${
              at("/verkaufen")
                ? "bg-surface2 text-fg"
                : "text-fg2 hover:bg-surface2 hover:text-fg"
            }`}
          >
            Verkaufen
          </a>

          {iconLink("/inserate?fav=1", "Merkliste", <Heart size={17} aria-hidden />, favs)}

          {/* Vergleich ist ein Zustand, kein Ziel — erscheint erst mit Inhalt */}
          {compare > 0 &&
            iconLink(
              "/vergleich",
              "Vergleich",
              <GitCompareArrows size={17} aria-hidden />,
              compare,
            )}

          {iconLink(
            "/konto",
            "Konto",
            <User size={17} aria-hidden />,
            unread,
            "ungelesen",
          )}

          <ThemeToggle />

          {/* Telefon: Suche und Menü */}
          <IconButton
            onClick={() => setMobileSearch((s) => !s)}
            aria-label="Suche öffnen"
            aria-expanded={mobileSearch}
            className="border-transparent bg-transparent md:hidden"
          >
            <Search size={17} aria-hidden />
          </IconButton>
          <IconButton
            onClick={() => setMenu(true)}
            aria-label={`Menü öffnen${favs + unread + compare > 0 ? ` (${favs + unread + compare} Hinweise)` : ""}`}
            aria-expanded={menu}
            className="relative border-transparent bg-transparent sm:hidden"
          >
            <Menu size={18} aria-hidden />
            <Count value={favs + unread + compare} />
          </IconButton>
        </nav>
      </div>

      {mobileSearch && (
        <div className="border-t border-line px-4 py-2.5 md:hidden">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}

      {menu && (
        <div className="fixed inset-0 z-90 flex flex-col bg-canvas sm:hidden">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <Wordmark onClick={() => setMenu(false)} />
            <IconButton onClick={() => setMenu(false)} aria-label="Menü schliessen">
              <X size={18} aria-hidden />
            </IconButton>
          </div>
          <nav className="flex flex-col gap-1 p-4" aria-label="Menü">
            {[
              { to: "/inserate", label: "Inserate", count: 0 },
              { to: "/verkaufen", label: "Verkaufen", count: 0 },
              { to: "/inserate?fav=1", label: "Merkliste", count: favs },
              ...(compare > 0
                ? [{ to: "/vergleich", label: "Vergleich", count: compare }]
                : []),
              { to: "/konto", label: "Konto", count: unread },
            ].map((l) => (
              <a
                key={l.label}
                href={href(l.to)}
                className="flex items-center justify-between rounded-card px-3 py-3 text-h3 font-medium text-fg transition-colors hover:bg-surface2"
              >
                {l.label}
                {l.count > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-small font-semibold text-on-accent tabular">
                    {l.count}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <div className="mt-auto border-t border-line p-4">
            <LinkButton href={href("/rechenwerk")} variant="secondary" className="w-full">
              Stromkosten-Rechner
            </LinkButton>
          </div>
        </div>
      )}
    </>
  );
}
