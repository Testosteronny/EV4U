-- ============================================================================
-- Video-Rundgang and the photo limit.
--
--   · one walkthrough video per listing, max 3 minutes, stored in the
--     Cloudflare R2 bucket `ev4u-videos` (the video-upload Edge Function
--     hands out signed upload links); the poster frame is a JPEG in the
--     listing-photos bucket like every other image
--   · both paths must sit in the owner's own folder `<uid>/<slug>/…` —
--     nobody can point their listing at someone else's file
--   · at most 12 photos per listing (was 20, only enforced in the UI)
-- ============================================================================
set local lock_timeout = '5s';

alter table public.listings
  add column video_path text,
  add column video_seconds smallint,
  add column video_poster text,
  add constraint listings_photos_max check (cardinality(photos) <= 12),
  add constraint listings_video_path_check check (
    video_path is null
    or (video_path ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,80}/[a-z0-9-]{1,40}\.(mp4|webm)$'
        and video_path like owner::text || '/%')
  ),
  add constraint listings_video_poster_check check (
    video_poster is null
    or (video_poster ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,80}/[a-z0-9-]{1,40}\.jpg$'
        and video_poster like owner::text || '/%'
        and video_path is not null)
  ),
  add constraint listings_video_seconds_check check (video_seconds between 1 and 180),
  add constraint listings_video_complete check ((video_path is null) = (video_seconds is null));

comment on column public.listings.video_path is
  'Walkthrough video: object key in the R2 bucket ev4u-videos, <owner>/<slug>/<file>.mp4.';
comment on column public.listings.video_seconds is 'Video length in seconds (1–180), measured in the browser at upload.';
comment on column public.listings.video_poster is 'Poster frame of the video, a path in the listing-photos bucket.';
