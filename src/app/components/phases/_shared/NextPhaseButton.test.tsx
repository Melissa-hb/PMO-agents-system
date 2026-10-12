import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const app = vi.hoisted(() => ({ getProject: vi.fn(), updatePhaseStatus: vi.fn() }));
vi.mock('../../../context/AppContext', () => ({ useApp: () => app }));

import NextPhaseButton from './NextPhaseButton';

beforeEach(() => vi.clearAllMocks());

describe('navegacion al completar una fase', () => {
  it('muestra la fase anterior, la siguiente y el regreso al proyecto', () => {
    render(<NextPhaseButton projectId="p1" show prevPhase={5} nextPhase={7} />);

    fireEvent.click(screen.getByRole('button', { name: /Ir al proyecto/ }));

    expect(screen.getByRole('button', { name: /Ver la Fase 5/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ir a la Fase 7/ })).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith('/dashboard/project/p1');
  });

  it('habilita la siguiente fase a traves del backend si estaba bloqueada', async () => {
    app.getProject.mockReturnValue({ phases: [{ number: 6, status: 'completado' }, { number: 7, status: 'bloqueado' }] });
    render(<NextPhaseButton projectId="p1" show nextPhase={7} />);

    fireEvent.click(screen.getByRole('button', { name: /Ir a la Fase 7/ }));
    await Promise.resolve();

    expect(app.updatePhaseStatus).toHaveBeenCalledWith('p1', 7, 'disponible');
    expect(navigate).toHaveBeenCalledWith('/dashboard/project/p1/phase/7');
  });

  it('no se muestra mientras la fase no esta completada', () => {
    const { container } = render(<NextPhaseButton projectId="p1" show={false} nextPhase={7} />);

    expect(container.innerHTML).toBe('');
  });
});
