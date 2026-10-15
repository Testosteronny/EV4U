import { useEffect, useMemo, useState } from "react";
import { BellRing, Car, Eye, Heart, MessageSquare, Plus, Tag } from "lucide-react";
import KontoLayout, { type KontoCtx } from "./KontoLayout";
import { fetchEventTotals, fetchMyListings, sumEvents, type EventTotals, type MyListing } from "./data";
import { FahrprofilLink } from "../layout/Fahrprofil";
import { LinkButton, Notice, QualityMeter, SectionHeader, StatCard } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useMerkliste } from "../../hooks/useMerkliste";
import { useUnread } from "../../hooks/useUnread";
import { listingQuality } from "../../lib/quality";
import { supabase } from "../../lib/supabase";
import { href } from "../../lib/url";
import { STATUS_LABEL, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /konto — the account at a glance (Konzept §4.11): what is online, what
   is waiting for an answer, and the one thing that would help most next —
   finishing the draft with the most to gain, or answering a message.
   ============================================================================ */

export default function KontoUebersichtPage() {
  return (
    <KontoLayout active="uebersicht" title="Dein Konto">
      {(ctx) => <Dashboard {...ctx} />}
    </KontoLayout>
  );
}

function Dashboard({ userId, email, profile }: KontoCtx) {
  const unread = useUnread();
  const { items: saved } = useMerkliste();
  const { gemeinde, annualKm, hydrated } = useCockpit();
  const [mine, setMine] = useState<MyListing[] | null>(null);
  const [events, setEvents] = useState<EventTotals | null>(null);
  const [searches, setSearches] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rows = await fetchMyListings(userId);
      const totals = await fetchEventTotals(rows.map((l) => l.id));
      const { count } = supabase
        ? await supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", userId)
        : { count: 0 };
      if (!alive) return;
      setMine(rows);
      setEvents(sumEvents(totals.values()));
      setSearches(count ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const online = mine?.filter((l) => l.status === "AKTIV" || l.status === "RESERVIERT").length ?? 0;
  const drafts = mine?.filter((l) => l.status === "ENTWURF").length ?? 0;

  // The listing that gains most from one more step: drafts first, then the
  // online ones below 80 %.
  const nudge = useMemo(() => {
    const open = (mine ?? [])
      .filter((l) => l.status === "ENTWURF" || l.status === "AKTIV")
      .map((l) => ({ l, q: listingQuality(l) }))
      .filter(({ l, q }) => l.status === "ENTWURF" || q.score < 80);
    open.sort((a, b) => Number(b.l.status === "ENTWURF") - Number(a.l.status === "ENTWURF") || a.q.score - b.q.score);
    return open[0] ?? null;
  }, [mine]);

  const name = profile?.name?.trim();

  return (
    <div className="space-y-10">
      <p className="-mt-3 text-body text-fg2">
        {name ? `Hallo ${name}` : "Hallo"} · <span className="text-fg3">{email}</span>
      </p>

      {profile?.type === "GARAGE" && !profile.verified && (
        <Notice tone="caution">
          Dein Garagenkonto ist noch nicht verifiziert. Wir prüfen die UID von Hand im Handelsregister —{" "}
          <a href={href("/konto/garage")} className="font-semibold underline">
            Angaben vervollständigen
          </a>
          .
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Online"
          value={mine ? online : "–"}
          hint={drafts ? `${drafts} ${drafts === 1 ? "Entwurf" : "Entwürfe"}` : "Inserate"}
          href={href("/konto/inserate")}
          icon={<Car size={17} aria-hidden />}
        />
        <StatCard
          title="Ungelesen"
          value={unread}
          hint="Nachrichten"
          href={href("/konto/nachrichten")}
          icon={<MessageSquare size={17} aria-hidden />}
        />
        <StatCard
          title="Aufrufe"
          value={events ? fmtCH(events.VIEW) : "–"}
          hint={events ? `${events.CONTACT} Anfragen · 30 Tage` : "30 Tage"}
          href={href("/konto/inserate")}
          icon={<Eye size={17} aria-hidden />}
        />
        <StatCard
          title="Merkliste"
          value={saved.length}
          hint={searches === null ? "Autos" : `Autos · ${searches} Suchabos`}
          href={href("/merkliste")}
          icon={<Heart size={17} aria-hidden />}
        />
      </div>

      {unread > 0 && (
        <Notice tone="success">
          {unread === 1 ? "Eine Nachricht wartet" : `${unread} Nachrichten warten`} auf dich.{" "}
          <a href={href("/konto/nachrichten")} className="font-semibold underline">
            Jetzt antworten
          </a>{" "}
          — wer schnell antwortet, verkauft schneller.
        </Notice>
      )}

      <section>
        <SectionHeader title="Verkaufen" more={mine?.length ? { href: href("/konto/inserate"), label: "Alle Inserate" } : undefined} />
        {mine === null ? (
          <div className="mt-4 h-40 animate-pulse rounded-card bg-surface2" />
        ) : nudge ? (
          <div className="card mt-4 grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_18rem] sm:p-6">
            <div>
              <p className="eyebrow">{STATUS_LABEL[nudge.l.status]}</p>
              <h3 className="mt-1 text-h3 font-bold text-fg">{vehicleTitle(nudge.l)}</h3>
              <p className="mt-1 text-body text-fg2">
                {nudge.l.status === "ENTWURF"
                  ? "Dein Entwurf ist fast bereit. Jeder Punkt rechts ist eine Frage, die Käufer sonst per Nachricht stellen."
                  : "Online, aber mit Luft nach oben: Inserate über 80 % bekommen spürbar mehr Anfragen."}
              </p>
              <LinkButton
                href={`${href("/verkaufen/neu")}?id=${encodeURIComponent(nudge.l.id)}`}
                variant="primary"
                className="mt-4"
              >
                {nudge.l.status === "ENTWURF" ? "Weiter bearbeiten" : "Inserat verbessern"}
              </LinkButton>
            </div>
            <QualityMeter score={nudge.q.score} next={nudge.q.next} />
          </div>
        ) : mine.length === 0 ? (
          <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="max-w-prose">
              <h3 className="text-h3 font-bold text-fg">Verkaufst du dein E-Auto?</h3>
              <p className="mt-1 text-body text-fg2">
                Gratis inserieren, mit Batteriegarantie und Kosten für jede Käuferin. Den Preis schätzt der Preis-Check aus
                vergleichbaren Inseraten.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton href={href("/verkaufen/neu")} variant="primary">
                <Plus size={16} aria-hidden /> Inserat aufgeben
              </LinkButton>
              <LinkButton href={href("/verkaufen/preis-check")}>
                <Tag size={16} aria-hidden /> Preis-Check
              </LinkButton>
            </div>
          </div>
        ) : (
          <Notice tone="success" className="mt-4">
            Alle deine Inserate sind vollständig. Gut gemacht.
          </Notice>
        )}
      </section>

      <section>
        <SectionHeader title="Suchen" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a href={href("/konto/suchabos")} className="card card-hover flex items-start gap-3 p-5">
            <BellRing size={20} aria-hidden className="mt-0.5 shrink-0 text-fg3" />
            <span>
              <span className="block text-body font-semibold text-fg">Suchabos</span>
              <span className="block text-small text-fg2">
                {searches ? `${searches} gespeichert — neue Treffer per E-Mail.` : "Speichere eine Suche und verpasse kein passendes Auto."}
              </span>
            </span>
          </a>
          <div className="card flex items-start gap-3 p-5">
            <Car size={20} aria-hidden className="mt-0.5 shrink-0 text-fg3" />
            <span>
              <span className="block text-body font-semibold text-fg">Fahrprofil</span>
              <span className="block text-small text-fg2">
                {hydrated && gemeinde
                  ? `${gemeinde.zip} ${gemeinde.name} · ${fmtCH(annualKm)} km pro Jahr`
                  : "Ohne PLZ rechnen wir mit Schweizer Durchschnittswerten."}
              </span>
              <FahrprofilLink className="mt-1" />
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
