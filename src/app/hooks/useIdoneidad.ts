import { useState, useCallback, useEffect, useRef } from 'react';
import { apiDelete, apiGet, apiPost, apiUpload, getPhaseState, runPhase } from '../lib/api';

export interface EncuestaResponse {
  id: string;
  nombre_encuestado: string;
  cargo_encuestado: string;
  area_encuestado: string;
  respuestas: any[];
  created_at: string;
}

interface EncuestaRespuestaApiDto {
  id: string;
  nombreEncuestado: string;
  cargoEncuestado: string;
  areaEncuestado: string;
  respuestas: any;
  createdAt: string | null;
}

function mapRespuesta(r: EncuestaRespuestaApiDto): EncuestaResponse {
  return {
    id: r.id,
    nombre_encuestado: r.nombreEncuestado,
    cargo_encuestado: r.cargoEncuestado,
    area_encuestado: r.areaEncuestado,
    respuestas: Array.isArray(r.respuestas) ? r.respuestas : [],
    created_at: r.createdAt ?? '',
  };
}

export interface AgentErrorPayload {
  code?: string;
  message: string;
  details?: string;
  retryable?: boolean;
}

function extractAgentError(value: any): AgentErrorPayload | null {
  if (!value || typeof value !== 'object') return null;

  if (value._error) {
    return {
      message: value.message ?? 'El agente reporto un error durante el procesamiento.',
      details: value.details,
      retryable: true,
    };
  }

  const nestedError = value.error;
  if (nestedError && typeof nestedError === 'object' && value.diagnosis === null) {
    return {
      code: nestedError.code,
      message: nestedError.message ?? 'El agente no pudo generar el diagnostico.',
      details: nestedError.details,
      retryable: nestedError.retryable,
    };
  }

  if (value.metadata?.status === 'error') {
    return {
      code: nestedError?.code,
      message: nestedError?.message ?? 'El agente finalizo con error.',
      details: nestedError?.details,
      retryable: nestedError?.retryable,
    };
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isIdoneidadProcessingPayload(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (value._processing === true) return true;
  if (value.metadata?.status === 'processing' || value.metadata?.status === 'procesando') return true;
  const nested = value.diagnosis ?? value.data?.diagnosis ?? value.data;
  return nested !== value && isIdoneidadProcessingPayload(nested);
}

export function normalizeIdoneidadDiagnosis(value: unknown): any | null {
  if (!isPlainObject(value)) return null;
  if (isIdoneidadProcessingPayload(value) || extractAgentError(value)) return null;

  const candidate = value.diagnosis ?? value.data?.diagnosis ?? value.data ?? value;
  if (!isPlainObject(candidate)) return null;
  if (isIdoneidadProcessingPayload(candidate) || extractAgentError(candidate)) return null;
  if (Object.keys(candidate).length === 0) return null;

  const hasMeaningfulContent = [
    typeof candidate.summary === 'string' && candidate.summary.trim().length > 0,
    Number.isFinite(Number(candidate.numero_encuestados)),
    Array.isArray(candidate.resultados_por_item) && candidate.resultados_por_item.length > 0,
    isPlainObject(candidate.indicadores),
    Array.isArray(candidate.recomendaciones) && candidate.recomendaciones.length > 0,
    Array.isArray(candidate.recommendations) && candidate.recommendations.length > 0,
  ].some(Boolean);

  return hasMeaningfulContent ? candidate : null;
}

const FILE_PREFIX = 'f3_';

export function useIdoneidad(projectId: string | undefined) {
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const [responses, setResponses] = useState<EncuestaResponse[]>([]);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [agentError, setAgentError] = useState<AgentErrorPayload | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [externalFile, setExternalFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  // Track locally-deleted files so el polling no los restaure antes de que Storage propague el borrado
  const deletedFilesRef = useRef<Set<string>>(new Set());

  const fetchInitialData = useCallback(async (isSilent = false) => {
    if (!projectId) return;
    if (!isSilent) setIsLoadingData(true);
    try {
      // 1. Obtener link activo
      const linkData = await apiGet<{ token: string | null }>(`/api/projects/${projectId}/encuestas/idoneidad/link`);
      if (linkData?.token) setActiveLink(linkData.token);

      // 2. Obtener respuestas
      const respData = await apiGet<EncuestaRespuestaApiDto[]>(`/api/projects/${projectId}/encuestas/idoneidad/respuestas`);
      setResponses((respData ?? []).map(mapRespuesta));

      // 3. Obtener diagnóstico de la fase 3
      const faseData = await getPhaseState(projectId, 3);

      if (faseData?.datosConsolidados) {
        const consolidated = faseData.datosConsolidados as Record<string, any>;
        const storedError = extractAgentError(consolidated);
        if (storedError) {
          setAgentError(storedError);
          setDiagnosis(null);
          return;
        }
        const storedDiagnosis = normalizeIdoneidadDiagnosis(consolidated);
        setDiagnosis(storedDiagnosis);
        setAgentError(null);
      } else {
        setDiagnosis(null);
        setAgentError(null);
      }

      // 4. Buscar archivos de encuestas offline previos
      const files = await apiGet<{ name: string; url: string }[]>(`/api/projects/${projectId}/files?prefix=${FILE_PREFIX}`);
      const validFiles = (files ?? []).filter(f => !deletedFilesRef.current.has(f.name));
      if (validFiles.length > 0) {
        const latestFile = validFiles[0];
        setExistingFileName(latestFile.name);
        setExistingFileUrl(latestFile.url);
      } else {
        setExistingFileName(null);
        setExistingFileUrl(null);
      }
    } catch (err) {
      console.error("Error fetching idoneidad data:", err);
    } finally {
      if (!isSilent) setIsLoadingData(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    fetchInitialData();

    // Polling cada 5 segundos (reemplaza la suscripcion Realtime de Supabase)
    const interval = setInterval(() => {
      fetchInitialData(true);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [projectId, fetchInitialData]);

  const generateLink = async () => {
    if (!projectId) return null;
    const data = await apiPost<{ token: string }>(`/api/projects/${projectId}/encuestas/idoneidad/link`);
    setActiveLink(data.token);
    return data.token;
  };

  const processPhase = async (options?: { iteration?: number; comments?: string }) => {
    if (!projectId) return false;
    try {
      setDiagnosis(null);
      setAgentError(null);
      // Al confirmar el envío se invalida el enlace activo
      await apiPost(`/api/projects/${projectId}/encuestas/idoneidad/link/deactivate`);
      setActiveLink(null);

      let finalFileUrl = existingFileUrl;
      if (externalFile) {
        const formData = new FormData();
        formData.append('file', externalFile);
        const uploaded = await apiUpload<{ name: string; url: string }>(`/api/projects/${projectId}/files?prefix=${FILE_PREFIX}`, formData);
        finalFileUrl = uploaded.url;
      }

      const result = await runPhase(projectId, 3, {
        iteration: options?.iteration ?? 1,
        comments: options?.comments ?? null,
        externalFileUrl: finalFileUrl,
      });

      if (result?.success === false) {
        throw new Error(result.error ?? 'Error desconocido en el agente');
      }

      const reportedError = extractAgentError(result.data);
      if (reportedError) {
        setAgentError(reportedError);
        throw new Error(reportedError.message);
      }

      const innerDiagnosis = normalizeIdoneidadDiagnosis(result.data);
      if (!innerDiagnosis) {
        throw new Error('El Agente aun no devolvio un diagnostico de idoneidad valido.');
      }

      setDiagnosis(innerDiagnosis);
      setAgentError(null);
      return innerDiagnosis;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteFile = async () => {
    if (!projectId || !existingFileName) return;
    // Registrar como borrado inmediatamente para que el polling no lo restaure
    deletedFilesRef.current.add(existingFileName);
    const nameToDelete = existingFileName;
    setExistingFileName(null);
    setExistingFileUrl(null);
    try {
      await apiDelete(`/api/projects/${projectId}/files/${encodeURIComponent(nameToDelete)}`);
    } catch (error) {
      deletedFilesRef.current.delete(nameToDelete);
      throw new Error(`Error eliminando archivo: ${error instanceof Error ? error.message : 'desconocido'}`);
    }
  };

  return {
    activeLink,
    responses,
    diagnosis,
    agentError,
    isLoadingData,
    externalFile,
    setExternalFile,
    existingFileName,
    existingFileUrl,
    fetchInitialData,
    generateLink,
    processPhase,
    deleteFile,
  };
}
