import { useState, useCallback, useEffect, useRef } from 'react';
import { apiDelete, apiGet, apiPost, apiUpload } from '../lib/api';
import { EncuestaResponse } from './useIdoneidad';

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

const sanitizeUploadFileName = (fileName: string) =>
  fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'encuesta.csv';

const normalizeStoredFileName = (fileName: string) =>
  fileName.replace(/^f5_(predictiva|agil)_\d+_(\d+_)?/i, '').toLowerCase();

const normalizeLocalFileName = (fileName: string) =>
  sanitizeUploadFileName(fileName).toLowerCase();

const fileIdentity = (file: File) =>
  `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;

export function useMadurez(projectId: string | undefined, tipoEncuesta: 'predictiva' | 'agil') {
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const [responses, setResponses] = useState<EncuestaResponse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [externalFiles, setExternalFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<{name: string, url: string}[]>([]);
  const deletedFilesRef = useRef<Set<string>>(new Set());

  const filePrefix = `f5_${tipoEncuesta}_`;

  const fetchInitialData = useCallback(async (isSilent = false) => {
    if (!projectId) return;
    if (!isSilent) setIsLoadingData(true);
    try {
      const linkData = await apiGet<{ token: string | null }>(`/api/projects/${projectId}/encuestas/${tipoEncuesta}/link`);
      setActiveLink(linkData?.token ?? null);

      const respData = await apiGet<EncuestaRespuestaApiDto[]>(`/api/projects/${projectId}/encuestas/${tipoEncuesta}/respuestas`);
      setResponses((respData ?? []).map(mapRespuesta));

      const files = await apiGet<{ name: string; url: string }[]>(`/api/projects/${projectId}/files?prefix=${filePrefix}`);
      const validFiles = (files ?? []).filter(f => !deletedFilesRef.current.has(f.name));
      if (validFiles.length > 0) {
        const dedupedByKey = new Map<string, { name: string; url: string }>();
        for (const file of validFiles) {
          const key = normalizeStoredFileName(file.name);
          if (!dedupedByKey.has(key)) dedupedByKey.set(key, file);
        }
        const dedupedFiles = Array.from(dedupedByKey.values());
        const uploadedFileNames = new Set(dedupedFiles.map(file => normalizeStoredFileName(file.name)));
        setExistingFiles(dedupedFiles);
        setExternalFiles(prev => prev.filter(file => !uploadedFileNames.has(normalizeLocalFileName(file.name))));
      } else {
        setExistingFiles([]);
      }
    } catch (err) {
      console.error(`Error fetching madurez ${tipoEncuesta} data:`, err);
    } finally {
      if (!isSilent) setIsLoadingData(false);
    }
  }, [projectId, tipoEncuesta, filePrefix]);

  useEffect(() => {
    if (!projectId) return;
    fetchInitialData();
    const interval = setInterval(() => fetchInitialData(true), 5000);
    return () => clearInterval(interval);
  }, [projectId, tipoEncuesta, fetchInitialData]);

  const generateLink = async () => {
    if (!projectId) return null;
    const data = await apiPost<{ token: string }>(`/api/projects/${projectId}/encuestas/${tipoEncuesta}/link`);
    setActiveLink(data.token);
    return data.token;
  };

  const deleteExistingFile = async (fileName: string) => {
    if (!projectId) return;
    const targetName = normalizeStoredFileName(fileName);
    const files = await apiGet<{ name: string; url: string }[]>(`/api/projects/${projectId}/files?prefix=${filePrefix}`);
    const namesToDelete = (files ?? [])
      .filter(f => normalizeStoredFileName(f.name) === targetName)
      .map(f => f.name);
    const finalNames = namesToDelete.length > 0 ? namesToDelete : [fileName];

    finalNames.forEach(name => deletedFilesRef.current.add(name));
    setExistingFiles(prev => prev.filter(f => normalizeStoredFileName(f.name) !== targetName));

    for (const name of finalNames) {
      try {
        await apiDelete(`/api/projects/${projectId}/files/${encodeURIComponent(name)}`);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const uploadFileIfAny = async (): Promise<string[]> => {
    if (!projectId) return [];
    if (externalFiles.length === 0) return existingFiles.map(f => f.url).filter(Boolean);

    const uploadedUrls: string[] = [...existingFiles.map(f => f.url)];
    const filesToUpload = [...externalFiles];

    for (const file of filesToUpload) {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await apiUpload<{ name: string; url: string }>(
        `/api/projects/${projectId}/files?prefix=${filePrefix}`,
        formData
      );
      if (uploaded?.url) uploadedUrls.push(uploaded.url);
    }
    const uploadedKeys = new Set(filesToUpload.map(fileIdentity));
    setExternalFiles(prev => prev.filter(file => !uploadedKeys.has(fileIdentity(file))));
    return uploadedUrls;
  };

  const addExternalFile = (file: File) => {
    setExternalFiles(prev => {
      const fileName = normalizeLocalFileName(file.name);
      const withoutSameName = prev.filter(existing => normalizeLocalFileName(existing.name) !== fileName);
      return [...withoutSameName, file];
    });
  };

  const removeExternalFile = (fileName: string) => {
    setExternalFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const downloadCSV = () => {
    if (!responses.length) return;

    const allQuestions = new Map<string, string>();

    responses.forEach(r => {
      if (Array.isArray(r.respuestas)) {
        r.respuestas.forEach((ans, idx) => {
          const key = ans.id || ans.codigo || `Pregunta_${idx + 1}`;
          const text = ans.pregunta || ans.texto || key;
          allQuestions.set(key, text);
        });
      } else if (r.respuestas && typeof r.respuestas === 'object') {
        Object.keys(r.respuestas).forEach(k => allQuestions.set(k, k));
      }
    });

    const questionKeys = Array.from(allQuestions.keys());
    const header = ['Fecha', 'ID Respuesta', 'Nombre', 'Cargo', 'Área', ...questionKeys.map(k => `"${(allQuestions.get(k) || k).replace(/"/g, '""')}"`)].join(',');

    const rows = responses.map(r => {
      const date = `"${new Date(r.created_at).toLocaleString('es-CO')}"`;
      const resId = `"${r.id || 'Anónimo'}"`;

      const nombre = `"${(r.nombre_encuestado || 'N/A').replace(/"/g, '""')}"`;
      const cargo = `"${(r.cargo_encuestado || 'N/A').replace(/"/g, '""')}"`;
      const area = `"${(r.area_encuestado || 'N/A').replace(/"/g, '""')}"`;

      const answers = questionKeys.map(k => {
        let val: any = '';
        if (Array.isArray(r.respuestas)) {
          const ansObj = r.respuestas.find((a, idx) =>
            (a.id || a.codigo || `Pregunta_${idx + 1}`) === k
          );
          if (ansObj) {
            val = ansObj.valor !== undefined ? ansObj.valor : ansObj.respuesta !== undefined ? ansObj.respuesta : '';
            if (val === '' && typeof ansObj === 'object') {
                val = Object.values(ansObj).find(v => typeof v === 'number' || typeof v === 'string') || '';
            }
          }
        } else if (r.respuestas && typeof r.respuestas === 'object') {
          val = r.respuestas[k];
        }

        if (val !== null && typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      });

      return [date, resId, nombre, cargo, area, ...answers].join(',');
    });

    const csvContent = '﻿' + [header, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respuestas_madurez_${tipoEncuesta}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { activeLink, responses, isLoadingData, externalFiles, addExternalFile, removeExternalFile, existingFiles, fetchInitialData, generateLink, deleteExistingFile, uploadFileIfAny, downloadCSV };
}
