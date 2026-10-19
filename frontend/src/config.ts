const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  // 1. If explicitly configured via VITE_API_URL, use it
  if (rawApiUrl) {
    return rawApiUrl;
  }

  // 2. When deployed on Vercel, route all API and WebSocket requests to the Render backend
  if (window.location.hostname.includes('vercel.app')) {
    return 'https://linkforge-3b33.onrender.com';
  }

  // 3. When running in Vite dev server (e.g. localhost:5173), route to local backend
  if (window.location.hostname === 'localhost' && window.location.port !== '3000') {
    return 'http://localhost:3000';
  }

  // 4. When served directly by the unified Express server on the same domain/port, use relative paths
  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

