import { supabase } from './supabase';

/**
 * Cliente HTTP hacia el backend de Spring Boot (reemplaza supabase.from(...) /
 * supabase.functions.invoke(...) para todo lo que no sea autenticacion). Supabase sigue
 * usandose SOLO para Auth (login/sesion) y para leer el JWT que se manda a este backend.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    return data?.error || data?.message || `Error HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text || `Error HTTP ${response.status}`;
    } catch {
      return `Error HTTP ${response.status}`;
    }
  }
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  return handle<T>(response);
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export function apiUpload<T>(path: string, formData: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  return request<T>(path, { method, body: formData });
}

// ── Helpers especificos para el "acceso crudo" a fases_estado ───────────────────────────────
// (polling y escritura directa que varios componentes de fase hacian con supabase.from('fases_estado'))

export interface PhaseStateDto {
  estadoVisual: string | null;
  datosConsolidados: any;
  updatedAt: string | null;
}

export function getPhaseState(projectId: string, phaseNumber: number): Promise<PhaseStateDto> {
  return apiGet(`/api/projects/${projectId}/phases/${phaseNumber}/state`);
}

export function updatePhaseState(
  projectId: string,
  phaseNumber: number,
  patch: { estadoVisual?: string; datosConsolidados?: any }
): Promise<PhaseStateDto> {
  return apiPut(`/api/projects/${projectId}/phases/${phaseNumber}/state`, patch);
}

export function updatePhasesAfterState(
  projectId: string,
  phaseNumber: number,
  patch: { estadoVisual: string; datosConsolidados?: any }
): Promise<void> {
  return apiPut(`/api/projects/${projectId}/phases-after/${phaseNumber}/state`, patch);
}

export function runPhase(projectId: string, phaseNumber: number, body: Record<string, unknown> = {}): Promise<any> {
  return apiPost(`/api/projects/${projectId}/phases/${phaseNumber}/run`, body);
}
