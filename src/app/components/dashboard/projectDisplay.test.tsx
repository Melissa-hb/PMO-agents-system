import { describe, expect, it } from 'vitest';
import { assignedConsultants, formatLastActivity, projectSubtitle } from './projectDisplay';

describe('ultima actividad de un proyecto', () => {
  const now = new Date(2026, 9, 8, 15, 0);

  it('se expresa en lenguaje natural', () => {
    expect(formatLastActivity(new Date(2026, 9, 8, 9, 0).toISOString(), now)).toBe('Hoy');
    expect(formatLastActivity(new Date(2026, 9, 7, 23, 0).toISOString(), now)).toBe('Ayer');
    expect(formatLastActivity(new Date(2026, 9, 1).toISOString(), now)).toBe('Hace 7 días');
    expect(formatLastActivity(new Date(2026, 7, 20).toISOString(), now)).toBe('Hace 1 mes');
    expect(formatLastActivity(new Date(2026, 4, 20).toISOString(), now)).toBe('Hace 4 meses');
    expect(formatLastActivity(new Date(2024, 4, 20).toISOString(), now)).toBe('Hace 2 años');
  });

  it('sin dato no inventa una fecha', () => {
    expect(formatLastActivity(null, now)).toBe('Sin actividad');
    expect(formatLastActivity('no es fecha', now)).toBe('Sin actividad');
  });
});

describe('fila de proyecto', () => {
  it('no repite la descripcion cuando es igual al nombre de la empresa', () => {
    expect(projectSubtitle({ companyName: 'Fundación Valle del Lili', projectName: 'fundacion valle del lili ' })).toBeNull();
    expect(projectSubtitle({ companyName: 'Emcali', projectName: 'Guía metodológica' })).toBe('Guía metodológica');
  });

  it('solo cuenta consultores con nombre', () => {
    const base = { initials: 'X', color: '#000' };
    expect(assignedConsultants([
      { id: '1', name: 'Ana', ...base },
      { id: '2', name: 'Sin asignar', ...base },
    ] as any).map(a => a.name)).toEqual(['Ana']);
  });
});
