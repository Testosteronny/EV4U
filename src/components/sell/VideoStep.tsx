import { useEffect, useRef, useState } from "react";
import { Film, RefreshCw, Trash2, Video } from "lucide-react";
import type { DraftVideo } from "./draft";
import { Button, ChargeBar, Notice } from "../ui";
import { photoUrl, supabase } from "../../lib/supabase";
import { MAX_VIDEO_SECONDS, VideoError, fmtVideoLength, uploadVideo, videoUrl } from "../../lib/video";

/* ============================================================================
   Step 5, second half — the Video-Rundgang (optional, one per listing).
   Pick a clip → converted on this device (utils/videoPrepare.ts, loaded
   only now) → uploaded to R2 → poster frame into listing-photos. The
   wizard saves right away and removes a replaced video afterwards.
   ============================================================================ */

type Phase = { kind: "idle" } | { kind: "convert"; share: number } | { kind: "upload"; share: number };

export default function VideoStep({
  userId,
  slug,
  video,
  onChange,
}: {
  userId: string;
  slug: string;
  video: DraftVideo | null;
  onChange: (video: DraftVideo | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const pick = async (file: File) => {
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      setPhase({ kind: "convert", share: 0 });
      const { prepareVideo } = await import("../../utils/videoPrepare");
      const ready = await prepareVideo(file, (share) => setPhase({ kind: "convert", share }), ctrl.signal);
      setPhase({ kind: "upload", share: 0 });
      const path = await uploadVideo(ready.blob, ready.type, slug, (share) => setPhase({ kind: "upload", share }));
      let poster: string | null = null;
      if (ready.poster && supabase) {
        const p = `${userId}/${slug}/video-${Date.now().toString(36)}.jpg`;
        const { error: err } = await supabase.storage.from("listing-photos").upload(p, ready.poster, { contentType: "image/jpeg" });
        if (!err) poster = p;
      }
      onChange({ path, seconds: ready.seconds, poster });
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(e instanceof VideoError ? e.message : "Das Video liess sich nicht verarbeiten. Bitte nochmals versuchen.");
        console.warn("[ev4u] video:", e);
      }
    } finally {
      abort.current = null;
      setPhase({ kind: "idle" });
    }
  };

  const busy = phase.kind !== "idle";
  const percent = busy ? Math.round(phase.share * 100) : 0;

  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="flex items-center gap-2 text-h3 font-bold text-fg">
        <Video size={18} aria-hidden className="text-accent" /> Video-Rundgang
        <span className="text-small font-normal text-fg3">optional</span>
      </h3>
      <p className="mt-1 max-w-prose text-small text-fg2">
        Bis {MAX_VIDEO_SECONDS / 60} Minuten: einmal ums Auto, Innenraum, Cockpit mit Reichweite und SOH, Ladeanschluss — und
        einmal einschalten. Wir verkleinern das Video auf deinem Gerät, bevor es hochgeladen wird; Standortdaten der Datei
        werden dabei entfernt.
      </p>

      {video && !busy && (
        <figure className="mt-4 max-w-lg">
          <video
            src={videoUrl(video.path)}
            poster={video.poster ? photoUrl(video.poster) : undefined}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-control bg-black object-contain"
          />
          <figcaption className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mr-auto text-small text-fg2 tabular">Länge {fmtVideoLength(video.seconds)}</span>
            <Button size="sm" onClick={() => input.current?.click()}>
              <RefreshCw size={14} aria-hidden /> Ersetzen
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)}>
              <Trash2 size={14} aria-hidden /> Entfernen
            </Button>
          </figcaption>
        </figure>
      )}

      {!video && !busy && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-4 flex w-full max-w-lg flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-line2 px-4 py-8 text-small font-semibold text-fg2 transition-colors hover:border-accent hover:text-accent"
        >
          <Film size={22} aria-hidden />
          Video hinzufügen
          <span className="text-micro font-normal text-fg3">MP4 oder MOV vom Handy, bis {MAX_VIDEO_SECONDS / 60} Minuten</span>
        </button>
      )}

      {busy && (
        <div className="mt-4 max-w-lg rounded-control bg-surface2 p-4" aria-live="polite">
          <p className="text-small font-semibold text-fg">
            {phase.kind === "convert" ? "Video wird verkleinert" : "Video wird hochgeladen"} · <span className="tabular">{percent} %</span>
          </p>
          <ChargeBar value={percent} label={`Fortschritt ${percent} %`} className="mt-2" />
          <p className="mt-2 text-micro text-fg3">
            {phase.kind === "convert"
              ? "Das passiert auf deinem Gerät und dauert etwa so lange wie das Video selbst. Lass diese Seite offen."
              : "Gleich fertig — lass diese Seite offen."}
          </p>
          {phase.kind === "convert" && (
            <Button size="sm" className="mt-3" onClick={() => abort.current?.abort()}>
              Abbrechen
            </Button>
          )}
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {error && (
        <Notice tone="danger" className="mt-3 max-w-lg">
          {error}
        </Notice>
      )}
    </div>
  );
}
