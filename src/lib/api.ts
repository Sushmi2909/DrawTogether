const ENV_URL = (() => {
  try { return process.env?.EXPO_PUBLIC_API_URL; } catch { return undefined; }
})();

let BASE_URL = ENV_URL || 'https://drawtogetherserver.onrender.com';

try {
  if (typeof window !== 'undefined' && window.location && !ENV_URL) {
    const host = window.location.hostname;
    BASE_URL = `http://${host}:8080`;
  }
} catch {}

export { BASE_URL };

function timeout(ms: number) {
  return new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Server unreachable at ${BASE_URL} (timeout ${ms}ms)`)), ms));
}

async function request(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`;

  const res = await Promise.race([
    fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    }),
    timeout(5000),
  ]) as Response;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }

export const api = {
  register: (email: string, password: string) =>
    request('/api/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  listDrawings: (token: string) =>
    request('/api/drawings', { headers: authHeaders(token) }),

  getDrawing: (token: string, id: string) =>
    request(`/api/drawings/${id}`, { headers: authHeaders(token) }),

  saveDrawing: (token: string, data: { title?: string; strokes?: any[]; thumbnail?: string | null; room?: string; docSize?: { w: number; h: number }; starred?: boolean; imageLayer?: any }, id?: string) => {
    if (id) {
      return request(`/api/drawings/${id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data) });
    }
    return request('/api/drawings', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) });
  },

  deleteDrawing: (token: string, id: string) =>
    request(`/api/drawings/${id}`, { method: 'DELETE', headers: authHeaders(token) }),

  createRoom: (token: string, name: string) =>
    request('/api/rooms', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ name }) }),

  joinRoom: (token: string, code: string) =>
    request('/api/rooms/join', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ code }) }),
};
