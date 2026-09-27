// Browser requests from the deployed frontend intentionally target the user's local API by default.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: any
): Promise<T> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const sessionToken = window.sessionStorage.getItem('studyos_token');
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  }

  // 2. Set Content-Type (Automatically omit for FormData file uploads)
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

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

      // 3. Bulletproof Safe String Extraction for Errors
      let extractedMessage = 'API Request Failed';
      let extractedCode = data?.code || data?.error?.code || null;

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
        response: { data }, // Preserves structure for err.response.data checks
      };
    }

    return data as T;
  } catch (error: any) {
    // Re-throw standardized error shape
    if (error.status) throw error;
    
    throw {
      message: API_BASE_URL.includes('localhost')
        ? 'Could not reach your local backend. Make sure the server is running on port 5000 and allow this site to access your local network in the browser.'
        : error.message || 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      status: 500,
      response: { data: null },
    };
  }
}
