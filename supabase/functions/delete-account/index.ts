/* ============================================================================
   Edge Function `delete-account` — «Konto löschen» (/konto/einstellungen).

   Needs the caller's JWT (verify_jwt). Removes the caller's photos from the
   `listing-photos` bucket (folder `<user id>/<listing slug>/…`) and their
   walkthrough videos from R2 (same folder layout), then deletes the auth
   user; everything else cascades in the database
   (profile, listings, conversations, messages, saved searches, favorites,
   account settings). The service role key never leaves this function.
   ============================================================================ */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { deleteKey, listKeys, r2 } from "../_shared/r2.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BUCKET = "listing-photos";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "not authenticated" }, 401);
  const userId = auth.user.id;

  // Photos: one folder per listing under the user's own folder.
  const storage = admin.storage.from(BUCKET);
  const { data: folders } = await storage.list(userId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const prefix = `${userId}/${folder.name}`;
    const { data: files } = await storage.list(prefix, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  }

  // Videos: R2, same folder layout. A failure here must not keep the
  // account alive — the keys are logged for a manual sweep.
  const videos = r2();
  if (videos) {
    try {
      for (const key of await listKeys(videos, `${userId}/`)) await deleteKey(videos, key);
    } catch (e) {
      console.error("[delete-account] video cleanup failed for", userId, e);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
