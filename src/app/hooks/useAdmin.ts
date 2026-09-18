import { useState, useEffect, useCallback } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type QuestionType = 'abierta' | 'si_no' | 'multiple';
export type UserRole = 'auditor' | 'admin' | 'usuario_externo';

/**
 * Los modelos se sirven via Gemini (https://ai.google.dev): cualquier nombre de modelo del
 * catalogo de Gemini es valido (ej. "gemini-pro-latest", "gemini-flash-latest"). No es un enum
 * cerrado.
 */
export type AiModelId = string;

export interface AiModelSettings {
  id: 'global';
  /** Vendor derivado del nombre de selectedModel, solo informativo (siempre "gemini"). */
  provider: string;
  selectedModel: AiModelId;
  fallbackModel: AiModelId;
  updatedAt?: string;
}

export interface AuditorUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastAccess: string;
  active: boolean;
}

export interface BankQuestion {
  id: string;
  text: string;
  dimension: string;
  surveyType: string;       // valor exacto de la DB: 'idoneidad' | 'madurez_predictiva' | 'madurez_agil'
  type: QuestionType;
  options?: string[];
  // edit buffer
  isEditing?: boolean;
  isNew?: boolean;
  editText?: string;
  editDimension?: string;
  editType?: QuestionType;
  editOptions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: Modelo de IA activo (ai_model_settings via backend)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_AI_MODEL_SETTINGS: AiModelSettings = {
  id: 'global',
  provider: 'gemini',
  selectedModel: 'gemini-pro-latest',
  fallbackModel: 'gemini-flash-latest',
};

export function useAiModelSettings() {
  const [settings, setSettings] = useState<AiModelSettings>(DEFAULT_AI_MODEL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<AiModelSettings>('/api/ai-model-settings');
      setSettings({ ...DEFAULT_AI_MODEL_SETTINGS, ...data });
    } catch (err) {
      console.error('[useAiModelSettings] Error:', err);
      toast.error('No se pudo cargar la configuración de modelos.');
      setSettings(DEFAULT_AI_MODEL_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSelectedModel = useCallback(async (selectedModel: AiModelId, fallbackModel?: AiModelId) => {
    setIsSaving(true);
    try {
      const data = await apiPut<AiModelSettings>('/api/ai-model-settings', { selectedModel, fallbackModel });
      setSettings({ ...DEFAULT_AI_MODEL_SETTINGS, ...data });
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { settings, isLoading, isSaving, fetchSettings, updateSelectedModel };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: Usuarios (tabla profiles vía /api/admin/users)
// ─────────────────────────────────────────────────────────────────────────────
interface AuditorUserApiDto {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string | null;
  active: boolean;
}

function mapAuditorUser(u: AuditorUserApiDto): AuditorUser {
  return {
    id: u.id,
    name: u.name ?? 'Sin nombre',
    email: u.email ?? '',
    role: (u.role as UserRole) ?? 'auditor',
    lastAccess: u.updatedAt
      ? new Date(u.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Sin registro',
    active: u.active !== false,
  };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AuditorUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<AuditorUserApiDto[]>('/api/admin/users');
      setUsers((data ?? []).map(mapAuditorUser));
    } catch (err) {
      console.error('[useAdminUsers] Error:', err);
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /** Crear usuario (backend usa la Service Role Key de GoTrue internamente) */
  const createUser = useCallback(async (
    name: string, email: string, password: string, role: UserRole
  ) => {
    await apiPost('/api/admin/users', { name, email, password, role });
    await fetchUsers();
  }, [fetchUsers]);

  /** Actualizar usuario (nombre y rol) */
  const updateUser = useCallback(async (id: string, name: string, role: UserRole) => {
    await apiPut(`/api/admin/users/${id}`, { name, role });
    await fetchUsers();
  }, [fetchUsers]);

  /** Activar/Desactivar usuario (Soft delete) */
  const toggleUserActive = useCallback(async (id: string, _currentActive: boolean) => {
    await apiPatch(`/api/admin/users/${id}/active`);
    await fetchUsers();
  }, [fetchUsers]);

  return { users, isLoading, fetchUsers, createUser, updateUser, toggleUserActive };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: Banco de Preguntas (tabla banco_preguntas vía /api/admin/banco-preguntas)
// ─────────────────────────────────────────────────────────────────────────────
interface BancoPreguntaApiDto {
  id: string;
  codigo: string;
  categoria: string;
  textoPregunta: string;
  tipoEncuesta: string;
  tipo: string;
}

export function useAdminQuestions() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<BancoPreguntaApiDto[]>('/api/admin/banco-preguntas');

      const normalizeSurveyType = (raw: string | null | undefined): string => {
        const v = (raw ?? '').toLowerCase().trim();
        if (v === 'madurez_predictiva' || v === 'predictiva') return 'Madurez Predictiva';
        if (v === 'madurez_agil' || v === 'madurez_ágil' || v === 'agil' || v === 'ágil') return 'Madurez Ágil';
        return 'Idoneidad';
      };

      const mapped: BankQuestion[] = (data ?? []).map((q) => ({
        id: q.id,
        text: q.textoPregunta || '',
        dimension: q.categoria || '',
        surveyType: normalizeSurveyType(q.tipoEncuesta),
        type: (q.tipo === 'likert_10' ? 'abierta' : 'si_no') as QuestionType,
        options: [],
      }));

      setQuestions(mapped);
    } catch (err) {
      console.error('[useAdminQuestions] Error:', err);
      toast.error('No se pudieron cargar las preguntas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  /** Actualizar texto de una pregunta */
  const updateQuestion = useCallback(async (id: string, text: string, dimension: string) => {
    try {
      await apiPut(`/api/admin/banco-preguntas/${id}`, { text, dimension });
    } catch (err) {
      console.error('[updateQuestion] Error al actualizar pregunta:', err);
    }
    setQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, text, dimension, isEditing: false } : q)
    );
  }, []);

  /** Insertar nueva pregunta */
  const insertQuestion = useCallback(async (
    text: string, dimension: string, surveyType: string
  ) => {
    try {
      const created = await apiPost<{ id: string }>('/api/admin/banco-preguntas', { text, dimension, surveyType });
      const newQ: BankQuestion = { id: created?.id || '', text, dimension, surveyType, type: 'si_no' };
      setQuestions(prev => [...prev, newQ]);
      return newQ;
    } catch (err) {
      console.error('[insertQuestion] Error al insertar pregunta:', err);
      const newQ: BankQuestion = { id: '', text, dimension, surveyType, type: 'si_no' };
      setQuestions(prev => [...prev, newQ]);
      return newQ;
    }
  }, []);

  /** Eliminar pregunta */
  const deleteQuestion = useCallback(async (id: string) => {
    await apiDelete(`/api/admin/banco-preguntas/${id}`);
    setQuestions(prev => prev.filter(q => q.id !== id));
  }, []);

  /** Edición local (sin guardar aún) */
  const patchLocal = useCallback((id: string, patch: Partial<BankQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }, []);

  return {
    questions,
    isLoading,
    setQuestions,
    updateQuestion,
    insertQuestion,
    deleteQuestion,
    patchLocal,
  };
}
