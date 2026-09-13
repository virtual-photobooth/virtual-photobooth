-- ====================================================================
-- 04_FRAME_PHOTO_COUNT.SQL - ADD PHOTO_COUNT TO EVENT_FRAMES
-- ====================================================================

-- 1. Tambah kolom photo_count pada public.event_frames
ALTER TABLE public.event_frames 
ADD COLUMN IF NOT EXISTS photo_count INT NOT NULL DEFAULT 4 CHECK (photo_count > 0);

-- 2. Backfill data existing: sesuaikan photo_count frame lama dengan events.photo_count
UPDATE public.event_frames ef
SET photo_count = e.photo_count
FROM public.events e
WHERE ef.event_id = e.id AND e.photo_count IS NOT NULL;
