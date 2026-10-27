import { FileText, MessagesSquare, ClipboardList, ScanSearch, Gauge, Compass, BookOpen, PackageCheck, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Etapa del ciclo de experiencia del cliente del PMO Value Ring y paso del flywheel que cubre una fase. */
export interface ValueRingStage {
  etapa: 'Exploración' | 'Diseño' | 'Despliegue' | 'Mejora' | 'Realización';
  paso: number;
  pasoNombre: string;
}

const EXPLORACION: ValueRingStage = { etapa: 'Exploración', paso: 2, pasoNombre: 'Evaluar necesidades' };

/** Ícono, descripción breve y ubicación en el PMO Value Ring de cada fase (tarjetas del pipeline). */
export interface PhaseInfo {
  icon: LucideIcon;
  description: string;
  valueRing?: ValueRingStage;
}

export const PHASE_CATALOG: Record<number, PhaseInfo> = {
  1: { icon: FileText, description: 'Carga de los documentos de la organización que sirven como insumo del diagnóstico.', valueRing: EXPLORACION },
  2: { icon: MessagesSquare, description: 'Registro de las entrevistas con líderes y actores clave de la organización.', valueRing: EXPLORACION },
  3: { icon: ClipboardList, description: 'Aplicación de encuestas para evaluar la idoneidad de la organización para una PMO.', valueRing: EXPLORACION },
  4: { icon: ScanSearch, description: 'El agente clasifica el tipo de PMO más adecuado a partir de los resultados previos.', valueRing: EXPLORACION },
  5: { icon: Gauge, description: 'Evaluación del nivel de madurez en gestión de proyectos, predictiva y ágil.', valueRing: EXPLORACION },
  6: { icon: Compass, description: 'El agente define el enfoque y la estructura de la guía metodológica.', valueRing: { etapa: 'Diseño', paso: 3, pasoNombre: 'Propuesta de valor' } },
  7: { icon: BookOpen, description: 'El agente redacta la guía metodológica capítulo por capítulo.', valueRing: { etapa: 'Diseño', paso: 4, pasoNombre: 'Desarrollar el servicio' } },
  8: { icon: PackageCheck, description: 'Consolidación del catálogo de artefactos y cierre del proyecto.', valueRing: { etapa: 'Despliegue', paso: 5, pasoNombre: 'Incorporar' } },
};

export const DEFAULT_PHASE_INFO: PhaseInfo = { icon: Layers, description: '' };
