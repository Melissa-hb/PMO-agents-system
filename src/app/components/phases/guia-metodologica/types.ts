import type { ElementType } from 'react';

type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved' | 'error';

interface ProcessingStep {
  id: number;
  label: string;
  detail: string;
  durationMs: number;
}

interface DocVersion {
  number: number;
  generatedAt: string; // ISO string
  comment?: string;    // comentario que disparó esta versión (null = original)
  status: 'generado' | 'revisado';
  data?: any;
}

interface GuideChapter {
  number: number;
  icon: ElementType;
  title: string;
  intro: string;
  subsections: {
    title: string;
    content: string;
    items?: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

type GuideSubsection = GuideChapter['subsections'][number];

/**
 * Comentarios que se envian al Agente 7: texto para regenerar la guia completa, u objeto con
 * target_sections (section_id) para regenerar solo esas secciones.
 */
type Phase7Comments = string | { comentario_consultor: string; target_sections: string[] } | null;

export type { PmoType, ModuleView, ProcessingStep, DocVersion, GuideChapter, GuideSubsection, Phase7Comments };
