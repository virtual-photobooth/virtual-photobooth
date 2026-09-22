-- ========================================================
-- 09_print_requests_rls_policy.sql
-- FIX DATABASE RLS POLICIES FOR PRINT_REQUESTS TABLE
-- ========================================================

-- 1. HAPUS POLICY LAMA YANG RESTRIKTIF PADA PRINT_REQUESTS
DROP POLICY IF EXISTS "Owners can do anything on print_requests" ON public.print_requests;
DROP POLICY IF EXISTS "Clients can manage print requests of their events" ON public.print_requests;
DROP POLICY IF EXISTS "Guests can create print requests for active events" ON public.print_requests;
DROP POLICY IF EXISTS "Guests can view print requests of active events" ON public.print_requests;
DROP POLICY IF EXISTS "Public and Admin Access for print_requests" ON public.print_requests;

-- 2. BERIKAN AKSES PENUH KEPADA ANON & AUTHENTICATED
-- Note: Otorisasi admin & client divalidasi pada Next.js API Routes
CREATE POLICY "Public and Admin Access for print_requests" ON public.print_requests
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Alternatif jika ingin menonaktifkan RLS sepenuhnya pada print_requests:
-- ALTER TABLE public.print_requests DISABLE ROW LEVEL SECURITY;
