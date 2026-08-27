-- ========================================================
-- VIRTUAL PHOTOBOOTH - DATABASE MIGRATION & RLS POLICIES
-- ========================================================

-- 1. ENUMS
CREATE TYPE public.user_role AS ENUM ('owner', 'client');
CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'completed', 'inactive');

-- 2. PROFILES TABLE (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role public.user_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    monogram TEXT DEFAULT 'C | B',
    subtitle TEXT DEFAULT 'WEDDING',
    slug TEXT UNIQUE NOT NULL,
    event_date DATE NOT NULL,
    status public.event_status NOT NULL DEFAULT 'draft',
    frame_path TEXT,
    cover_path TEXT,
    photo_count INT NOT NULL DEFAULT 4 CHECK (photo_count > 0),
    countdown_seconds INT NOT NULL DEFAULT 3 CHECK (countdown_seconds >= 1),
    is_voice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    voice_retention_days INT NOT NULL DEFAULT 7 CHECK (voice_retention_days >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events(client_id);

-- 5. GUESTS TABLE
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    instagram TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON public.guests(event_id);

-- 6. PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    final_photo_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_event_id ON public.photos(event_id);

-- 7. VOICE MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.voice_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    audio_path TEXT NOT NULL,
    duration_seconds INT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_messages_event_id ON public.voice_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_voice_messages_expiration ON public.voice_messages(expires_at) WHERE is_deleted = FALSE;

-- ========================================================
-- HELPER FUNCTIONS FOR RLS
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Owners can do anything on profiles" ON public.profiles
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- CLIENTS POLICIES
CREATE POLICY "Owners can do anything on clients" ON public.clients
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view own client record" ON public.clients
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- EVENTS POLICIES
CREATE POLICY "Owners can do anything on events" ON public.events
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view own assigned events" ON public.events
    FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());

CREATE POLICY "Guests can view active events by slug" ON public.events
    FOR SELECT TO anon, authenticated USING (status = 'active');

-- GUESTS POLICIES
CREATE POLICY "Owners can do anything on guests" ON public.guests
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view guests of their events" ON public.guests
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT id FROM public.events WHERE client_id = public.get_user_client_id())
    );

CREATE POLICY "Guests can register themselves for active events" ON public.guests
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );

-- PHOTOS POLICIES
CREATE POLICY "Owners can do anything on photos" ON public.photos
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view photos of their events" ON public.photos
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT id FROM public.events WHERE client_id = public.get_user_client_id())
    );

CREATE POLICY "Guests can upload photos to active events" ON public.photos
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );

-- VOICE MESSAGES POLICIES
CREATE POLICY "Owners can do anything on voice_messages" ON public.voice_messages
    FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Clients can view voice_messages of their events" ON public.voice_messages
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT id FROM public.events WHERE client_id = public.get_user_client_id())
    );

CREATE POLICY "Guests can upload voice_messages to active enabled events" ON public.voice_messages
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active' AND is_voice_enabled = true)
    );

-- ========================================================
-- STORAGE BUCKET & STORAGE POLICIES
-- ========================================================

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('virtual-photobooth', 'virtual-photobooth', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Anyone can read frames or photos/voices
CREATE POLICY "Public Read Access for Storage" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'virtual-photobooth');

-- Storage Policy: Owners have full control over storage
CREATE POLICY "Owner Full Access for Storage" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'virtual-photobooth' AND public.is_owner())
    WITH CHECK (bucket_id = 'virtual-photobooth' AND public.is_owner());

-- Storage Policy: Guests/Anon can upload to photos/ or voices/ subfolders
CREATE POLICY "Guest Upload Access for Photos and Voices" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        bucket_id = 'virtual-photobooth' AND (
            (storage.foldername(name))[1] = 'events' AND (
                (storage.foldername(name))[3] IN ('photos', 'voices')
            )
        )
    );
