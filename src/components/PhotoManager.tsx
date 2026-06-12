import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { photoUrl, supabase } from "../lib/supabase";
import { resizeImage } from "../utils/image";

/* ============================================================================
   PhotoManager — per-listing photo handling on /konto.
   Images are downscaled client-side (max 1600 px, JPEG ~82 %) before upload
   into the user's own uid/ folder (enforced by the storage RLS policy);
   the DB row keeps the bucket paths. Max 6 photos per Inserat.
   ============================================================================ */

const MAX_PHOTOS = 6;

export default function PhotoManager({
  listingId,
  slug,
  photos,
  userId,
  onChanged,
}: {
  listingId: string;
  slug: string;
  photos: string[];
  userId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const paths = [...photos];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - paths.length)) {
      try {
        const blob = await resizeImage(file);
        const path = `${userId}/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const up = await supabase.storage
          .from("listing-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        paths.push(path);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    await supabase.from("listings").update({ photos: paths }).eq("id", listingId);
    setBusy(false);
    onChanged();
  };

  const remove = async (path: string) => {
    if (!supabase) return;
    await supabase.storage.from("listing-photos").remove([path]);
    await supabase
      .from("listings")
      .update({ photos: photos.filter((p) => p !== path) })
      .eq("id", listingId);
    onChanged();
  };

  return (
    <div className="mt-4 border-t border-dashed border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((p) => (
          <div key={p} className="group relative h-16 w-24 border border-line">
            <img
              src={photoUrl(p)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <button
              onClick={() => void remove(p)}
              title="Foto entfernen"
              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center bg-signal text-white group-hover:grid"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-16 w-24 flex-col items-center justify-center gap-1 border border-dashed border-line font-mono text-[8px] uppercase tracking-[0.15em] text-muted transition-colors hover:border-signal hover:text-signal disabled:cursor-wait"
          >
            <ImagePlus size={14} />
            {busy ? "Lädt…" : `Fotos (${photos.length}/${MAX_PHOTOS})`}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-2 font-mono text-[9px] tracking-[0.12em] text-warn">
          {error.toUpperCase()}
        </p>
      )}
      <p className="mt-2 font-mono text-[8px] tracking-[0.12em] text-muted/60">
        BILDER WERDEN VOR DEM UPLOAD AUF 1600 PX VERKLEINERT (JPEG).
      </p>
    </div>
  );
}
