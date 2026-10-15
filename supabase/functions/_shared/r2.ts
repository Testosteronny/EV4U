/* ============================================================================
   Cloudflare R2 over its S3 API — the walkthrough videos (bucket
   `ev4u-videos`, keys `<user id>/<listing slug>/<file>.mp4`).

   Secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and
   R2_BUCKET. Without them `r2()` returns null and callers treat videos as
   not configured. Requests are signed with SigV4 (aws4fetch).
   ============================================================================ */

import { AwsClient } from "npm:aws4fetch@1.0.20";

export type R2 = { client: AwsClient; base: string };

export function r2(): R2 | null {
  const account = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET");
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `https://${bucket}.${account}.r2.cloudflarestorage.com`,
  };
}

const objectUrl = (r: R2, key: string) =>
  `${r.base}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** A link the browser can PUT exactly this file to — type and byte size
 *  are part of the signature, so a different or bigger file is refused. */
export async function presignPut(r: R2, key: string, type: string, size: number, expires = 900): Promise<string> {
  const url = new URL(objectUrl(r, key));
  url.searchParams.set("X-Amz-Expires", String(expires));
  const signed = await r.client.sign(
    new Request(url, { method: "PUT", headers: { "Content-Type": type, "Content-Length": String(size) } }),
    { aws: { signQuery: true, allHeaders: true } },
  );
  return signed.url;
}

/** Keys under a prefix (up to 1000 — far more than one account holds). */
export async function listKeys(r: R2, prefix: string): Promise<string[]> {
  const url = new URL(`${r.base}/`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  const res = await r.client.fetch(url);
  if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
}

export async function deleteKey(r: R2, key: string): Promise<void> {
  const res = await r.client.fetch(objectUrl(r, key), { method: "DELETE" });
  // 204 deleted, 404 already gone — both fine.
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
}
