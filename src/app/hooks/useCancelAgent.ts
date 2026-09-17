/**
 * useCancelAgent
 *
 * Hook reutilizable para cancelar un agente en ejecución.
 * Revierte la fase de 'procesando' → 'disponible' en el backend y en el estado local.
 * El backend, al terminar, detectará que ya no está en 'procesando' y descartará el resultado.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiPost } from '../lib/api';
import { useApp } from '../context/AppContext';

export function useCancelAgent(projectId: string, phaseNumber: number) {
  const { updatePhaseStatus } = useApp();
  const [isCancelling, setIsCancelling] = useState(false);

  const cancel = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);

    try {
      // 1. Actualizar el backend — esto es lo que revisa antes de guardar el resultado del agente
      await apiPost(`/api/projects/${projectId}/phases/${phaseNumber}/cancel`);

      // 2. Actualizar estado local (optimistic UI)
      updatePhaseStatus(projectId, phaseNumber, 'disponible');

      toast.info('Ejecución cancelada', {
        description: `El Agente ${phaseNumber} fue detenido. Los datos no fueron guardados.`,
      });

      return true;
    } catch (err: any) {
      toast.error('No se pudo cancelar', { description: err.message });
      return false;
    } finally {
      setIsCancelling(false);
    }
  }, [projectId, phaseNumber, isCancelling, updatePhaseStatus]);

  return { cancel, isCancelling };
}
