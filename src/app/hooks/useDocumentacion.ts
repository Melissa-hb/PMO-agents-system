import { useState, useCallback } from 'react';
import { apiDelete, apiGet, apiPut, apiUpload, getPhaseState, runPhase } from '../lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentoLocal {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  customCategory: string;
  file?: File;
  storagePath?: string;
  dbId?: string;
}

export interface AgentDiagnosis {
  summary: string;
  organizacion?: string;
  sector?: string;
  tamano_aproximado?: string;
  tipo_proyecto_analizado?: string;
  descripcion_negocio?: string;
  tipos_de_proyecto?: Array<{ nombre: string; descripcion: string }>;
  estructura_organizacional?: {
    roles_identificados: Array<{
      nombre_cargo: string;
      area: string;
      nivel_jerarquico: string;
      participacion_en_proyectos: string;
      fuente: string;
    }>;
    existe_area_pmo: boolean;
    niveles_jerarquicos: string[];
    areas_involucradas_en_proyectos: string[];
    fuentes_documentales: string[];
  };
  cobertura_documental: {
    total_esperado: number;
    recibidos_completos: number;
    faltantes: number;
    recibidos_referenciados?: number;
    documentos_vencidos?: number;
  };
  calidad_documental: {
    resultado_consolidado: string;
    justificacion: string;
    actualizacion?: string;
    aplicabilidad?: string;
    nivel_detalle?: string;
    coherencia_entre_documentos?: string;
  };
  key_insights: string[];
  missing_documents: string[];
  recommendations: string[];
  brechas_documentales: Array<{
    id: string;
    dimension_o_area: string;
    descripcion: string;
    impacto: string;
    evidencia_o_ausencia?: string;
    documentos_fuente_o_ausentes?: string[];
  }>;
  hallazgos_documentales: Array<{
    nombre: string;
    descripcion: string;
    tipo: string;
    documentos_fuente?: string[];
  }>;
  limitaciones?: Array<{
    tipo: string;
    descripcion: string;
    impacto_confiabilidad: string;
    dimensiones_afectadas?: string[];
  }>;
  estado_documentos?: Array<{
    document_id: string;
    document_code: string;
    document_name: string;
    file_format?: string;
    estado: string;
    vigencia: string;
    valor_analitico: string;
    nivel_analisis: string;
    observaciones?: string;
  }>;
  artefactos_identificados?: Array<{
    nombre: string;
    nombre_en_empresa: string;
    tipo: string;
    fase_del_ciclo: string[];
    existe_en_empresa: boolean;
    tiene_datos_reales: boolean;
    nivel_madurez_artefacto: string;
    document_id_fuente: string;
    observaciones: string;
  }>;
  herramientas_identificadas?: Array<{
    nombre: string;
    tipo: string;
    uso_identificado: string;
    fases_donde_se_usa: string[];
    es_repositorio_digital_principal: boolean;
    document_id_fuente: string;
  }>;
  gobernanza_documental_detectada?: {
    tiene_sgc: boolean;
    evidencia_sgc: string;
    usa_codificacion_documental: boolean;
    patron_codificacion: string;
    tiene_repositorio_digital: boolean;
    herramienta_repositorio: string;
    tiene_gestion_cambios_formal: boolean;
    evidencia_gestion_cambios: string;
    tiene_lecciones_aprendidas: boolean;
    evidencia_lecciones_aprendidas: string;
    fuentes_documentales: string[];
  };
  cobertura_ciclo_vida?: {
    completitud?: string;
    fases_faltantes?: string[];
    continuidad_documental?: string;
    desbalance_identificado?: string;
  };
  dimensiones_gestion_proyectos?: Record<string, {
    confianza?: string;
    nivel_formalidad?: string;
    artefactos?: string[];
    herramientas?: string[];
    roles_documentados?: string[];
    fuentes_documentales?: string[];
    procesos_documentados?: string[];
  }>;
  insumos_para_agente_4: {
    tiene_preproyecto?: boolean | null;
    justificacion_preproyecto?: string;
    tiene_postcierre?: boolean | null;
    justificacion_postcierre?: string;
    nivel_estandarizacion: string;
    nivel_calidad_documental: string;
    hallazgos_clave_resumen?: string[];
    brechas_criticas_resumen?: string[];
    metodologias_mencionadas?: Array<{
      nombre?: string;
      documento_fuente?: string;
      nivel_adopcion_visible?: string;
    }>;
    senales_estructuracion_formal: Array<{ descripcion: string; nivel_evidencia: string; documentos_fuente?: string[] }>;
    senales_flexibilidad_agil: Array<{ descripcion: string; nivel_evidencia: string; documentos_fuente?: string[] }>;
  };
  listo_para_integracion?: boolean;
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

  const hasErrorStatus = value.metadata?.status === 'error';
  const hasErrorTemplate = value.diagnosis === null && value.error;
  if (hasErrorStatus || hasErrorTemplate) {
    const error = value.error ?? {};
    return {
      code: error.code,
      message: error.message ?? 'El agente no pudo generar un diagnostico valido.',
      details: error.details,
      retryable: error.retryable,
    };
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isDocumentacionProcessingPayload(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (value._processing === true) return true;
  if (value.metadata?.status === 'processing' || value.metadata?.status === 'procesando') return true;
  const nested = value.diagnosis ?? value.data?.diagnosis ?? value.data;
  return nested !== value && isDocumentacionProcessingPayload(nested);
}

export function normalizeDocumentacionDiagnosis(value: unknown): AgentDiagnosis | null {
  if (!isPlainObject(value)) return null;
  if (isDocumentacionProcessingPayload(value) || extractAgentError(value)) return null;

  const candidate = value.diagnosis ?? value.data?.diagnosis ?? value.data ?? value;
  if (!isPlainObject(candidate)) return null;
  if (isDocumentacionProcessingPayload(candidate) || extractAgentError(candidate)) return null;
  if (Object.keys(candidate).length === 0) return null;

  const hasMeaningfulContent = [
    typeof candidate.summary === 'string' && candidate.summary.trim().length > 0,
    isPlainObject(candidate.cobertura_documental),
    isPlainObject(candidate.calidad_documental),
    Array.isArray(candidate.key_insights) && candidate.key_insights.length > 0,
    Array.isArray(candidate.estado_documentos) && candidate.estado_documentos.length > 0,
    isPlainObject(candidate.insumos_para_agente_4),
  ].some(Boolean);

  return hasMeaningfulContent ? candidate as AgentDiagnosis : null;
}

interface DocumentoApiDto {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  customCategory: string;
  storagePath: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function useDocumentacion(projectId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [diagnosis, setDiagnosis] = useState<AgentDiagnosis | null>(null);
  const [agentError, setAgentError] = useState<AgentErrorPayload | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoLocal[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});

  /**
   * RECUPERAR DATOS AL CARGAR LA PÁGINA
   */
  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Obtener documentos
      const docsData = await apiGet<DocumentoApiDto[]>(`/api/projects/${projectId}/documentos`);

      if (docsData) {
        setDocumentos(docsData.map(d => ({
          id: d.id,
          name: d.name,
          size: d.size,
          type: d.type,
          category: d.category,
          customCategory: d.customCategory,
          storagePath: d.storagePath ?? undefined,
          dbId: d.id,
        })));
      }

      // 2. Obtener diagnóstico de la fase 1
      const faseData = await getPhaseState(projectId, 1);

      if (faseData?.datosConsolidados) {
        const consolidated = faseData.datosConsolidados as Record<string, any>;
        const storedError = extractAgentError(consolidated);
        if (storedError) {
          setAgentError(storedError);
          setDiagnosis(null);
          return;
        }
        const storedDiagnosis = normalizeDocumentacionDiagnosis(consolidated);
        setDiagnosis(storedDiagnosis);
        setAgentError(null);
      } else {
        setDiagnosis(null);
        setAgentError(null);
      }
    } catch (err) {
      console.error('Error fetching initial phase 1 data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId]);

  /**
   * PASO 1: Sube los archivos al backend (que a su vez los sube a Storage) y los registra.
   */
  const uploadDocuments = useCallback(async (documentos: DocumentoLocal[]): Promise<DocumentoLocal[]> => {
    setIsUploading(true);
    const enriched: DocumentoLocal[] = [];

    try {
      for (const doc of documentos) {
        // Si ya fue subido antes (tiene storagePath), solo actualizamos su categoria por si cambió
        if (doc.storagePath && doc.dbId) {
          try {
            await apiPut(`/api/projects/${projectId}/documentos/${doc.dbId}`, {
              category: doc.category,
              customCategory: doc.category === 'D16' ? doc.customCategory : '',
            });
          } catch {
            // no crítico: si falla, seguimos con el documento existente
          }
          enriched.push(doc);
          continue;
        }

        if (!doc.file) {
          toast.error(`No se encontró el archivo para: ${doc.name}`);
          continue;
        }

        setUploadProgress(prev => ({ ...prev, [doc.id]: 'uploading' }));

        try {
          const formData = new FormData();
          formData.append('file', doc.file);
          formData.append('category', doc.category);
          formData.append('customCategory', doc.category === 'D16' ? doc.customCategory : '');

          const created = await apiUpload<DocumentoApiDto>(`/api/projects/${projectId}/documentos`, formData);

          setUploadProgress(prev => ({ ...prev, [doc.id]: 'done' }));
          enriched.push({ ...doc, storagePath: created.storagePath ?? undefined, dbId: created.id });
        } catch (err) {
          setUploadProgress(prev => ({ ...prev, [doc.id]: 'error' }));
          toast.error(`Error subiendo ${doc.name}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
      }

      return enriched;
    } finally {
      setIsUploading(false);
    }
  }, [projectId]);

  /**
   * PASO 2: Llama al backend para ejecutar la fase 1 (Agente 3 - Documentación).
   */
  const runAgent = useCallback(async (iteration = 1, comments: string | null = null) => {
    setIsAnalyzing(true);
    setDiagnosis(null);
    setAgentError(null);

    try {
      const result = await runPhase(projectId, 1, { iteration, comments });

      if (result?.success === false) {
        throw new Error(result.error ?? 'Error desconocido en el agente');
      }

      const reportedError = extractAgentError(result.data);
      if (reportedError) {
        setAgentError(reportedError);
        throw new Error(reportedError.message);
      }

      const diagnosisData = normalizeDocumentacionDiagnosis(result.data);
      if (!diagnosisData) {
        throw new Error('El Agente aun no devolvio un diagnostico documental valido.');
      }

      setDiagnosis(diagnosisData);
      setAgentError(null);

      return diagnosisData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al contactar el agente';
      toast.error('Error en el Agente', { description: message });
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  /**
   * Flujo completo: Upload → DB → Agente
   */
  const processPhase = useCallback(async (documentos: DocumentoLocal[]) => {
    const enriched = await uploadDocuments(documentos);

    if (enriched.length === 0) {
      toast.error('No se pudo subir ningún documento.');
      return null;
    }

    toast.success(`${enriched.length} documentos subidos correctamente.`);

    const result = await runAgent();

    return result;
  }, [uploadDocuments, runAgent]);

  /**
   * ELIMINAR documento
   */
  const deleteDocument = useCallback(async (doc: DocumentoLocal) => {
    if (doc.dbId) {
      try {
        await apiDelete(`/api/projects/${projectId}/documentos/${doc.dbId}`);
      } catch (err) {
        toast.error(`Error eliminando ${doc.name}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        return;
      }
    }

    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    toast.success(`${doc.name} eliminado correctamente.`);
  }, [projectId]);

  return {
    isUploading,
    isAnalyzing,
    isLoadingData,
    isProcessing: isUploading || isAnalyzing,
    uploadProgress,
    agentError,
    diagnosis,
    documentos,
    setDocumentos,
    processPhase,
    runAgent,
    fetchInitialData,
    deleteDocument,
  };
}
