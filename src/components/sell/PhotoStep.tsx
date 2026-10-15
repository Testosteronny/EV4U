import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Star, X } from "lucide-react";
import { MAX_PHOTOS } from "./draft";
import { Notice } from "../ui";
import { photoUrl, supabase } from "../../lib/supabase";
import { resizeImage } from "../../utils/image";

/* ============================================================================
   Step 5 — Fotos. Up to 20, resized in the browser (1600 px, JPEG ~82 %)
   and stored in the seller's own folder `<uid>/<slug>/…` as the storage
   policy requires. The first photo is the cover; drag (or the arrows) to
   reorder. The shot list says what buyers look for — the cockpit with
   range and SOH and the charge port are the two an EV listing needs most.
   ============================================================================ */

const SHOTS = [
  "Front schräg",
  "Heck schräg",
  "Seite",
  "Innenraum vorne",
  "Cockpit mit Reichweite und SOH",
  "Ladeanschluss",
  "Kofferraum",
  "Rücksitze",
];

export default function PhotoStep({
  userId,
  slug,
  photos,
  onChange,
}: {
  userId: string;
  slug: string;
  photos: string[];
  /** Called with the new order after every upload, removal or move. */
  onChange: (photos: string[]) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    if (!supabase) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const take = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setError(`Höchstens ${MAX_PHOTOS} Fotos — ${files.length - room} wurden nicht hochgeladen.`);
    const added: string[] = [];
    for (const [i, file] of take.entries()) {
      setBusy(`Foto ${i + 1} von ${take.length} wird hochgeladen…`);
      try {
        const blob = await resizeImage(file);
        const path = `${userId}/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error: err } = await supabase.storage.from("listing-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (err) throw err;
        added.push(path);
      } catch {
        setError("Ein Foto liess sich nicht hochladen. JPG, PNG oder HEIC vom Handy gehen — bitte nochmals versuchen.");
      }
    }
    setBusy(null);
    if (added.length) onChange([...photos, ...added]);
  };

  const remove = (path: string) => {
    onChange(photos.filter((p) => p !== path));
    void supabase?.storage.from("listing-photos").remove([path]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {photos.map((p, i) => (
          <figure
            key={p}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => dragFrom !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              e.stopPropagation();
              move(dragFrom, i);
              setDragFrom(null);
            }}
            className={`group relative aspect-4/3 cursor-grab overflow-hidden rounded-control border bg-surface2 ${
              dragFrom === i ? "border-accent opacity-60" : "border-line"
            }`}
          >
            <img src={photoUrl(p)} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" draggable={false} />
            {i === 0 && (
              <figcaption className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-micro font-semibold text-white">
                <Star size={11} aria-hidden /> Titelbild
              </figcaption>
            )}
            <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
              <span className="flex gap-1">
                <PhotoButton label="Nach vorne" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ArrowLeft size={14} aria-hidden />
                </PhotoButton>
                <PhotoButton label="Nach hinten" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1}>
                  <ArrowRight size={14} aria-hidden />
                </PhotoButton>
              </span>
              <PhotoButton label="Foto entfernen" onClick={() => remove(p)}>
                <X size={14} aria-hidden />
              </PhotoButton>
            </div>
          </figure>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy !== null}
            className="flex aspect-4/3 flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-line2 text-small font-semibold text-fg2 transition-colors hover:border-accent hover:text-accent disabled:cursor-wait"
          >
            <ImagePlus size={22} aria-hidden />
            {photos.length === 0 ? "Fotos hinzufügen" : "Weitere Fotos"}
            <span className="text-micro font-normal text-fg3 tabular">
              {photos.length} / {MAX_PHOTOS}
            </span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) void upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      {busy && (
        <p className="mt-3 text-small text-fg2" aria-live="polite">
          {busy}
        </p>
      )}
      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}

      <div className="mt-6 rounded-card bg-surface2 p-4">
        <p className="text-small font-semibold text-fg">Was Käufer sehen wollen</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {SHOTS.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-small text-fg2">
              <Check size={14} aria-hidden className={i < photos.length ? "text-accent" : "text-fg3"} />
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-micro text-fg3">
          Bei Tageslicht, Auto sauber, ganzes Auto im Bild. Kontrollschilder darfst du abdecken. Mehr im Ratgeber «Fotos fürs
          Inserat».
        </p>
      </div>
    </div>
  );
}

function PhotoButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white transition-opacity hover:bg-black/80 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
