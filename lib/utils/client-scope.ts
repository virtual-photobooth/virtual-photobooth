import { SupabaseClient } from '@supabase/supabase-js';
import { Event } from '@/lib/types/database';

export interface ClientScopeResult {
  client: { id: string; name: string; email?: string } | null;
  events: Event[];
  eventIds: string[];
}

export async function getClientScope(supabase: SupabaseClient): Promise<ClientScopeResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userEmail = user?.email || null;
    let userId = user?.id || null;

    if (typeof window !== 'undefined' && (!userEmail || !userId)) {
      const storedSession = localStorage.getItem('client_session');
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed.email) userEmail = parsed.email;
        } catch (e) {
          // ignore
        }
      }
    }

    if (!userId && !userEmail) {
      return { client: null, events: [], eventIds: [] };
    }

    // Query client matching user_id or email
    let query = (supabase.from('clients') as any).select('id, name, contact_email, user_id');
    if (userId && userEmail) {
      query = query.or(`user_id.eq.${userId},contact_email.ilike.${userEmail}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (userEmail) {
      query = query.ilike('contact_email', userEmail);
    }

    const { data: clientsData } = await query;

    if (!clientsData || clientsData.length === 0) {
      return {
        client: null,
        events: [],
        eventIds: [],
      };
    }

    const client = clientsData[0];
    const clientIds = clientsData.map((c: any) => c.id);

    const { data: eventsData } = await (supabase.from('events') as any)
      .select('*')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false });

    const events = (eventsData as Event[]) || [];
    const eventIds = events.map((e) => e.id);

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.contact_email || userEmail || undefined,
      },
      events,
      eventIds,
    };
  } catch (err) {
    console.error('Error fetching client scope:', err);
    return { client: null, events: [], eventIds: [] };
  }
}
