export interface VersionTarea {
  version: number;
  creadaEn: string;
  contenido: {
    nombre?: string;
    descripcion?: string;
    activo?: boolean;
    archivadaEn?: string | null;
    archivada_en?: string | null;
    todosLocales?: boolean;
    todos_locales?: boolean;
    requiereFotos?: boolean;
    requiere_fotos?: boolean;
    fotosObligatorias?: boolean;
    fotos_obligatorias?: boolean;
    localIds?: string[];
    locales?: Array<{ local: { id: string; nombre: string } }>;
  };
}
