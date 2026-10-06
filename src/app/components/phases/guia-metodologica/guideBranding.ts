import type { DocVersion } from './types';

/** Identidad con la que se presentan los entregables al cliente (portada y pie de la guia). */
export const CONSULTORA = 'Universidad Icesi';
export const LINEA_SERVICIO = 'Consultoría en Gestión de Proyectos';
/** Transparencia con el cliente: el documento se construye con apoyo de IA y lo revisa el consultor. */
export const NOTA_ELABORACION = 'Documento elaborado por el equipo consultor con apoyo de herramientas de análisis asistidas por IA.';

/** Estado real del documento: aprobado, revisado o borrador. */
export function documentStatusLabel(version: Pick<DocVersion, 'status'>, approved: boolean): string {
  if (approved) return 'Versión aprobada';
  return version.status === 'revisado' ? 'Documento revisado' : 'Borrador para revisión';
}
