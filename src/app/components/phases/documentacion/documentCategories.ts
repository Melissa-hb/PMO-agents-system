import { usePhaseConfig } from '../../../lib/phaseConfig';

/** Codigo de categoria de documento (D01, D02, ...). Las categorias vienen de la tabla categorias_documento. */
export type DocCategory = string;

export interface DocumentCategoryOption {
  value: DocCategory;
  label: string;
}

/** Categorias de documentos para listas y selectores, en el orden configurado. */
export function useDocumentCategories(): DocumentCategoryOption[] {
  const { categoriasDocumento } = usePhaseConfig();
  return categoriasDocumento.map(c => ({ value: c.codigo, label: c.nombre }));
}
