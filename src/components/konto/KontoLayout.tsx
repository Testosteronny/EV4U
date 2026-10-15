import { useEffect, type ReactNode } from "react";
import {
  Building2,
  Car,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldAlert,
  BellRing,
} from "lucide-react";
import { Notice, PageHeader } from "../ui";
import { useProfile, type Profile } from "../../hooks/useProfile";
import { useSession } from "../../hooks/useSession";
import { useUnread } from "../../hooks/useUnread";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";

/* ============================================================================
   The account shell (Konzept §4.11) — every /konto/* page and /admin.

   One static page per section; this island is the gate: no backend → a
   notice, no session → off to /login with `next`, otherwise the section
   navigation (sidebar on desktop, a scrollable row on the phone) and the
   page itself, handed the user, the public profile and the admin flag.
   ============================================================================ */

export type KontoSection =
  | "uebersicht"
  | "inserate"
  | "nachrichten"
  | "suchabos"
  | "merkliste"
  | "einstellungen"
  | "garage"
  | "admin";

export type KontoCtx = {
  userId: string;
  email: string;
  profile: Profile | null;
  isAdmin: boolean;
  reloadProfile: () => Promise<void>;
  updateProfile: ReturnType<typeof useProfile>["update"];
};

export default function KontoLayout({
  active,
  title,
  lead,
  children,
}: {
  active: KontoSection;
  title: string;
  lead?: ReactNode;
  children: (ctx: KontoCtx) => ReactNode;
}) {
  const { session, ready } = useSession();
  const { profile, isAdmin, loaded, update, reload } = useProfile(session?.user.id);
  const unread = useUnread();

  useEffect(() => {
    if (ready && supabase && !session) {
      const next = location.pathname + location.search;
      window.location.replace(`${href("/login")}?next=${encodeURIComponent(next)}`);
    }
  }, [ready, session]);

  const crumbs = [
    { label: "Start", href: href("/") },
    ...(active === "uebersicht" ? [{ label: "Konto" }] : [{ label: "Konto", href: href("/konto") }, { label: title }]),
  ];

  if (!supabase) {
    return (
      <Shell>
        <PageHeader crumbs={crumbs} title={title} />
        <Notice className="mt-6">Das Konto braucht das Backend — es ist in dieser Umgebung nicht konfiguriert.</Notice>
      </Shell>
    );
  }

  if (!ready || !session || !loaded) {
    return (
      <Shell>
        <PageHeader crumbs={crumbs} title={title} />
        <div className="mt-8 grid gap-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-card bg-surface2" />
          <div className="h-24 animate-pulse rounded-card bg-surface2" />
        </div>
      </Shell>
    );
  }

  const garage = profile?.type === "GARAGE";
  const NAV: { key: KontoSection; label: string; href: string; icon: ReactNode; count?: number; show?: boolean }[] = [
    { key: "uebersicht", label: "Übersicht", href: "/konto", icon: <LayoutDashboard size={17} /> },
    { key: "inserate", label: "Meine Inserate", href: "/konto/inserate", icon: <Car size={17} /> },
    { key: "nachrichten", label: "Nachrichten", href: "/konto/nachrichten", icon: <MessageSquare size={17} />, count: unread },
    { key: "suchabos", label: "Suchabos", href: "/konto/suchabos", icon: <BellRing size={17} /> },
    { key: "merkliste", label: "Merkliste", href: "/merkliste", icon: <Heart size={17} /> },
    { key: "garage", label: "Garage", href: "/konto/garage", icon: <Building2 size={17} />, show: garage },
    { key: "einstellungen", label: "Einstellungen", href: "/konto/einstellungen", icon: <Settings size={17} /> },
    { key: "admin", label: "Moderation", href: "/admin", icon: <ShieldAlert size={17} />, show: isAdmin },
  ];
  const items = NAV.filter((n) => n.show !== false);

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Konto" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {items.map((n) => (
              <li key={n.key} className="shrink-0">
                <a
                  href={href(n.href)}
                  aria-current={n.key === active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-control px-3 py-2 text-body font-medium transition-colors ${
                    n.key === active ? "bg-soft text-accent" : "text-fg2 hover:bg-surface2 hover:text-fg"
                  }`}
                >
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                  {!!n.count && (
                    <span className="ml-auto rounded-full bg-accent px-1.5 text-micro font-bold text-on-accent tabular">
                      {n.count}
                    </span>
                  )}
                </a>
              </li>
            ))}
            <li className="shrink-0 lg:mt-3 lg:border-t lg:border-line lg:pt-3">
              <button
                type="button"
                onClick={() => void supabase?.auth.signOut().then(() => window.location.assign(href("/")))}
                className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-body font-medium text-fg2 hover:bg-surface2 hover:text-fg"
              >
                <LogOut size={17} aria-hidden /> Abmelden
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <PageHeader crumbs={crumbs} title={title} lead={lead} />
          <div className="mt-6">
            {children({
              userId: session.user.id,
              email: session.user.email ?? "",
              profile,
              isAdmin,
              reloadProfile: reload,
              updateProfile: update,
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-page animate-fade-in px-4 pb-24 pt-8 sm:px-6 md:pb-10">{children}</div>;
}
