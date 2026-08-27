const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: any
): Promise<T> {
  // 1. Dual Token Check (Fallback to 'token' if 'studyos_token' missing)
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('studyos_token') || localStorage.getItem('token')
      : null;

  const headers: Record<string, string> = {};

  // 2. Set Content-Type (Automatically omit for FormData file uploads)
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
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
      message: error.message || 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      status: 500,
      response: { data: null },
    };
  }
}