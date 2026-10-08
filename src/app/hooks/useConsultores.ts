import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

export interface Consultor {
  id: string;
  name: string;
  email: string;
}

/**
 * Consultores activos para asignar a un proyecto (GET /api/consultores, disponible para
 * cualquier usuario logueado). Antes los formularios usaban la lista del panel de
 * administracion, que a un consultor le respondia 403.
 */
export function useConsultores() {
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiGet<Consultor[]>('/api/consultores')
      .then(data => { if (active) setConsultores(data ?? []); })
      .catch(err => console.error('[useConsultores] Error:', err))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  return { consultores, isLoading };
}
