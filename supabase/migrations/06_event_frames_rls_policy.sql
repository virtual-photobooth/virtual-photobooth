-- ========================================================
-- 06_event_frames_rls_policy.sql
-- FIX DATABASE RLS POLICIES FOR EVENT FRAMES TABLE
-- ========================================================

-- 1. HAPUS POLICY LAMA YANG RESTRIKTIF
DROP POLICY IF EXISTS "Owners can do anything on event_frames" ON public.event_frames;
DROP POLICY IF EXISTS "Clients can view frames of their events" ON public.event_frames;
DROP POLICY IF EXISTS "Guests can view frames of active events" ON public.event_frames;
DROP POLICY IF EXISTS "Allow full access to event_frames for admin and public" ON public.event_frames;
DROP POLICY IF EXISTS "Public and Admin Access for event_frames" ON public.event_frames;

-- 2. BERIKAN AKSES PENUH KEPADA ANON & AUTHENTICATED
-- Note: Otorisasi admin & pemilik event divalidasi ketat di Next.js Server API (verifyEventAccess)
CREATE POLICY "Public and Admin Access for event_frames" ON public.event_frames
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Alternatif jika ingin menonaktifkan RLS sepenuhnya pada event_frames:
-- ALTER TABLE public.event_frames DISABLE ROW LEVEL SECURITY;
