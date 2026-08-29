-- ========================================================
-- FIX RLS POLICIES FOR VIRTUAL PHOTOBOOTH GUEST & GALLERY
-- ========================================================

-- Enable RLS on tables
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;

-- 1. DROP EXISTING POLICIES IF THEY EXIST TO PREVENT CONFLICTS
DROP POLICY IF EXISTS "Public Read Access for Photos of Active Events" ON public.photos;
DROP POLICY IF EXISTS "Public Read Access for Guests of Active Events" ON public.guests;
DROP POLICY IF EXISTS "Public Read Access for Voice Messages of Active Events" ON public.voice_messages;
DROP POLICY IF EXISTS "Guests can upload photos to active events" ON public.photos;
DROP POLICY IF EXISTS "Guests can register themselves for active events" ON public.guests;
DROP POLICY IF EXISTS "Guests can upload voice_messages to active enabled events" ON public.voice_messages;

-- 2. ALLOW PUBLIC/ANON READ ACCESS FOR GALLERY DISPLAY
CREATE POLICY "Public Read Access for Photos of Active Events" ON public.photos
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active'));

CREATE POLICY "Public Read Access for Guests of Active Events" ON public.guests
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active'));

CREATE POLICY "Public Read Access for Voice Messages of Active Events" ON public.voice_messages
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active'));

-- 3. ALLOW GUEST INSERT ACCESS FOR PHOTOBOOTH SUBMISSION
CREATE POLICY "Guests can register themselves for active events" ON public.guests
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );

CREATE POLICY "Guests can upload photos to active events" ON public.photos
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );

CREATE POLICY "Guests can upload voice_messages to active enabled events" ON public.voice_messages
    FOR INSERT TO anon, authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'active')
    );
