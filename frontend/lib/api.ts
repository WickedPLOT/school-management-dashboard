const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  // Don't set Content-Type for FormData - let browser handle it
  const headers: HeadersInit = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const base = API.replace(/\/+$/, '');

  // Use AbortController for timeout (60s for large uploads, 15s otherwise)
  const isLargeBody = typeof options.body === 'string' && options.body.length > 500_000;
  const timeout = isLargeBody ? 120_000 : 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection and try again.');
    throw new Error('Network error — unable to reach the server. Please check your internet connection.');
  }
  clearTimeout(timer);

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(res.ok ? 'Server returned an invalid response' : text.slice(0, 200) || 'Request failed');
    }
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) throw new Error(data?.error || data?.message || 'Request failed');
  return data;
}
