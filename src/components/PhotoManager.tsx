import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { photoUrl, supabase } from "../lib/supabase";
import { resizeImage } from "../utils/image";

/* ============================================================================
   PhotoManager — Fotos je Inserat. Bilder werden vor dem Upload auf 1600 px
   verkleinert (JPEG ~82 %) und landen im eigenen uid/-Ordner, wie es die
   Storage-Policy verlangt. Maximal sechs Fotos.
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
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((p) => (
          <div key={p} className="group relative h-16 w-24 overflow-hidden rounded-chip border border-line">
            <img src={photoUrl(p)} alt="" className="h-full w-full object-cover" loading="lazy" />
            <button
              onClick={() => void remove(p)}
              title="Foto entfernen"
              className="absolute right-1 top-1 hidden h-6 w-6 place-items-center rounded-full bg-canvas/90 text-fg2 transition-colors hover:text-fg group-hover:grid"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-chip border border-dashed border-line2 text-small text-fg2 transition-colors hover:border-accent hover:text-accent disabled:cursor-wait"
          >
            <ImagePlus size={16} aria-hidden />
            {busy ? "Lädt…" : `${photos.length}/${MAX_PHOTOS}`}
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
      {error && <p className="mt-2 text-small text-caution">{error}</p>}
      <p className="mt-2 text-micro text-fg3">
        Bilder werden vor dem Upload auf 1600 px verkleinert.
      </p>
    </div>
  );
}
