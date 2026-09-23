import { FileText, MessagesSquare, ClipboardList, ScanSearch, Gauge, Compass, BookOpen, PackageCheck, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Ícono y descripción breve de cada fase, usados en las tarjetas del pipeline. */
export const PHASE_CATALOG: Record<number, { icon: LucideIcon; description: string }> = {
  1: { icon: FileText, description: 'Carga de los documentos de la organización que sirven como insumo del diagnóstico.' },
  2: { icon: MessagesSquare, description: 'Registro de las entrevistas con líderes y actores clave de la organización.' },
  3: { icon: ClipboardList, description: 'Aplicación de encuestas para evaluar la idoneidad de la organización para una PMO.' },
  4: { icon: ScanSearch, description: 'El agente clasifica el tipo de PMO más adecuado a partir de los resultados previos.' },
  5: { icon: Gauge, description: 'Evaluación del nivel de madurez en gestión de proyectos, predictiva y ágil.' },
  6: { icon: Compass, description: 'El agente define el enfoque y la estructura de la guía metodológica.' },
  7: { icon: BookOpen, description: 'El agente redacta la guía metodológica capítulo por capítulo.' },
  8: { icon: PackageCheck, description: 'Consolidación del catálogo de artefactos y cierre del proyecto.' },
};

export const DEFAULT_PHASE_INFO = { icon: Layers, description: '' };
