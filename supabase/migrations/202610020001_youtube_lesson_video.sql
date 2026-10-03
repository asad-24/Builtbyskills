-- Forward-only, additive. Review/apply manually; historical video data is retained.
alter table public.lessons add column if not exists youtube_video_id text;
alter table public.lessons add constraint lessons_youtube_video_id_format
  check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');
comment on column public.lessons.youtube_video_id is
  'Canonical YouTube video ID. URL syntax does not verify Unlisted visibility or availability.';
-- No backfill, publication changes, RLS changes, or removal of legacy Mux fields.
