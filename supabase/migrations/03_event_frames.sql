-- ====================================================================
-- 03_EVENT_FRAMES.SQL - MULTI-FRAME SCHEMA WITH STRICT DEFAULT INVARIANT
-- ====================================================================

-- 1. TABEL EVENT_FRAMES
CREATE TABLE IF NOT EXISTS public.event_frames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Frame 1',
    frame_path TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index Performa
CREATE INDEX IF NOT EXISTS idx_event_frames_event_id ON public.event_frames(event_id);
CREATE INDEX IF NOT EXISTS idx_event_frames_order ON public.event_frames(event_id, sort_order ASC);

-- 2. PARTIAL UNIQUE INDEX (Engine Barrier: Maksimal 1 Default per Event)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_frames_single_default 
ON public.event_frames (event_id) 
WHERE (is_default = TRUE);

-- 3. TRIGGER SYNC DEFAULT (INSERT / UPDATE)
-- Menjamin invariant: Selalu tepat 1 default saat frame >= 1
CREATE OR REPLACE FUNCTION public.handle_event_frame_default_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_has_other_default BOOLEAN;
    v_other_frame_id UUID;
    v_event_exists BOOLEAN;
BEGIN
    -- Mencegah infinite trigger recursion
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Pastikan event masih ada (menghindari error jika event sedang di-delete cascade)
    SELECT EXISTS (SELECT 1 FROM public.events WHERE id = NEW.event_id) INTO v_event_exists;
    IF NOT v_event_exists THEN
        RETURN NEW;
    END IF;

    -- Serialisasi konkuren via Row-Lock pada tabel parent events
    PERFORM 1 FROM public.events WHERE id = NEW.event_id FOR UPDATE;

    -- Periksa apakah sudah ada frame default lain untuk event ini
    SELECT EXISTS (
        SELECT 1 FROM public.event_frames 
        WHERE event_id = NEW.event_id 
          AND is_default = TRUE 
          AND (TG_OP = 'INSERT' OR id != NEW.id)
    ) INTO v_has_other_default;

    -- KASUS A: Frame ini diset menjadi default (is_default = TRUE)
    IF NEW.is_default = TRUE THEN
        -- Nonaktifkan default pada frame lain milik event ini
        UPDATE public.event_frames
        SET is_default = FALSE, updated_at = NOW()
        WHERE event_id = NEW.event_id 
          AND is_default = TRUE 
          AND (TG_OP = 'INSERT' OR id != NEW.id);
        
        RETURN NEW;
    END IF;

    -- KASUS B: Frame ini non-default (is_default = FALSE), tetapi event belum punya default sama sekali
    -- (Misal: insert frame pertama, atau belum ada default yang aktif)
    IF NOT v_has_other_default THEN
        -- Wajibkan menjadi default agar tidak pernah 0 default saat frame >= 1
        NEW.is_default := TRUE;
        RETURN NEW;
    END IF;

    -- KASUS C: Percobaan mematikan default aktif (OLD.is_default = TRUE menjadi NEW.is_default = FALSE)
    IF TG_OP = 'UPDATE' AND OLD.is_default = TRUE AND NEW.is_default = FALSE THEN
        -- Cari frame lain untuk dipromosikan sebagai pengganti default
        SELECT id INTO v_other_frame_id
        FROM public.event_frames
        WHERE event_id = NEW.event_id AND id != NEW.id
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1;

        IF v_other_frame_id IS NOT NULL THEN
            -- Promosikan frame lain tersebut menjadi default
            UPDATE public.event_frames
            SET is_default = TRUE, updated_at = NOW()
            WHERE id = v_other_frame_id;
            RETURN NEW;
        ELSE
            -- Tidak ada frame lain (ini satu-satunya frame). Tolak pelepasan status default!
            NEW.is_default := TRUE;
            RETURN NEW;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_on_event_frame_default_sync
    BEFORE INSERT OR UPDATE OF is_default, event_id ON public.event_frames
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_event_frame_default_sync();

-- 4. TRIGGER AUTO-PROMOSI DEFAULT SAAT DELETE
CREATE OR REPLACE FUNCTION public.handle_event_frame_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_event_exists BOOLEAN;
    v_next_frame_id UUID;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;

    -- Jika event induk sedang dihapus, tidak perlu promosi
    SELECT EXISTS (SELECT 1 FROM public.events WHERE id = OLD.event_id) INTO v_event_exists;
    IF NOT v_event_exists THEN
        RETURN OLD;
    END IF;

    -- Hanya bertindak jika frame yang dihapus adalah default
    IF OLD.is_default = TRUE THEN
        PERFORM 1 FROM public.events WHERE id = OLD.event_id FOR UPDATE;

        -- Cari frame tersisa berikutnya
        SELECT id INTO v_next_frame_id
        FROM public.event_frames
        WHERE event_id = OLD.event_id AND id != OLD.id
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1;

        -- Jika masih ada frame tersisa, promosikan menjadi default
        IF v_next_frame_id IS NOT NULL THEN
            UPDATE public.event_frames
            SET is_default = TRUE, updated_at = NOW()
            WHERE id = v_next_frame_id;
        END IF;
        -- Jika v_next_frame_id IS NULL: frame terakhir telah dihapus (0 frame tersisa), sah memiliki 0 default.
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_on_event_frame_deleted
    AFTER DELETE ON public.event_frames
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_event_frame_deletion();

-- 5. TAMBAH KOLOM SELECTED_FRAME_ID PADA PHOTOS (DENGAN ON DELETE SET NULL)
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES public.event_frames(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_photos_selected_frame_id ON public.photos(selected_frame_id);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.event_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can do anything on event_frames" ON public.event_frames
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view frames of their events" ON public.event_frames
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT id FROM public.events WHERE client_id = public.get_user_client_id())
    );

CREATE POLICY "Guests can view frames of active events" ON public.event_frames
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );

-- 7. DATA BACKFILL UNTUK EVENT EXISTING (IDEMPOTENT)
INSERT INTO public.event_frames (event_id, name, frame_path, sort_order, is_default)
SELECT 
    id AS event_id,
    'Frame Utama' AS name,
    frame_path,
    0 AS sort_order,
    TRUE AS is_default
FROM public.events
WHERE frame_path IS NOT NULL 
  AND frame_path <> ''
  AND NOT EXISTS (
      SELECT 1 FROM public.event_frames WHERE event_frames.event_id = events.id
  );
