-- ========================================================
-- 07_PRINT_REQUESTS.SQL - PRINT QUEUE & STATION SCHEMA
-- ========================================================

-- 1. ENUM STATUS PRINT
DO $$ BEGIN
    CREATE TYPE public.print_status AS ENUM ('pending', 'printing', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL PRINT_REQUESTS
CREATE TABLE IF NOT EXISTS public.print_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL DEFAULT 'Tamu',
    layout_type TEXT NOT NULL DEFAULT 'strip_2x6', -- 'strip_2x6' (dual strip on 4R), 'full_4r' (single 4R), 'grid_2r' (4 on 4R), 'single_strip'
    copies INT NOT NULL DEFAULT 1 CHECK (copies > 0 AND copies <= 10),
    status public.print_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at TIMESTAMPTZ
);

-- Index Performa
CREATE INDEX IF NOT EXISTS idx_print_requests_event_id ON public.print_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_status ON public.print_requests(status);
CREATE INDEX IF NOT EXISTS idx_print_requests_created_at ON public.print_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_requests_photo_id ON public.print_requests(photo_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.handle_print_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_on_print_requests_updated
    BEFORE UPDATE ON public.print_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_print_requests_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.print_requests ENABLE ROW LEVEL SECURITY;

-- Berikan akses kepada Anon dan Authenticated
-- Validasi otorisasi vendor/event dihandle secara ketat di Next.js Server API
CREATE POLICY "Public and Admin Access for print_requests" ON public.print_requests
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

