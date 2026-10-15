/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Public address of the R2 video bucket; unset = no videos. */
  readonly PUBLIC_VIDEO_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
