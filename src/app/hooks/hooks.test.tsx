import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));
vi.mock('../lib/api', () => api);

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const updatePhaseStatus = vi.hoisted(() => vi.fn());
vi.mock('../context/AppContext', () => ({ useApp: () => ({ updatePhaseStatus }) }));

import { useAdminUsers, useAiModelSettings } from './useAdmin';
import { useCancelAgent } from './useCancelAgent';
import { useEncuestaExterna } from './useEncuestaExterna';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('encuesta publica (enlace compartido)', () => {
  it('carga las preguntas del enlace y las adapta al formato de la pantalla', async () => {
    api.apiGet.mockResolvedValue({
      proyectoId: 'p1',
      tipoEncuesta: 'idoneidad',
      preguntas: [{ id: 'q1', codigo: 'C01', categoria: 'Cultura', textoPregunta: '¿Apertura al cambio?' }],
    });

    const { result } = renderHook(() => useEncuestaExterna('token-123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.apiGet).toHaveBeenCalledWith('/api/public/encuestas/token-123');
    expect(result.current.linkInfo).toEqual({ proyecto_id: 'p1', tipo_encuesta: 'idoneidad' });
    expect(result.current.preguntas[0]).toEqual({ id: 'q1', codigo: 'C01', categoria: 'Cultura', texto_pregunta: '¿Apertura al cambio?' });
    expect(result.current.error).toBeNull();
  });

  it('un enlace vencido muestra un mensaje claro', async () => {
    api.apiGet.mockRejectedValue(new Error('El enlace de la encuesta es invalido o ha expirado.'));

    const { result } = renderHook(() => useEncuestaExterna('vencido'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('El enlace de la encuesta es inválido o ha expirado.');
    expect(result.current.preguntas).toEqual([]);
  });

  it('sin token no llama a la API', async () => {
    const { result } = renderHook(() => useEncuestaExterna(''));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Token no válido');
    expect(api.apiGet).not.toHaveBeenCalled();
  });

  it('envia las respuestas al enlace', async () => {
    api.apiGet.mockResolvedValue({ proyectoId: 'p1', tipoEncuesta: 'idoneidad', preguntas: [] });
    api.apiPost.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEncuestaExterna('token-123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.submitRespuestas('Ana', 'PMO', 'TI', { q1: 4 }));

    expect(api.apiPost).toHaveBeenCalledWith('/api/public/encuestas/token-123/respuestas',
      { nombre: 'Ana', cargo: 'PMO', area: 'TI', respuestas: { q1: 4 } });
  });
});

describe('cancelar un agente en ejecucion', () => {
  it('avisa al backend y deja la fase disponible', async () => {
    api.apiPost.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCancelAgent('p1', 5));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.cancel(); });

    expect(ok).toBe(true);
    expect(api.apiPost).toHaveBeenCalledWith('/api/projects/p1/phases/5/cancel');
    expect(updatePhaseStatus).toHaveBeenCalledWith('p1', 5, 'disponible');
    expect(toast.info).toHaveBeenCalled();
    expect(result.current.isCancelling).toBe(false);
  });

  it('si el backend falla no cambia el estado local', async () => {
    api.apiPost.mockRejectedValue(new Error('Sin conexion'));
    const { result } = renderHook(() => useCancelAgent('p1', 5));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.cancel(); });

    expect(ok).toBe(false);
    expect(updatePhaseStatus).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo cancelar', { description: 'Sin conexion' });
  });
});

describe('panel de administracion', () => {
  it('muestra los usuarios con su estado y fecha', async () => {
    api.apiGet.mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@acme.com', role: 'admin', updatedAt: '2026-10-01T10:00:00Z', active: true },
      { id: 'u2', name: null, email: null, role: 'auditor', updatedAt: null, active: false },
    ]);

    const { result } = renderHook(() => useAdminUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users[0]).toMatchObject({ name: 'Ana', role: 'admin', active: true });
    expect(result.current.users[1]).toMatchObject({ name: 'Sin nombre', email: '', lastAccess: 'Sin registro', active: false });
  });

  it('crear y desactivar usuarios recarga la lista', async () => {
    api.apiGet.mockResolvedValue([]);
    api.apiPost.mockResolvedValue(undefined);
    api.apiPatch.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAdminUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.createUser('Luis', 'luis@acme.com', 'Clave123*', 'auditor'));
    await act(() => result.current.toggleUserActive('u1', true));

    expect(api.apiPost).toHaveBeenCalledWith('/api/admin/users', { name: 'Luis', email: 'luis@acme.com', password: 'Clave123*', role: 'auditor' });
    expect(api.apiPatch).toHaveBeenCalledWith('/api/admin/users/u1/active');
    expect(api.apiGet).toHaveBeenCalledTimes(3);
  });

  it('si no carga la configuracion del modelo usa la de por defecto', async () => {
    api.apiGet.mockRejectedValue(new Error('403'));

    const { result } = renderHook(() => useAiModelSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings.selectedModel).toBe('gemini-flash-latest');
    expect(toast.error).toHaveBeenCalled();
  });

  it('guardar el modelo actualiza la configuracion mostrada', async () => {
    api.apiGet.mockResolvedValue({ id: 'global', provider: 'gemini', selectedModel: 'gemini-flash-latest', fallbackModel: 'gemini-flash-lite-latest' });
    api.apiPut.mockResolvedValue({ id: 'global', provider: 'gemini', selectedModel: 'gemini-pro-latest', fallbackModel: 'gemini-flash-latest' });
    const { result } = renderHook(() => useAiModelSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.updateSelectedModel('gemini-pro-latest', 'gemini-flash-latest'));

    expect(api.apiPut).toHaveBeenCalledWith('/api/ai-model-settings', { selectedModel: 'gemini-pro-latest', fallbackModel: 'gemini-flash-latest' });
    expect(result.current.settings.selectedModel).toBe('gemini-pro-latest');
  });
});
