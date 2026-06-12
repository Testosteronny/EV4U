/* ============================================================================
   Client-side image processing — runs before upload, so storage and
   bandwidth stay small without any paid transform service:
   downscale to max 1600 px (longest edge) and re-encode as JPEG ~82 %.
   A 12-MP phone photo (~4 MB) lands at ~250–400 KB.
   ============================================================================ */

export async function resizeImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}
