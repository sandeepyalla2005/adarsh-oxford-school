import { supabase } from "@/integrations/supabase/client";
import { API_BASE_URL } from "./runtime-config";

const DEV_FALLBACK_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If not running on localhost/127.0.0.1 and not in local dev mode, default to the production backend
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && !import.meta.env.DEV) {
      return "https://backend-8xzd.onrender.com";
    }
  }

  const configured = API_BASE_URL.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (import.meta.env.DEV) {
    return DEV_FALLBACK_API_BASE_URL;
  }

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return DEV_FALLBACK_API_BASE_URL;
  }

  return "";
}

export function buildApiUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  const normalizedPath = normalizePath(path);
  const baseUrl = getApiBaseUrl();
  const url = baseUrl
    ? new URL(normalizedPath, `${baseUrl}/`)
    : new URL(normalizedPath, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

let _sessionCache: { session: any; expires: number } | null = null;

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let session = null;
  const now = Date.now();

  if (_sessionCache && _sessionCache.expires > now) {
    session = _sessionCache.session;
  } else {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    // Cache session for 10 seconds to reduce overhead on burst requests
    _sessionCache = { session, expires: now + 10000 };
  }
  
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
}

// Clear session cache on auth state changes to avoid stale/missing tokens
supabase.auth.onAuthStateChange(() => {
  _sessionCache = null;
});
