import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../lib/api';

export interface BancoPregunta {
  id: string;
  codigo: string;
  categoria: string;
  texto_pregunta: string;
}

export interface EncuestaLink {
  proyecto_id: string;
  tipo_encuesta: string;
}

interface PublicSurveyApiDto {
  proyectoId: string;
  tipoEncuesta: string;
  preguntas: { id: string; codigo: string; categoria: string; textoPregunta: string }[];
}

export function useEncuestaExterna(token: string) {
  const [linkInfo, setLinkInfo] = useState<EncuestaLink | null>(null);
  const [preguntas, setPreguntas] = useState<BancoPregunta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError('Token no válido');
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiGet<PublicSurveyApiDto>(`/api/public/encuestas/${token}`);

        setLinkInfo({ proyecto_id: data.proyectoId, tipo_encuesta: data.tipoEncuesta });
        setPreguntas((data.preguntas ?? []).map(p => ({
          id: p.id,
          codigo: p.codigo,
          categoria: p.categoria,
          texto_pregunta: p.textoPregunta,
        })));
      } catch (err) {
        console.error(err);
        setError('El enlace de la encuesta es inválido o ha expirado.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [token]);

  const submitRespuestas = async (
    nombre: string,
    cargo: string,
    area: string,
    respuestas: Record<string, number>
  ) => {
    await apiPost(`/api/public/encuestas/${token}/respuestas`, { nombre, cargo, area, respuestas });
    return true;
  };

  return { linkInfo, preguntas, isLoading, error, submitRespuestas };
}
