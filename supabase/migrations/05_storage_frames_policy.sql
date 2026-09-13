-- ========================================================
-- 05_storage_frames_policy.sql
-- FIX STORAGE RLS POLICIES FOR EVENT FRAMES & ASSETS
-- ========================================================

-- 1. DROP EXISTING POLICIES TO PREVENT CONFLICTS
DROP POLICY IF EXISTS "Guest Upload Access for Photos and Voices" ON storage.objects;
DROP POLICY IF EXISTS "Storage Upload Access for Events" ON storage.objects;
DROP POLICY IF EXISTS "Storage Update Access for Events" ON storage.objects;
DROP POLICY IF EXISTS "Storage Delete Access for Events" ON storage.objects;

-- 2. ALLOW INSERT (UPLOAD) TO EVENTS SUBFOLDERS (photos, voices, frames, frame, cover)
CREATE POLICY "Storage Upload Access for Events" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        bucket_id = 'virtual-photobooth' AND (
            (storage.foldername(name))[1] = 'events' AND (
                (storage.foldername(name))[3] IN ('photos', 'voices', 'frames', 'frame', 'cover')
            )
        )
    );

-- 3. ALLOW UPDATE (UPSERT) TO EVENTS SUBFOLDERS
CREATE POLICY "Storage Update Access for Events" ON storage.objects
    FOR UPDATE TO anon, authenticated
    USING (
        bucket_id = 'virtual-photobooth' AND (
            (storage.foldername(name))[1] = 'events'
        )
    )
    WITH CHECK (
        bucket_id = 'virtual-photobooth' AND (
            (storage.foldername(name))[1] = 'events'
        )
    );

-- 4. ALLOW DELETE TO EVENTS SUBFOLDERS (CLEANUP OF FRAMES, PHOTOS, VOICES)
CREATE POLICY "Storage Delete Access for Events" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (
        bucket_id = 'virtual-photobooth' AND (
            (storage.foldername(name))[1] = 'events'
        )
    );
