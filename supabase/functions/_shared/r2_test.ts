import { assert, assertEquals } from "jsr:@std/assert@1";
import { presignPut, r2 } from "./r2.ts";

Deno.test("r2() is null until all four secrets are set", () => {
  for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) Deno.env.delete(k);
  assertEquals(r2(), null);
});

Deno.test("presigned PUT signs type and size, so a different file is refused", async () => {
  Deno.env.set("R2_ACCOUNT_ID", "acc123");
  Deno.env.set("R2_ACCESS_KEY_ID", "AKIDEXAMPLE");
  Deno.env.set("R2_SECRET_ACCESS_KEY", "secret");
  Deno.env.set("R2_BUCKET", "ev4u-videos");
  const storage = r2()!;
  const url = new URL(
    await presignPut(storage, "0b5d6f1e-0000-4000-8000-000000000000/tesla-model-3-ab12/m1x-1a2b3c4d.mp4", "video/mp4", 1234),
  );
  assertEquals(url.host, "ev4u-videos.acc123.r2.cloudflarestorage.com");
  assertEquals(url.pathname, "/0b5d6f1e-0000-4000-8000-000000000000/tesla-model-3-ab12/m1x-1a2b3c4d.mp4");
  assertEquals(url.searchParams.get("X-Amz-Expires"), "900");
  assertEquals(url.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert(/^[0-9a-f]{64}$/.test(url.searchParams.get("X-Amz-Signature") ?? ""));
  assert(url.searchParams.get("X-Amz-Credential")?.endsWith("/auto/s3/aws4_request"));
});
