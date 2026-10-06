import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: () => getSession() } } }));

import { apiDelete, apiGet, apiPost, apiUpload, getPhaseState, runPhase, updatePhaseState } from './api';

const fetchMock = vi.fn();

function respuesta(status: number, body?: unknown) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(status === 204 ? null : text, { status });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-de-prueba' } } });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('cliente de la API', () => {
  it('envia el token de la sesion al backend', async () => {
    fetchMock.mockResolvedValue(respuesta(200, [{ id: 'p1' }]));

    const data = await apiGet<{ id: string }[]>('/api/projects');

    expect(data).toEqual([{ id: 'p1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/projects');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-de-prueba');
  });

  it('sin sesion no envia cabecera de autorizacion', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(respuesta(200, {}));

    await apiGet('/api/public/encuestas/abc');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('POST con cuerpo lo envia como JSON', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { ok: true }));

    await apiPost('/api/projects', { projectName: 'PMO' });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"projectName":"PMO"}');
  });

  it('POST sin cuerpo no declara Content-Type', async () => {
    fetchMock.mockResolvedValue(respuesta(204));

    await expect(apiPost('/api/projects/p1/trash')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  it('una subida de archivos deja que el navegador ponga el Content-Type', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { id: 'd1' }));
    const form = new FormData();
    form.append('file', new Blob(['%PDF']), 'doc.pdf');

    await apiUpload('/api/projects/p1/documentos', form, 'PUT');

    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('muestra el mensaje de error que devuelve el backend', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { success: false, error: 'Proyecto no encontrado' }));

    await expect(apiDelete('/api/projects/x')).rejects.toThrow('Proyecto no encontrado');
  });

  it('si el error no es JSON usa el texto o el codigo HTTP', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(502, 'Bad Gateway'));
    await expect(apiGet('/api/projects')).rejects.toThrow('Bad Gateway');

    fetchMock.mockResolvedValueOnce(respuesta(500, ''));
    await expect(apiGet('/api/projects')).rejects.toThrow('Error HTTP 500');
  });

  it('una respuesta vacia se devuelve como undefined', async () => {
    fetchMock.mockResolvedValue(respuesta(200, ''));

    await expect(apiGet('/api/projects')).resolves.toBeUndefined();
  });

  it('los atajos de fases llaman a las rutas correctas', async () => {
    fetchMock.mockImplementation(async () => respuesta(200, {}));

    await getPhaseState('p1', 3);
    await updatePhaseState('p1', 7, { estadoVisual: 'disponible' });
    await runPhase('p1', 4, { iteration: 2 });

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET http://api.test/api/projects/p1/phases/3/state',
      'PUT http://api.test/api/projects/p1/phases/7/state',
      'POST http://api.test/api/projects/p1/phases/4/run',
    ]);
  });
});
