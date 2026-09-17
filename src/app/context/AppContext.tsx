import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode, useRef
} from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api';
import { useAuth } from './AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type PhaseStatus = 'bloqueado' | 'disponible' | 'procesando' | 'completado' | 'error';

export interface Auditor {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: string;
}

export interface Phase {
  number: number;
  name: string;
  status: PhaseStatus;
  completedAt?: string;
  agentDiagnosis?: string;
  agentData?: any;
}

export interface Project {
  id: string;
  companyName: string;
  projectName: string;
  startDate: string;
  tamano?: string;
  mision?: string;
  vision?: string;
  auditors: Auditor[];
  phases: Phase[];
  status: 'en_ejecucion' | 'completado';
  isDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO
// ─────────────────────────────────────────────────────────────────────────────
interface AppContextType {
  projects: Project[];
  currentUser: Auditor;
  isLoading: boolean;
  addProject: (data: Omit<Project, 'id' | 'phases' | 'status'>) => Promise<void>;
  updatePhaseStatus: (projectId: string, phaseNumber: number, status: PhaseStatus, diagnosis?: string) => void;
  getProject: (id: string) => Project | undefined;
  refreshProjects: () => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  reprocessPhase: (projectId: string, phaseNumber: number) => Promise<void>;
  editProject: (id: string, data: { companyName: string; projectName: string; auditorId?: string }) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Auditor>({
    id: '',
    name: 'Usuario',
    initials: 'US',
    color: '#5454e9',
  });

  // ── Cargar proyectos desde el backend ────────────────────────────────────
  const fetchProjects = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await apiGet<Project[]>('/api/projects');
      setProjects(data ?? []);
    } catch (err) {
      console.error('[AppContext] Error cargando proyectos:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // ── Cargar perfil del usuario actual ─────────────────────────────────────
  const fetchCurrentUser = useCallback(async () => {
    try {
      const profile = await apiGet<{ id: string; name: string; role: string }>('/api/profile');
      if (profile) {
        const name = profile.name ?? 'Usuario';
        setCurrentUser({
          id: profile.id,
          name,
          initials: name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
          color: '#5454e9',
          role: profile.role ?? 'auditor',
        });
      }
    } catch (err) {
      console.error('[AppContext] Error cargando perfil:', err);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchProjects();
      fetchCurrentUser();
    } else {
      setProjects([]);
      setCurrentUser({ id: '', name: 'Usuario', initials: 'US', color: '#5454e9' });
      setIsLoading(false);
    }
  }, [session, fetchProjects, fetchCurrentUser]);

  // ── Polling silencioso de respaldo (reemplaza la suscripcion Realtime de Supabase) ──
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      fetchProjects(true);
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [session, fetchProjects]);

  // ── Crear nuevo proyecto ──────────────────────────────────────────────────
  const addProject = useCallback(async (data: Omit<Project, 'id' | 'phases' | 'status'>) => {
    await apiPost('/api/projects', {
      companyName: data.companyName,
      projectName: data.projectName,
      startDate: data.startDate,
      tamano: data.tamano,
      mision: data.mision,
      vision: data.vision,
      auditorId: data.auditors && data.auditors.length > 0 ? data.auditors[0].id : undefined,
    });
    await fetchProjects();
  }, [fetchProjects]);

  // ── Editar proyecto ────────────────────────────────────────────────────────
  const editProject = useCallback(async (id: string, data: { companyName: string; projectName: string; auditorId?: string }) => {
    await apiPut(`/api/projects/${id}`, {
      companyName: data.companyName,
      projectName: data.projectName,
      auditorId: data.auditorId,
    });
    await fetchProjects();
  }, [fetchProjects]);

  // ── Actualizar estado de una fase (local + backend) ─────────────────────
  const updatePhaseStatus = useCallback((
    projectId: string,
    phaseNumber: number,
    status: PhaseStatus,
    diagnosis?: string
  ) => {
    setProjects(prev =>
      prev.map(project => {
        if (project.id !== projectId) return project;
        const updatedPhases = project.phases.map(phase => {
          if (phase.number !== phaseNumber) return phase;
          return {
            ...phase,
            status,
            completedAt: status === 'completado'
              ? new Date().toLocaleDateString('es-CO')
              : phase.completedAt,
            agentDiagnosis: diagnosis ?? phase.agentDiagnosis,
          };
        });
        const allDone = updatedPhases.every(p => p.status === 'completado');
        return { ...project, phases: updatedPhases, status: allDone ? 'completado' : 'en_ejecucion' };
      })
    );

    apiPatch(`/api/projects/${projectId}/phases/${phaseNumber}/status`, { status })
      .catch(error => console.error('[AppContext] Error actualizando fase en backend:', error));
  }, []);

  const moveToTrash = useCallback(async (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p));
    try {
      await apiPost(`/api/projects/${id}/trash`);
    } catch (err) {
      console.error('[AppContext] moveToTrash exception:', err);
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      await apiDelete(`/api/projects/${id}`);
    } catch (err) {
      console.error('[AppContext] deleteProject exception:', err);
    }
  }, []);

  const restoreProject = useCallback(async (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isDeleted: false } : p));
    try {
      await apiPost(`/api/projects/${id}/restore`);
    } catch (err) {
      console.error('[AppContext] restoreProject exception:', err);
    }
  }, []);

  const reprocessPhase = useCallback(async (projectId: string, phaseNumber: number) => {
    setProjects(prev =>
      prev.map(project => {
        if (project.id !== projectId) return project;
        const updatedPhases = project.phases.map(phase => {
          if (phase.number === phaseNumber) {
            return {
              ...phase,
              status: 'disponible' as PhaseStatus,
              completedAt: undefined,
              agentDiagnosis: undefined,
              agentData: undefined,
            };
          }
          if (phase.number > phaseNumber) {
            return {
              ...phase,
              status: 'bloqueado' as PhaseStatus,
              completedAt: undefined,
              agentDiagnosis: undefined,
              agentData: undefined,
            };
          }
          return phase;
        });
        return { ...project, phases: updatedPhases, status: 'en_ejecucion' as const };
      })
    );

    try {
      await apiPost(`/api/projects/${projectId}/phases/${phaseNumber}/reprocess`);
    } catch (err) {
      console.error('[AppContext] Error in reprocessPhase:', err);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      projects,
      currentUser,
      isLoading,
      addProject,
      updatePhaseStatus,
      getProject: (id) => projects.find(p => p.id === id),
      refreshProjects: fetchProjects,
      moveToTrash,
      deleteProject,
      restoreProject,
      reprocessPhase,
      editProject,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// Exportado para compatibilidad con componentes que lo usan
export const MOCK_AUDITORS: Auditor[] = [];
