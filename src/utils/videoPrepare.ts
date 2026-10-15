import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
} from "mediabunny";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, VideoError, fmtVideoLength } from "../lib/video";

/* ============================================================================
   Prepares a seller's walkthrough clip for upload, entirely in the browser
   (WebCodecs via Mediabunny — loaded only when someone picks a video):

   · checks the length (max 3 minutes);
   · converts to MP4, H.264 + AAC, longer edge 1280 px, ~2 Mbit/s — plays
     everywhere (an iPhone's HEVC .mov does not play in Firefox) and lands
     at ~45 MB for 3 minutes instead of 300–800 MB;
   · drops all metadata — phone videos carry the GPS position;
   · grabs a poster frame for the gallery.

   Browsers that cannot encode H.264 may still upload a file that already
   is MP4/WebM and small enough; everything else gets a clear message.
   ============================================================================ */

const LONG_EDGE = 1280;
const VIDEO_BITRATE = 2_000_000;
const AUDIO_BITRATE = 96_000;

export type PreparedVideo = {
  blob: Blob;
  type: "video/mp4" | "video/webm";
  seconds: number;
  poster: Blob | null;
};

const tooLong = (seconds: number) =>
  new VideoError(`Das Video dauert ${fmtVideoLength(seconds)} — höchstens ${MAX_VIDEO_SECONDS / 60} Minuten gehen.`);

export async function prepareVideo(
  file: File,
  onProgress: (share: number) => void,
  signal?: AbortSignal,
): Promise<PreparedVideo> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    let seconds: number;
    try {
      seconds = await input.computeDuration();
    } catch {
      throw new VideoError("Diese Datei ist kein Video, das sich lesen lässt. MP4 oder MOV vom Handy gehen.");
    }
    if (seconds > MAX_VIDEO_SECONDS + 0.5) throw tooLong(seconds);

    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new VideoError("In dieser Datei ist keine Videospur.");
    const [w, h] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
    const landscape = w >= h;
    const longEdge = Math.max(w, h);
    const size = longEdge > LONG_EDGE ? (landscape ? { width: LONG_EDGE } : { height: LONG_EDGE }) : {};

    // Firefox has no AAC encoder of its own; Mediabunny brings one.
    if (!(await canEncodeAudio("aac"))) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    }

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { ...size, codec: "avc", quality: new Quality({ bitrate: VIDEO_BITRATE }) },
      audio: { codec: "aac", quality: new Quality({ bitrate: AUDIO_BITRATE }) },
      tags: {},
    });

    const videoKept = !conversion.discardedTracks.some((d) => d.track.isVideoTrack());
    if (!conversion.isValid || !videoKept) return await asIs(file, seconds);

    conversion.onProgress = onProgress;
    const abort = () => void conversion.cancel();
    signal?.addEventListener("abort", abort);
    try {
      await conversion.execute();
    } catch (e) {
      if (signal?.aborted) throw new VideoError("Abgebrochen.");
      console.warn("[ev4u] video conversion failed:", e);
      return await asIs(file, seconds);
    } finally {
      signal?.removeEventListener("abort", abort);
    }

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    if (blob.size > MAX_VIDEO_BYTES) throw new VideoError("Das Video ist auch nach dem Verkleinern zu gross. Bitte kürzer aufnehmen.");
    return { blob, type: "video/mp4", seconds, poster: await posterFrame(blob, seconds) };
  } finally {
    input.dispose();
  }
}

/** No encoder in this browser: upload the original if it already fits. */
async function asIs(file: File, seconds: number): Promise<PreparedVideo> {
  const type = file.type === "video/mp4" || file.type === "video/webm" ? file.type : null;
  if (!type || file.size > MAX_VIDEO_BYTES) {
    throw new VideoError(
      "Dieser Browser kann das Video nicht verkleinern. Bitte mit einem aktuellen Chrome, Edge, Safari oder Firefox nochmals versuchen.",
    );
  }
  return { blob: file, type, seconds, poster: await posterFrame(file, seconds) };
}

/** A JPEG of the frame at 1 s (or the middle of a very short clip). */
async function posterFrame(blob: Blob, seconds: number): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadeddata");
    video.currentTime = Math.min(1, seconds / 2);
    await once(video, "seeked");
    const scale = Math.min(1, LONG_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function once(el: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${event} timeout`)), 10_000);
    el.addEventListener(event, () => (window.clearTimeout(timer), resolve()), { once: true });
    el.addEventListener("error", () => (window.clearTimeout(timer), reject(new Error("video error"))), { once: true });
  });
}
