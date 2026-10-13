import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultantReviewPanel } from './ConsultantReviewPanel';

describe('revisión del consultor en las fases 1 a 3', () => {
  it('reprocesa solo con un comentario y lo envía al agente', async () => {
    const onReprocess = vi.fn();
    render(<ConsultantReviewPanel phaseNumber={1} agentLabel="el Agente 1" onReprocess={onReprocess} onApprove={vi.fn()} />);

    const reprocesar = screen.getByRole('button', { name: /Reprocesar con comentario/ });
    expect((reprocesar as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Agregue observaciones/), { target: { value: 'Falta el organigrama' } });
    fireEvent.click(reprocesar);

    await waitFor(() => expect(onReprocess).toHaveBeenCalledWith('Falta el organigrama'));
  });

  it('aprueba después de confirmar', async () => {
    const onApprove = vi.fn();
    render(<ConsultantReviewPanel phaseNumber={2} agentLabel="el Agente 2" nextPhaseLabel="la Fase 3" onReprocess={vi.fn()} onApprove={onApprove} />);

    fireEvent.click(screen.getByRole('button', { name: /Aprobar diagnóstico/ }));
    expect(screen.getByText(/La Fase 2 quedará completada y se habilitará la Fase 3/)).toBeTruthy();
    expect(onApprove).not.toHaveBeenCalled();

    const botones = screen.getAllByRole('button', { name: /Aprobar diagnóstico/ });
    fireEvent.click(botones[botones.length - 1]);

    await waitFor(() => expect(onApprove).toHaveBeenCalledTimes(1));
  });
});
