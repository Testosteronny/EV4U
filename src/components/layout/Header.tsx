import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Calculator,
  ChevronDown,
  CreditCard,
  Gauge,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  PhoneCall,
  Plus,
  Search,
  Settings,
  Shield,
  Store,
  Sun,
  Tag,
  User,
  X,
} from "lucide-react";
import SearchBox from "../search/SearchBox";
import { Avatar, Dropdown, IconButton, LinkButton, MenuItem, Portal } from "../ui";
import { FahrprofilChip, FahrprofilSheetHost } from "./Fahrprofil";
import { useTheme } from "./ThemeToggle";
import { useListings } from "../../hooks/useListings";
import { useMerkliste } from "../../hooks/useMerkliste";
import { useProfile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import { useUnread } from "../../hooks/useUnread";
import { BODY_ENTRIES, BUDGET_ENTRIES, TOPIC_ENTRIES, entryCount, searchHref, type Entry } from "../../lib/entries";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { ensureListings } from "../../stores/listings";

/* ============================================================================
   Header — one row, 64 px, no second bar (Konzept v3 §3.1).

   Kaufen ▾ · Verkaufen ▾ · Modelle · Wissen ▾ · search · Fahrprofil chip ·
   ♡ Merkliste · ✉ Nachrichten · account · «+ Inserieren», the one green
   button in the header and the clearest sign that this is a marketplace.
   On the phone: logo, search, Fahrprofil, menu — the tab bar at the bottom
   carries the rest (BottomTabBar).
   ============================================================================ */

export type HeaderPost = { title: string; href: string; category: string };

type MenuKey = "kaufen" | "verkaufen" | "wissen";

/** Counter on an icon — Merkliste, unread messages. */
export function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-on-accent tabular"
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function Wordmark({ onClick, inverted = false }: { onClick?: () => void; inverted?: boolean }) {
  return (
    <a href={href("/")} onClick={onClick} className="flex shrink-0 items-center gap-2" aria-label="EV4U — Startseite">
      <span className={`grid h-8 w-8 place-items-center rounded-[9px] ${inverted ? "bg-volt" : "bg-accent"}`} aria-hidden>
        <span className="relative block h-3.5 w-3.5">
          <span className={`absolute left-0 top-1.5 h-0.5 w-3.5 rounded-full ${inverted ? "bg-forest" : "bg-on-accent"}`} />
          <span className={`absolute left-1.5 top-0 h-3.5 w-0.5 rounded-full ${inverted ? "bg-forest" : "bg-on-accent"}`} />
        </span>
      </span>
      <span className={`text-h3 font-bold tracking-tight ${inverted ? "text-on-forest" : "text-fg"}`}>EV4U</span>
    </a>
  );
}

const SELL_LINKS = [
  { to: "/verkaufen/neu", label: "Inserat aufgeben", hint: "Gratis für Private, in 7 Schritten", icon: Plus },
  { to: "/verkaufen/preis-check", label: "Gratis Preis-Check", hint: "Was ist dein E-Auto wert?", icon: Tag },
  { to: "/verkaufen", label: "So funktioniert's", hint: "Ablauf, Preise, Tipps", icon: BookOpen },
  { to: "/garagen", label: "Für Garagen", hint: "Profil, Bestand, Anfragen", icon: Store },
  { to: "/konto/inserate", label: "Meine Inserate", hint: "Bearbeiten, Status, Statistik", icon: LayoutDashboard },
];

const KNOW_LINKS = [
  { to: "/blog", label: "Blog", hint: "Marktbericht, neue Modelle, Laden", icon: Newspaper },
  { to: "/ratgeber", label: "Ratgeber", hint: "Occasion prüfen, SOH, Laden im Mietshaus", icon: BookOpen },
  { to: "/kosten", label: "Kostenrechner", hint: "Was kostet mich ein E-Auto?", icon: Calculator },
  { to: "/ratgeber/ladekarten", label: "Ladekarten", hint: "Welche Karte passt zu dir?", icon: CreditCard },
  { to: "/beratung", label: "Beratung", hint: "20 Minuten mit Gabriel", icon: PhoneCall },
];

function EntryColumn({
  title,
  entries,
  counts,
  onNavigate,
}: {
  title: string;
  entries: Entry[];
  counts: Map<string, number> | null;
  onNavigate: () => void;
}) {
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ul className="space-y-0.5">
        {entries.map((e) => (
          <li key={e.label}>
            <a
              href={searchHref(e.filter)}
              onClick={onNavigate}
              className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-body text-fg transition-colors hover:bg-faint hover:text-accent"
            >
              {e.label}
              {counts && <span className="text-small text-fg3 tabular">{counts.get(e.label) ?? 0}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkList({
  links,
  onNavigate,
}: {
  links: { to: string; label: string; hint: string; icon: typeof Plus }[];
  onNavigate: () => void;
}) {
  return (
    <ul className="grid gap-1">
      {links.map((l) => (
        <li key={l.to}>
          <a
            href={href(l.to)}
            onClick={onNavigate}
            className="flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-faint"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-faint text-accent">
              <l.icon size={16} aria-hidden />
            </span>
            <span>
              <span className="block text-body font-semibold text-fg">{l.label}</span>
              <span className="block text-small text-fg2">{l.hint}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function MegaPanel({
  menu,
  posts,
  onClose,
}: {
  menu: MenuKey;
  posts: HeaderPost[];
  onClose: () => void;
}) {
  const { listings, live } = useListings();
  useEffect(() => ensureListings(), []);
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  // Counts only from the live inventory — the bundled seed would show
  // numbers that don't match the result page one click later.
  const counts = useMemo(() => {
    if (!live) return null;
    const m = new Map<string, number>();
    for (const e of [...BODY_ENTRIES, ...BUDGET_ENTRIES, ...TOPIC_ENTRIES]) m.set(e.label, entryCount(forSale, e.filter));
    return m;
  }, [forSale, live]);

  return (
    <div className="absolute inset-x-0 top-full z-50 border-b border-line bg-surface shadow-overlay">
      <div className="mx-auto max-w-page px-6 py-7">
        {menu === "kaufen" && (
          <div className="grid grid-cols-[1.1fr_1fr_1fr_1.3fr] gap-8">
            <div>
              <div className="eyebrow mb-2">Inserate</div>
              <ul className="space-y-0.5">
                {[
                  { to: "/inserate", label: "Alle Inserate", meta: live ? forSale.length : undefined },
                  { to: "/finder", label: "E-Auto-Finder" },
                  { to: "/merkliste", label: "Merkliste" },
                  { to: "/vergleich", label: "Vergleich" },
                  { to: "/modelle", label: "Modelle von A–Z" },
                ].map((l) => (
                  <li key={l.to}>
                    <a
                      href={href(l.to)}
                      onClick={onClose}
                      className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-body font-semibold text-fg transition-colors hover:bg-faint hover:text-accent"
                    >
                      {l.label}
                      {l.meta !== undefined && <span className="text-small font-normal text-fg3 tabular">{l.meta}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <EntryColumn title="Karosserie" entries={BODY_ENTRIES} counts={counts} onNavigate={onClose} />
            <EntryColumn title="Budget" entries={BUDGET_ENTRIES} counts={counts} onNavigate={onClose} />
            <EntryColumn title="Themen" entries={TOPIC_ENTRIES} counts={counts} onNavigate={onClose} />
          </div>
        )}
        {menu === "verkaufen" && (
          <div className="grid grid-cols-[1fr_1fr] gap-8">
            <LinkList links={SELL_LINKS} onNavigate={onClose} />
            <div className="forest flex flex-col justify-between rounded-card p-6">
              <div>
                <div className="text-h2 font-bold">Verkauf dein E-Auto an Leute, die E-Autos suchen.</div>
                <p className="mt-2 text-body text-on-forest2">
                  Gratis für Private. Batteriegarantie, Ladeleistung und Ausstattung stehen dort, wo Käufer sie
                  suchen.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href={href("/verkaufen/neu")} variant="onForest" onClick={onClose}>
                  Inserat aufgeben
                </LinkButton>
                <a href={href("/verkaufen/preis-check")} onClick={onClose} className="inline-flex h-11 items-center px-3 text-body font-semibold text-on-forest hover:underline">
                  Erst den Preis checken →
                </a>
              </div>
            </div>
          </div>
        )}
        {menu === "wissen" && (
          <div className="grid grid-cols-[1fr_1fr] gap-8">
            <LinkList links={KNOW_LINKS} onNavigate={onClose} />
            <div>
              <div className="eyebrow mb-2">Neu im Blog</div>
              <ul className="space-y-1">
                {posts.map((p) => (
                  <li key={p.href}>
                    <a href={p.href} onClick={onClose} className="block rounded-control px-3 py-2.5 transition-colors hover:bg-faint">
                      <span className="block text-small font-semibold text-accent">{p.category}</span>
                      <span className="block text-body font-semibold text-fg">{p.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <a href={href("/blog")} onClick={onClose} className="link mt-2 inline-block px-3 text-body font-semibold">
                Alle Beiträge →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { session, ready } = useSession();
  const { profile, isAdmin } = useProfile(session?.user.id);
  const [dark, toggleTheme] = useTheme();
  const [next, setNext] = useState("");
  useEffect(() => setNext(window.location.pathname + window.location.search), []);

  if (!ready || !session) {
    return (
      <a
        href={`${href("/login")}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-body font-semibold text-fg2 transition-colors hover:bg-surface2 hover:text-fg"
      >
        <User size={17} aria-hidden />
        Anmelden
      </a>
    );
  }

  const name = profile?.name || session.user.email || "Konto";
  return (
    <Dropdown
      label="Konto"
      align="right"
      width={260}
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label="Konto-Menü"
          className="grid h-9 w-9 place-items-center rounded-full transition-shadow hover:ring-2 hover:ring-line2"
        >
          <Avatar name={name} size={34} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="truncate text-body font-semibold text-fg">{name}</div>
            <div className="truncate text-small text-fg3">{session.user.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem href={href("/konto")} icon={<LayoutDashboard size={16} />}>Übersicht</MenuItem>
          <MenuItem href={href("/konto/inserate")} icon={<Gauge size={16} />}>Meine Inserate</MenuItem>
          <MenuItem href={href("/konto/nachrichten")} icon={<MessageCircle size={16} />}>Nachrichten</MenuItem>
          <MenuItem href={href("/konto/suchabos")} icon={<Mail size={16} />}>Suchabos</MenuItem>
          {profile?.type === "GARAGE" && (
            <MenuItem href={href("/konto/garage")} icon={<Store size={16} />}>Garage</MenuItem>
          )}
          <MenuItem href={href("/konto/einstellungen")} icon={<Settings size={16} />}>Einstellungen</MenuItem>
          {isAdmin && (
            <MenuItem href={href("/admin")} icon={<Shield size={16} />}>Moderation</MenuItem>
          )}
          <div className="my-1 h-px bg-line" />
          <MenuItem onClick={toggleTheme} icon={dark ? <Sun size={16} /> : <Moon size={16} />}>
            {dark ? "Heller Modus" : "Dunkler Modus"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              close();
              void supabase?.auth.signOut().then(() => (window.location.href = href("/")));
            }}
            icon={<LogOut size={16} />}
          >
            Abmelden
          </MenuItem>
        </div>
      )}
    </Dropdown>
  );
}

function MobileMenu({ onClose, posts }: { onClose: () => void; posts: HeaderPost[] }) {
  const [dark, toggleTheme] = useTheme();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const section = (title: string, links: { to: string; label: string }[]) => (
    <div>
      <div className="eyebrow mb-1.5 px-3">{title}</div>
      {links.map((l) => (
        <a key={l.to + l.label} href={l.to.startsWith("/") ? href(l.to) : l.to} className="block rounded-control px-3 py-2.5 text-h3 font-semibold text-fg hover:bg-surface2">
          {l.label}
        </a>
      ))}
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-90 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Menü">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
          <Wordmark onClick={onClose} />
          <IconButton onClick={onClose} aria-label="Menü schliessen">
            <X size={18} aria-hidden />
          </IconButton>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto p-4 pb-24" aria-label="Menü">
          {section("Kaufen", [
            { to: "/inserate", label: "Alle Inserate" },
            { to: "/finder", label: "E-Auto-Finder" },
            { to: "/vergleich", label: "Vergleich" },
            { to: "/modelle", label: "Modelle von A–Z" },
          ])}
          {section("Verkaufen", SELL_LINKS.map((l) => ({ to: l.to, label: l.label })))}
          {section("Wissen", [
            ...KNOW_LINKS.map((l) => ({ to: l.to, label: l.label })),
            ...posts.slice(0, 1).map((p) => ({ to: p.href, label: `Neu: ${p.title}` })),
          ])}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-body font-semibold text-fg2 hover:bg-surface2"
          >
            {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
            {dark ? "Heller Modus" : "Dunkler Modus"}
          </button>
        </nav>
      </div>
    </Portal>
  );
}

export default function Header({ posts = [] }: { posts?: HeaderPost[] }) {
  const { items } = useMerkliste();
  const unread = useUnread();
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [path, setPath] = useState("");
  const bar = useRef<HTMLElement>(null);

  useEffect(() => setPath(window.location.pathname.replace(/\/+$/, "")), []);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!bar.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const at = (to: string) => path === href(to) || path.startsWith(`${href(to)}/`);
  const navBtn = (key: MenuKey, label: string, active: boolean) => (
    <button
      type="button"
      onClick={() => setMenu((m) => (m === key ? null : key))}
      aria-expanded={menu === key}
      className={`inline-flex h-9 items-center gap-1 rounded-control px-3 text-body font-semibold transition-colors ${
        menu === key || active ? "bg-faint text-accent" : "text-fg hover:bg-surface2"
      }`}
    >
      {label}
      <ChevronDown size={15} aria-hidden className={`transition-transform ${menu === key ? "rotate-180" : ""}`} />
    </button>
  );

  const iconLink = (to: string, label: string, icon: React.ReactNode, count: number, countLabel: string) => (
    <a
      href={href(to)}
      title={label}
      aria-current={at(to) ? "page" : undefined}
      className={`relative hidden h-9 w-9 place-items-center rounded-control transition-colors md:grid ${
        at(to) ? "bg-faint text-accent" : "text-fg2 hover:bg-surface2 hover:text-fg"
      }`}
    >
      {icon}
      <Count value={count} />
      <span className="sr-only">
        {label}
        {count > 0 && ` (${count} ${countLabel})`}
      </span>
    </a>
  );

  return (
    <header ref={bar} className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-page items-center gap-2 px-4 sm:px-6">
        <Wordmark />

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Hauptnavigation">
          {navBtn("kaufen", "Kaufen", at("/inserate") || at("/finder") || at("/vergleich"))}
          {navBtn("verkaufen", "Verkaufen", at("/verkaufen") || at("/garagen"))}
          <a
            href={href("/modelle")}
            aria-current={at("/modelle") ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-control px-3 text-body font-semibold transition-colors ${
              at("/modelle") ? "bg-faint text-accent" : "text-fg hover:bg-surface2"
            }`}
          >
            Modelle
          </a>
          {navBtn("wissen", "Wissen", at("/blog") || at("/ratgeber") || at("/kosten") || at("/beratung"))}
        </nav>

        <SearchBox className="mx-2 hidden min-w-0 flex-1 md:block lg:max-w-sm" />

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden sm:inline-flex">
            <FahrprofilChip />
          </span>
          <span className="sm:hidden">
            <FahrprofilChip compact />
          </span>
          {iconLink("/merkliste", "Merkliste", <Heart size={18} aria-hidden />, items.length, "gemerkt")}
          {iconLink("/konto/nachrichten", "Nachrichten", <MessageCircle size={18} aria-hidden />, unread, "ungelesen")}
          <span className="hidden md:block">
            <AccountMenu />
          </span>
          <LinkButton href={href("/verkaufen/neu")} variant="primary" size="sm" className="ml-1 hidden md:inline-flex">
            <Plus size={16} aria-hidden /> Inserieren
          </LinkButton>

          <IconButton
            onClick={() => setMobileSearch((s) => !s)}
            aria-label="Suche öffnen"
            aria-expanded={mobileSearch}
            className="border-transparent bg-transparent md:hidden"
          >
            <Search size={18} aria-hidden />
          </IconButton>
          <IconButton
            onClick={() => setMobileMenu(true)}
            aria-label="Menü öffnen"
            aria-expanded={mobileMenu}
            className="border-transparent bg-transparent lg:hidden"
          >
            <Menu size={19} aria-hidden />
          </IconButton>
        </div>
      </div>

      {mobileSearch && (
        <div className="border-t border-line px-4 py-2.5 md:hidden">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}

      {menu && <MegaPanel menu={menu} posts={posts} onClose={() => setMenu(null)} />}
      {mobileMenu && <MobileMenu posts={posts} onClose={() => setMobileMenu(false)} />}
      <FahrprofilSheetHost />
    </header>
  );
}
