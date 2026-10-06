import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hook = vi.hoisted(() => ({
  updatePhase: vi.fn(),
  updateAgent: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  saveGuide: vi.fn(),
  deleteGuide: vi.fn(),
}));

vi.mock('../../../hooks/useFasesConfig', () => ({
  useFasesConfig: () => ({
    isLoading: false,
    isSaving: false,
    fetchConfig: vi.fn(),
    ...hook,
    config: {
      fases: [
        { numero: 4, codigo: 'F4', nombre: 'Diagnostico de idoneidad', orden: 4, visible: true, requiereCompletas: [5], leeResultadoDe: [5] },
        { numero: 5, codigo: 'F5', nombre: 'Diagnóstico de madurez', orden: 5, visible: true, requiereCompletas: [4], leeResultadoDe: [4] },
      ],
      agentes: [{
        id: 'a7', faseNumero: 7, nombreFase: 'Guía metodológica', promptSistema: 'Eres el agente 7', modelo: null,
        temperatura: 1, instruccionesSalida: 'Devuelve JSON', maxOutputTokens: 65536, timeoutMs: 280000, sinRazonamiento: false,
      }],
      categoriasDocumento: [
        { codigo: 'D01', nombre: 'Organigrama', orden: 1, esVisual: true, esOtros: false },
        { codigo: 'D16', nombre: 'Otros', orden: 16, esVisual: false, esOtros: true },
      ],
      guiasReferencia: [{ clave: 'pmbok_8', nombre: 'PMBOK 8', url: 'https://guias/pmbok.md', orden: 1, activa: true }],
    },
  }),
}));

import { FasesSection } from './FasesSection';

beforeEach(() => {
  Object.values(hook).forEach(fn => fn.mockReset().mockResolvedValue(true));
});

describe('Administracion > Fases y agentes', () => {
  it('muestra las fases y guarda un cambio de nombre y dependencias', () => {
    render(<FasesSection />);

    const nombre = screen.getByDisplayValue('Diagnóstico de madurez');
    fireEvent.change(nombre, { target: { value: 'Madurez' } });
    // En la fila de la fase 5 se quita la dependencia de F4 ("Debe estar completo antes").
    fireEvent.click(screen.getAllByRole('button', { name: 'F4' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(hook.updatePhase).toHaveBeenCalledWith(5, { nombre: 'Madurez', requiereCompletas: [], leeResultadoDe: [4] });
  });

  it('edita los parametros de un agente', () => {
    render(<FasesSection />);
    fireEvent.click(screen.getByRole('button', { name: /Agentes/ }));

    fireEvent.change(screen.getByDisplayValue('65536'), { target: { value: '32768' } });
    fireEvent.click(screen.getByLabelText(/Sin razonamiento interno/));
    fireEvent.click(screen.getByRole('button', { name: /Guardar agente/ }));

    expect(hook.updateAgent).toHaveBeenCalledWith(7, expect.objectContaining({
      maxOutputTokens: 32768, timeoutMs: 280000, sinRazonamiento: true, promptSistema: 'Eres el agente 7',
    }));
  });

  it('la categoria "Otros" no se puede eliminar', () => {
    render(<FasesSection />);
    fireEvent.click(screen.getByRole('button', { name: /Categorías de documentos/ }));

    expect(screen.getAllByTitle('Eliminar categoría')).toHaveLength(1);
  });

  it('agrega una categoria con el siguiente codigo sugerido', () => {
    render(<FasesSection />);
    fireEvent.click(screen.getByRole('button', { name: /Categorías de documentos/ }));

    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva categoría'), { target: { value: 'Actas' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }));

    expect(hook.saveCategory).toHaveBeenCalledWith('D17', { nombre: 'Actas', esVisual: false });
  });

  it('desactiva una guia de referencia', () => {
    render(<FasesSection />);
    fireEvent.click(screen.getByRole('button', { name: /Guías de la fase 7/ }));

    fireEvent.click(screen.getByLabelText('Activa'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(hook.saveGuide).toHaveBeenCalledWith('pmbok_8', { nombre: 'PMBOK 8', url: 'https://guias/pmbok.md', activa: false });
  });
});
