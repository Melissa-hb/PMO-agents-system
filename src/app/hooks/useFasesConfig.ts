import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPut } from '../lib/api';
import { loadPhaseConfig, type DocumentCategoryDefinition, type PhaseDefinition } from '../lib/phaseConfig';

/** Parametros de un agente (tabla configuracion_agentes). */
export interface AgentConfig {
  id: string;
  faseNumero: number;
  nombreFase: string;
  promptSistema: string;
  modelo: string | null;
  temperatura: number | null;
  instruccionesSalida: string | null;
  maxOutputTokens: number;
  timeoutMs: number;
  sinRazonamiento: boolean;
}

export interface ReferenceGuide {
  clave: string;
  nombre: string;
  url: string;
  orden: number;
  activa: boolean;
}

export interface FasesAdminConfig {
  fases: PhaseDefinition[];
  agentes: AgentConfig[];
  categoriasDocumento: DocumentCategoryDefinition[];
  guiasReferencia: ReferenceGuide[];
}

const BASE = '/api/admin/configuracion';
const EMPTY: FasesAdminConfig = { fases: [], agentes: [], categoriasDocumento: [], guiasReferencia: [] };

/** Configuracion de fases para el panel de administracion (seccion "Fases y agentes"). */
export function useFasesConfig() {
  const [config, setConfig] = useState<FasesAdminConfig>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      setConfig((await apiGet<FasesAdminConfig>(BASE)) ?? EMPTY);
    } catch (err: any) {
      toast.error('No se pudo cargar la configuración de fases', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /** Guarda, recarga la vista del panel y la configuracion global que usa el resto de la app. */
  const save = useCallback(async (request: () => Promise<unknown>, okMessage: string) => {
    setIsSaving(true);
    try {
      await request();
      await Promise.all([fetchConfig(), loadPhaseConfig()]);
      toast.success(okMessage);
      return true;
    } catch (err: any) {
      toast.error('No se pudo guardar', { description: err.message });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetchConfig]);

  const updatePhase = useCallback((numero: number, changes: Partial<Pick<PhaseDefinition, 'nombre' | 'requiereCompletas' | 'leeResultadoDe'>>) =>
    save(() => apiPut(`${BASE}/fases/${numero}`, changes), `Fase ${numero} actualizada`), [save]);

  const updateAgent = useCallback((faseNumero: number, changes: Partial<Omit<AgentConfig, 'id' | 'faseNumero'>>) =>
    save(() => apiPut(`${BASE}/agentes/${faseNumero}`, changes), `Agente de la fase ${faseNumero} actualizado`), [save]);

  const saveCategory = useCallback((codigo: string, changes: { nombre: string; orden?: number; esVisual?: boolean }) =>
    save(() => apiPut(`${BASE}/categorias/${codigo}`, changes), `Categoría ${codigo} guardada`), [save]);

  const deleteCategory = useCallback((codigo: string) =>
    save(() => apiDelete(`${BASE}/categorias/${codigo}`), `Categoría ${codigo} eliminada`), [save]);

  const saveGuide = useCallback((clave: string, changes: { nombre: string; url: string; orden?: number; activa?: boolean }) =>
    save(() => apiPut(`${BASE}/guias/${clave}`, changes), `Guía "${changes.nombre}" guardada`), [save]);

  const deleteGuide = useCallback((clave: string) =>
    save(() => apiDelete(`${BASE}/guias/${clave}`), 'Guía eliminada'), [save]);

  return { config, isLoading, isSaving, fetchConfig, updatePhase, updateAgent, saveCategory, deleteCategory, saveGuide, deleteGuide };
}
