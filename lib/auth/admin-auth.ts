import { cookies } from 'next/headers';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type EventAccessMode = 'read' | 'write';

export interface VerifyEventAccessResult {
  authorized: boolean;
  isSuperadmin: boolean;
  event?: any;
  error?: string;
  status: number;
}

/**
 * Validates whether the incoming request has authorization for the specified event.
 * Superadmin / Owner has full access (read & write) to manage any event and frames.
 * Client has read-only access strictly to events belonging to their client ID.
 * Write access (upload, edit, delete, set default frame) is strictly restricted to Superadmin/Owner.
 */
export async function verifyEventAccess(
  request: Request,
  eventId: string,
  mode: EventAccessMode = 'read'
): Promise<VerifyEventAccessResult> {
  if (!eventId) {
    return {
      authorized: false,
      isSuperadmin: false,
      error: 'Event ID is required',
      status: 400,
    };
  }

  const supabaseAdmin = createAdminClient();

  // 1. Fetch event to verify existence
  const { data: event, error: eventErr } = await (supabaseAdmin.from('events') as any)
    .select('*, client:clients(*)')
    .eq('id', eventId)
    .maybeSingle();

  if (eventErr || !event) {
    return {
      authorized: false,
      isSuperadmin: false,
      error: 'Event not found',
      status: 404,
    };
  }

  // 2. Read cookies and headers
  let ownerCookie: string | undefined;
  let clientCookie: string | undefined;

  // Check header 'cookie' directly
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...v] = part.trim().split('=');
      const val = v.join('=');
      if (k === 'owner_session') ownerCookie = decodeURIComponent(val);
      if (k === 'client_session') clientCookie = decodeURIComponent(val);
    }
  }

  // Also try next/headers cookies() if in Next request context
  if (!ownerCookie && !clientCookie) {
    try {
      const cookieStore = await cookies();
      ownerCookie = cookieStore.get('owner_session')?.value;
      clientCookie = cookieStore.get('client_session')?.value;
    } catch {
      // Running outside Next.js request context (e.g. test runner)
    }
  }

  const headerOwner = request.headers.get('x-owner-session');
  const headerClient = request.headers.get('x-client-session');
  const adminKey = request.headers.get('x-admin-key');

  // Service role / Admin Key check
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configuredAdminKey = process.env.ADMIN_API_KEY;
  if (adminKey && ((serviceKey && adminKey === serviceKey) || (configuredAdminKey && adminKey === configuredAdminKey))) {
    return {
      authorized: true,
      isSuperadmin: true,
      event,
      status: 200,
    };
  }

  // Check Supabase Auth user (via Bearer token or Server Supabase Cookies)
  let authUser: any = null;
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      if (user) authUser = user;
    }

    if (!authUser) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authUser = user;
    }
  } catch {
    // Ignore auth error, proceed with session cookies
  }

  // 3. Superadmin / Owner check
  if (ownerCookie || headerOwner) {
    return {
      authorized: true,
      isSuperadmin: true,
      event,
      status: 200,
    };
  }

  if (authUser) {
    // Check role in profiles
    const { data: profile } = await (supabaseAdmin.from('profiles') as any)
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profile?.role === 'owner' || authUser.user_metadata?.role === 'owner') {
      return {
        authorized: true,
        isSuperadmin: true,
        event,
        status: 200,
      };
    }
  }

  // 4. Client check
  const clientEmail = (
    clientCookie ||
    headerClient ||
    (authUser?.email && authUser.user_metadata?.role === 'client' ? authUser.email : null)
  )?.trim().toLowerCase();

  if (clientEmail) {
    const decodedEmail = decodeURIComponent(clientEmail);

    // Lookup client in database
    const { data: clientRecord } = await (supabaseAdmin.from('clients') as any)
      .select('id, contact_email, user_id')
      .ilike('contact_email', decodedEmail)
      .maybeSingle();

    const isEventClient =
      (event.client?.contact_email && event.client.contact_email.toLowerCase() === decodedEmail) ||
      (clientRecord && event.client_id === clientRecord.id) ||
      (authUser && clientRecord && clientRecord.user_id === authUser.id && event.client_id === clientRecord.id);

    if (isEventClient) {
      if (mode === 'write') {
        return {
          authorized: false,
          isSuperadmin: false,
          error: 'Forbidden: Only Superadmin/Owner is authorized to upload or manage frames.',
          status: 403,
        };
      }

      return {
        authorized: true,
        isSuperadmin: false,
        event,
        status: 200,
      };
    }

    // Client authenticated, but does not own this event
    return {
      authorized: false,
      isSuperadmin: false,
      error: 'Forbidden: You do not have permission to access this event',
      status: 403,
    };
  }

  // 5. No credentials provided
  return {
    authorized: false,
    isSuperadmin: false,
    error: 'Unauthorized: Authentication required',
    status: 401,
  };
}
