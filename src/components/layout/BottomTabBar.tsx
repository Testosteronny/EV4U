import { useEffect, useState } from "react";
import { Heart, MessageCircle, PlusCircle, Search, User } from "lucide-react";
import { Count } from "./Header";
import { useMerkliste } from "../../hooks/useMerkliste";
import { useUnread } from "../../hooks/useUnread";
import { href } from "../../lib/url";

/* ============================================================================
   Mobile tab bar — the standard pattern of classifieds apps (Konzept §3.1):
   Suchen · Merkliste · Inserieren · Nachrichten · Konto. Hidden from md up,
   where the header carries the same destinations.
   ============================================================================ */

const TABS = [
  { to: "/inserate", label: "Suchen", icon: Search, match: ["/inserate", "/inserat", "/finder", "/vergleich"] },
  { to: "/merkliste", label: "Merkliste", icon: Heart, match: ["/merkliste"] },
  { to: "/verkaufen/neu", label: "Inserieren", icon: PlusCircle, match: ["/verkaufen"] },
  { to: "/konto/nachrichten", label: "Nachrichten", icon: MessageCircle, match: ["/konto/nachrichten"] },
  { to: "/konto", label: "Konto", icon: User, match: ["/konto", "/login"] },
] as const;

export default function BottomTabBar() {
  const { items } = useMerkliste();
  const unread = useUnread();
  const [path, setPath] = useState("");
  useEffect(() => setPath(window.location.pathname.replace(/\/+$/, "")), []);

  // The most specific match wins: /konto/nachrichten is «Nachrichten», not «Konto».
  const activeTo = TABS.flatMap((t) => t.match.map((m) => ({ to: t.to, m: href(m) })))
    .filter(({ m }) => path === m || path.startsWith(`${m}/`))
    .sort((a, b) => b.m.length - a.m.length)[0]?.to;

  return (
    <nav
      aria-label="Schnellnavigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = activeTo === t.to;
          const count = t.to === "/merkliste" ? items.length : t.to === "/konto/nachrichten" ? unread : 0;
          return (
            <li key={t.to}>
              <a
                href={href(t.to)}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-micro font-semibold ${
                  active ? "text-accent" : "text-fg2"
                }`}
              >
                <span className="relative">
                  <t.icon size={t.to === "/verkaufen/neu" ? 24 : 21} aria-hidden strokeWidth={active ? 2.4 : 2} />
                  <Count value={count} />
                </span>
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
