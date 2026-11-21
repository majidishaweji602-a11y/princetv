import type { PublicConfig } from '../types';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'starrflix', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error || `Request failed (${res.status})`), { status: res.status });
  return body as T;
}

export const EMPTY_CONFIG: PublicConfig = { settings: { announcement: '', maintenance: false }, featured: [], hidden: [] };

export const getPublicConfig = () => fetch('/api/public/config').then((r) => (r.ok ? (r.json() as Promise<PublicConfig>) : EMPTY_CONFIG)).catch(() => EMPTY_CONFIG);

export interface AdminUser { id: string; name: string; email: string; role: 'viewer' | 'editor'; status: 'active' | 'suspended'; created: number }
export interface AdminStats {
  visits: number; today: number; uptimeSec: number;
  topPaths: { path: string; views: number }[]; daily: { date: string; views: number }[];
  users: number; errors: number;
}
export interface ErrorLog { ts: number; message: string; source: string; path?: string }

export const adminApi = {
  me: () => api<{ username: string }>('/api/admin/me'),
  login: (username: string, password: string) => api<{ username: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api<{ ok: true }>('/api/admin/logout', { method: 'POST' }),
  stats: () => api<AdminStats>('/api/admin/stats'),
  config: () => api<PublicConfig>('/api/admin/config'),
  saveSettings: (s: PublicConfig['settings']) => api<PublicConfig>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(s) }),
  saveFeatured: (f: PublicConfig['featured']) => api<PublicConfig>('/api/admin/featured', { method: 'PUT', body: JSON.stringify(f) }),
  saveHidden: (h: string[]) => api<PublicConfig>('/api/admin/hidden', { method: 'PUT', body: JSON.stringify(h) }),
  users: () => api<AdminUser[]>('/api/admin/users'),
  addUser: (u: Pick<AdminUser, 'name' | 'email' | 'role'>) => api<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(u) }),
  updateUser: (id: string, patch: Partial<AdminUser>) => api<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteUser: (id: string) => api<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  errors: () => api<ErrorLog[]>('/api/admin/errors'),
  clearErrors: () => api<{ ok: true }>('/api/admin/errors', { method: 'DELETE' }),
};
