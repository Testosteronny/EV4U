import { supabase } from "./supabase";

/* ============================================================================
   Video-Rundgang — one walkthrough per listing, at most 3 minutes.

   Files live in the Cloudflare R2 bucket `ev4u-videos` under the seller's
   own folder (`<uid>/<slug>/…`); the database keeps the key, this module
   builds the public URL. The browser converts the clip first
   (utils/videoPrepare.ts), asks the `video-upload` Edge Function for a
   signed link and PUTs the file straight to R2.

   PUBLIC_VIDEO_BASE_URL is the bucket's public address (r2.dev or a custom
   domain). Without it the whole feature stays hidden — no upload field,
   no player — so nothing half-works before the bucket is set up.
   ============================================================================ */

const BASE = (import.meta.env.PUBLIC_VIDEO_BASE_URL ?? "").replace(/\/$/, "");

export const VIDEOS_ENABLED = Boolean(BASE && supabase);
export const MAX_VIDEO_SECONDS = 180;
/** Keep in sync with MAX_BYTES in supabase/functions/video-upload. */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export function videoUrl(path: string): string {
  return `${BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** «2:41» */
export function fmtVideoLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class VideoError extends Error {}

/** Signed upload, then a PUT with progress (fetch cannot report it).
 *  Returns the stored key. */
export async function uploadVideo(
  blob: Blob,
  type: "video/mp4" | "video/webm",
  slug: string,
  onProgress: (share: number) => void,
): Promise<string> {
  if (!supabase) throw new VideoError("Kein Backend.");
  const { data, error } = await supabase.functions.invoke<{ url: string; path: string }>("video-upload", {
    body: { action: "sign", slug, size: blob.size, type },
  });
  if (error || !data) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    throw new VideoError(
      status === 429
        ? "Du hast schon so viele Videos gespeichert, wie du Inserate hast. Entferne zuerst ein altes."
        : status === 413
          ? "Das Video ist zu gross."
          : status === 503
            ? "Video-Uploads sind noch nicht eingerichtet."
            : "Der Upload liess sich nicht starten. Bitte nochmals versuchen.",
    );
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new VideoError(`Upload fehlgeschlagen (${xhr.status}).`)));
    xhr.onerror = () => reject(new VideoError("Die Verbindung brach ab. Bitte nochmals versuchen."));
    xhr.send(blob);
  });
  return data.path;
}

/** Best effort: a video that stays behind only costs storage. */
export async function deleteVideo(path: string): Promise<void> {
  await supabase?.functions.invoke("video-upload", { body: { action: "delete", path } }).catch(() => undefined);
}
