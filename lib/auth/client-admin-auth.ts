'use client';

/**
 * Client-Side Admin Authentication Helper
 * Ensures all admin-side API requests seamlessly pass authentication credentials
 * via both headers (x-owner-session, x-client-session) and cookies (owner_session, client_session).
 */

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()?.split(';').shift() || '');
  }
  return null;
}

/**
 * Returns authentication headers for Admin API requests and ensures
 * localStorage and document.cookie remain synchronized.
 */
export function getAdminAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };

  if (typeof window === 'undefined') return headers;

  let ownerSession = localStorage.getItem('owner_session') || getCookieValue('owner_session');
  let clientSession = localStorage.getItem('client_session') || getCookieValue('client_session');

  // In local development, ensure owner session is active for all admin API operations
  if (!ownerSession) {
    const isLocal =
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.');

    if (isLocal) {
      ownerSession = 'owner@photobooth.com';
      try {
        localStorage.setItem('owner_session', ownerSession);
      } catch (e) {}
    }
  }

  // Ensure document.cookie is synchronized with active session
  if (ownerSession && !getCookieValue('owner_session')) {
    document.cookie = `owner_session=${encodeURIComponent(ownerSession)}; path=/; max-age=86400; SameSite=Lax`;
  }
  if (clientSession && !getCookieValue('client_session')) {
    document.cookie = `client_session=${encodeURIComponent(clientSession)}; path=/; max-age=86400; SameSite=Lax`;
  }

  // Ensure localStorage is synchronized with active session
  const activeOwnerCookie = getCookieValue('owner_session');
  const activeClientCookie = getCookieValue('client_session');
  if (activeOwnerCookie && !localStorage.getItem('owner_session')) {
    try {
      localStorage.setItem('owner_session', activeOwnerCookie);
    } catch (e) {}
  }
  if (activeClientCookie && !localStorage.getItem('client_session')) {
    try {
      localStorage.setItem('client_session', activeClientCookie);
    } catch (e) {}
  }

  const effectiveOwner = ownerSession || activeOwnerCookie;
  const effectiveClient = clientSession || activeClientCookie;

  // For Admin operations, prioritize Owner / Superadmin access
  if (effectiveOwner) {
    headers['x-owner-session'] = effectiveOwner;
  } else if (effectiveClient) {
    headers['x-client-session'] = effectiveClient;
  }

  return headers;
}

/**
 * Drop-in wrapper for fetch() in admin components.
 * Automatically injects admin auth headers and includes credentials.
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const existingHeaders: Record<string, string> = {};

  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((val, key) => {
        existingHeaders[key] = val;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, val] of init.headers) {
        existingHeaders[key] = val;
      }
    } else {
      Object.assign(existingHeaders, init.headers);
    }
  }

  const authHeaders = getAdminAuthHeaders(existingHeaders);

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: authHeaders,
  });
}
