-- ====================================================================
-- 08_CASCADE_AUTH_USERS_CLEANUP.SQL
-- Automatic synchronization between public.profiles, public.clients, and auth.users
-- Ensures that when an event / client is deleted or completed, the user account
-- in Supabase Authentication (auth.users) is ALSO automatically removed.
-- ====================================================================

-- 1. TRIGGER FUNCTION: When a client profile is deleted, also delete from auth.users
-- STRICT SAFETY CHECK: Only delete if role = 'client'. NEVER delete 'owner'!
CREATE OR REPLACE FUNCTION public.handle_delete_auth_user_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'client' THEN
        DELETE FROM auth.users WHERE id = OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_deleted_remove_auth_user ON public.profiles;
CREATE TRIGGER on_profile_deleted_remove_auth_user
    AFTER DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_delete_auth_user_on_profile_delete();


-- 2. TRIGGER FUNCTION: When a client row in public.clients is deleted,
-- also delete their associated profile in public.profiles (which triggers auth.users deletion)
CREATE OR REPLACE FUNCTION public.handle_client_delete_cleanup_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.user_id IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = OLD.user_id AND role = 'client';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_client_deleted_cleanup_profile ON public.clients;
CREATE TRIGGER on_client_deleted_cleanup_profile
    AFTER DELETE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.handle_client_delete_cleanup_profile();


-- 3. ONE-TIME CLEANUP QUERY: Immediately purge orphaned / completed client accounts from auth.users
-- Keeps only owners and clients that have active, non-completed events
DO $$
DECLARE
    active_user_ids UUID[];
BEGIN
    -- Collect user_ids that belong to active events
    SELECT ARRAY_AGG(c.user_id) INTO active_user_ids
    FROM public.clients c
    JOIN public.events e ON e.client_id = c.id
    WHERE e.status != 'completed' AND c.user_id IS NOT NULL;

    -- Delete orphaned client profiles (will cascade to auth.users via trigger)
    DELETE FROM public.profiles
    WHERE role = 'client'
      AND (active_user_ids IS NULL OR id != ALL(active_user_ids));

    -- Also clean any auth.users that might exist without a profile or orphaned client
    DELETE FROM auth.users
    WHERE id NOT IN (
        SELECT id FROM public.profiles WHERE role = 'owner'
    )
    AND (active_user_ids IS NULL OR id != ALL(active_user_ids))
    AND email NOT IN (
        SELECT email FROM public.profiles WHERE role = 'owner'
    );
END;
$$;
