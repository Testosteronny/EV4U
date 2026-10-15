import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import CarGraphic from "./CarGraphic";
import { listingBadges } from "./ListingCard";
import { Badge, Portal, useModal } from "../ui";
import { photoUrl } from "../../lib/supabase";
import { vehicleTitle } from "../../utils/format";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Galerie (Konzept §4.3) — large photo, thumbnails, «1/8», and a full-screen
   lightbox with arrow keys and swipe. Without photos: the body-type drawing
   and an honest sentence instead of an empty grey box.
   ============================================================================ */

export default function Gallery({ listing }: { listing: Listing }) {
  const photos = listing.photos ?? [];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const title = vehicleTitle(listing);
  const badges = listingBadges(listing);

  if (photos.length === 0) {
    return (
      <div className="relative grid aspect-16/10 place-items-center overflow-hidden rounded-card bg-surface2">
        <div className="p-6 text-center">
          <CarGraphic segment={listing.segment} detailed className="mx-auto h-28 w-auto text-fg3 sm:h-36" />
          <p className="mx-auto mt-4 max-w-prose text-small text-fg3">
            Noch keine Fotos — die Zeichnung zeigt die Karosserieform. Die Daten unten gelten unabhängig davon.
          </p>
        </div>
        <Badges badges={badges} />
      </div>
    );
  }

  const go = (d: number) => setActive((i) => (i + d + photos.length) % photos.length);
  const rest = photos.length - 5;

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="group relative block aspect-16/10 w-full overflow-hidden rounded-card bg-surface2"
        aria-label={`Foto ${active + 1} von ${photos.length} gross anzeigen`}
      >
        <img
          src={photoUrl(photos[active])}
          alt={`${title} — Foto ${active + 1} von ${photos.length}`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <Badges badges={badges} />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-small font-semibold text-white">
          <Expand size={13} aria-hidden />
          {active + 1}/{photos.length}
        </span>
      </button>
      {photos.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {photos.slice(0, 5).map((p, i) => {
            const more = i === 4 && rest > 0;
            return (
              <button
                key={p}
                type="button"
                onClick={() => (more ? (setActive(4), setLightbox(true)) : setActive(i))}
                aria-label={more ? `Alle ${photos.length} Fotos` : `Foto ${i + 1} anzeigen`}
                aria-pressed={!more && i === active}
                className={`relative aspect-4/3 overflow-hidden rounded-control border-2 transition-colors ${
                  i === active ? "border-accent" : "border-transparent hover:border-line2"
                }`}
              >
                <img src={photoUrl(p)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                {more && (
                  <span className="absolute inset-0 grid place-items-center bg-black/55 text-body font-bold text-white">
                    +{rest + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {lightbox && (
        <Lightbox photos={photos} index={active} title={title} onIndex={setActive} onStep={go} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}

function Badges({ badges }: { badges: ReturnType<typeof listingBadges> }) {
  if (badges.length === 0) return null;
  return (
    <span className="absolute left-3 top-3 flex flex-wrap gap-1">
      {badges.map((b) => (
        <Badge key={b.label} tone={b.tone} className="shadow-sm">
          {b.label}
        </Badge>
      ))}
    </span>
  );
}

function Lightbox({
  photos,
  index,
  title,
  onIndex,
  onStep,
  onClose,
}: {
  photos: string[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onStep: (d: number) => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  useModal(onClose, panel);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep]);

  return (
    <Portal>
      <div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-label={`Fotos: ${title}`}
        tabIndex={-1}
        className="fixed inset-0 z-90 flex flex-col bg-black/95 text-white outline-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-small font-semibold tabular">
            {index + 1} / {photos.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-2"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 40) onStep(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <img
            src={photoUrl(photos[index])}
            alt={`${title} — Foto ${index + 1} von ${photos.length}`}
            className="max-h-full max-w-full object-contain"
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label="Vorheriges Foto"
                className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
              >
                <ChevronLeft size={22} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onStep(1)}
                aria-label="Nächstes Foto"
                className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
              >
                <ChevronRight size={22} aria-hidden />
              </button>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {photos.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === index}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-control border-2 ${
                  i === index ? "border-volt" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={photoUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Portal>
  );
}
