import type { ChangelogEntry } from './types';

export interface AuthResponse {
  token: string;
  nickname: string;
  chipBalance: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '請求失敗');
  return data;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '請求失敗');
  return data;
}

export function register(nickname: string, password: string) {
  return post<AuthResponse>('/register', { nickname, password });
}

export function login(nickname: string, password: string) {
  return post<AuthResponse>('/login', { nickname, password });
}

export function getChangelog() {
  return get<{ entries: ChangelogEntry[] }>('/changelog');
}
