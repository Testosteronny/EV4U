/* ============================================================================
   Edge Function `video-upload` — the Video-Rundgang of a listing.

   The browser converts the seller's clip to a 720p MP4 (max 3 minutes) and
   uploads it straight to Cloudflare R2; this function only signs and
   cleans up. Needs the caller's JWT (verify_jwt).

   POST { action: "sign", slug, size, type }
     → { url, path }: a 15-minute PUT link for exactly this file under the
       caller's own folder `<uid>/<slug>/…`. Refused when the file is too
       big or the account already holds one video per listing plus two
       (room for a replacement while the old one is still saved).
   POST { action: "delete", path }
     → { ok }: removes a video of the caller — or any video, for admins
       (moderation deletes listings of other people).

   Without the R2 secrets it answers 503 and the site hides the feature.
   ============================================================================ */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { deleteKey, listKeys, presignPut, r2 } from "../_shared/r2.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Keep in sync with MAX_VIDEO_BYTES in src/lib/video.ts. */
const MAX_BYTES = 60 * 1024 * 1024;
const TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const SLUG = /^[a-z0-9-]{1,80}$/;
const PATH = /^[0-9a-f-]{36}\/[a-z0-9-]{1,80}\/[a-z0-9-]{1,40}\.(mp4|webm)$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const storage = r2();
  if (!storage) return json({ error: "video uploads are not configured" }, 503);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "not authenticated" }, 401);
  const userId = auth.user.id;

  let body: { action?: string; slug?: string; size?: number; type?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  try {
    if (body.action === "sign") {
      const ext = TYPES[body.type ?? ""];
      const size = Number(body.size);
      if (!ext) return json({ error: "only MP4 or WebM" }, 400);
      if (!SLUG.test(body.slug ?? "")) return json({ error: "invalid slug" }, 400);
      if (!Number.isInteger(size) || size < 1 || size > MAX_BYTES) return json({ error: "file too large" }, 413);

      const { count } = await admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("owner", userId);
      const stored = await listKeys(storage, `${userId}/`);
      if (stored.length >= (count ?? 0) + 2) return json({ error: "video limit reached" }, 429);

      const file = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const path = `${userId}/${body.slug}/${file}`;
      return json({ url: await presignPut(storage, path, body.type!, size), path });
    }

    if (body.action === "delete") {
      const path = body.path ?? "";
      if (!PATH.test(path)) return json({ error: "invalid path" }, 400);
      if (!path.startsWith(`${userId}/`)) {
        const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
        if (role?.role !== "ADMIN") return json({ error: "not your video" }, 403);
      }
      await deleteKey(storage, path);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[video-upload]", e);
    return json({ error: "storage error" }, 502);
  }
});
