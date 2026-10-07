// Local development uses the local API by default. Deployed builds must explicitly
// configure a public backend URL instead of silently calling each visitor's localhost.
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL = (configuredApiBaseUrl || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api/v1' : '')).replace(/\/+$/, '');

function assertApiConfigured() {
  if (!API_BASE_URL) {
    throw {
      message: 'Backend API URL is not configured. Set NEXT_PUBLIC_API_BASE_URL in the Vercel project settings and redeploy.',
      code: 'API_NOT_CONFIGURED',
      status: 500,
      response: { data: null },
    };
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const GET_CACHE_TTL_MS = 15_000;
const getResponseCache = new Map<string, { expiresAt: number; data: unknown }>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

function getRequestCacheKey(endpoint: string) {
  return `cookie-session:${endpoint}`;
}

export function getCachedApiResponse<T>(endpoint: string): T | null {
  if (typeof window === 'undefined') return null;
  const cached = getResponseCache.get(getRequestCacheKey(endpoint));
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) getResponseCache.delete(getRequestCacheKey(endpoint));
    return null;
  }
  return cached.data as T;
}

export function clearApiResponseCache() {
  cacheGeneration += 1;
  getResponseCache.clear();
  inFlightGetRequests.clear();
}

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: unknown
): Promise<T> {
  assertApiConfigured();
  const isGetRequest = method === 'GET';
  const cacheKey = isGetRequest ? getRequestCacheKey(endpoint) : '';

  if (isGetRequest) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data as T;
    if (cached) getResponseCache.delete(cacheKey);
    const pendingRequest = inFlightGetRequests.get(cacheKey);
    if (pendingRequest) return pendingRequest as Promise<T>;
  } else {
    // Any write can affect another screen's data, so discard cached GET responses.
    clearApiResponseCache();
  }

  const headers: Record<string, string> = {};

  // 2. Set Content-Type (Automatically omit for FormData file uploads)
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const requestGeneration = cacheGeneration;
  const request = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        credentials: 'include',
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('studyos_token');
          localStorage.removeItem('token');
          localStorage.removeItem('studyos_user');
          sessionStorage.removeItem('studyos_token');
          window.dispatchEvent(new Event('studyos:unauthorized'));
        }

        let extractedMessage = 'API Request Failed';
        const extractedCode = data?.code || data?.error?.code || null;

        if (typeof data?.error === 'string') {
          extractedMessage = data.error;
        } else if (typeof data?.error?.message === 'string') {
          extractedMessage = data.error.message;
        } else if (typeof data?.message === 'string') {
          extractedMessage = data.message;
        }

        throw {
          message: extractedMessage,
          code: extractedCode,
          status: response.status,
          response: { data },
        };
      }

      if (isGetRequest && requestGeneration === cacheGeneration) {
        getResponseCache.set(cacheKey, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
      }
      if (!isGetRequest) clearApiResponseCache();
      return data as T;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) throw error;

      throw {
        message: API_BASE_URL.includes('localhost')
          ? 'Could not reach your local backend. Make sure the server is running on port 5000 and allow this site to access your local network in the browser.'
          : error instanceof Error ? error.message : 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
        status: 500,
        response: { data: null },
      };
    }
  })();

  if (isGetRequest) {
    inFlightGetRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (inFlightGetRequests.get(cacheKey) === request) inFlightGetRequests.delete(cacheKey);
    }
  }

  return request;
}

export async function downloadApiFile(endpoint: string) {
  assertApiConfigured();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'The file could not be downloaded.');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
  const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].replace(/^"|"$/g, '')) : '';
  return { blob: await response.blob(), filename };
}
