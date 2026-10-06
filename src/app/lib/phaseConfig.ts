import { useSyncExternalStore } from 'react';
import { apiGet } from './api';

/**
 * Configuracion de las fases que vive en la base de datos (tablas fases y categorias_documento).
 * Se carga una vez al iniciar sesion (AppContext) y se edita en Administracion > Fases y agentes.
 * Antes estaba escrita en phaseDependencies.ts y documentCategories.ts.
 */

export interface PhaseDefinition {
  numero: number;
  codigo: string;
  nombre: string;
  orden: number;
  visible: boolean;
  /** Fases que deben estar completadas para ejecutar esta. */
  requiereCompletas: number[];
  /** Fases cuyo resultado lee el agente (el backend las usa para invalidar al reprocesar). */
  leeResultadoDe: number[];
}

export interface DocumentCategoryDefinition {
  codigo: string;
  nombre: string;
  orden: number;
  esVisual: boolean;
  /** Categoria libre ("Otros"): el usuario escribe el nombre. */
  esOtros: boolean;
}

export interface PhaseConfig {
  fases: PhaseDefinition[];
  categoriasDocumento: DocumentCategoryDefinition[];
  loaded: boolean;
}

const EMPTY: PhaseConfig = { fases: [], categoriasDocumento: [], loaded: false };

let current: PhaseConfig = EMPTY;
const listeners = new Set<() => void>();

export function getPhaseConfig(): PhaseConfig {
  return current;
}

export function setPhaseConfig(config: Omit<PhaseConfig, 'loaded'>) {
  current = {
    fases: [...(config.fases ?? [])].sort((a, b) => a.orden - b.orden),
    categoriasDocumento: [...(config.categoriasDocumento ?? [])].sort((a, b) => a.orden - b.orden),
    loaded: true,
  };
  listeners.forEach(listener => listener());
}

export function resetPhaseConfig() {
  current = EMPTY;
  listeners.forEach(listener => listener());
}

export async function loadPhaseConfig(): Promise<PhaseConfig> {
  const data = await apiGet<Omit<PhaseConfig, 'loaded'>>('/api/config/fases');
  setPhaseConfig(data ?? { fases: [], categoriasDocumento: [] });
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La configuracion actual; el componente se vuelve a pintar cuando cambia. */
export function usePhaseConfig(): PhaseConfig {
  return useSyncExternalStore(subscribe, getPhaseConfig, getPhaseConfig);
}

// ── Categorias de documentos ────────────────────────────────────────────────────────────────

/** Codigo de la categoria "Otros" (la que permite escribir un nombre propio). */
export function otrosCategoryCode(config: PhaseConfig = current): string {
  return config.categoriasDocumento.find(c => c.esOtros)?.codigo ?? 'D16';
}

export function isOtrosCategory(code: string | null | undefined, config: PhaseConfig = current): boolean {
  return !!code && code === otrosCategoryCode(config);
}

export function categoryLabel(code: string | null | undefined, config: PhaseConfig = current): string | undefined {
  return config.categoriasDocumento.find(c => c.codigo === code)?.nombre;
}
