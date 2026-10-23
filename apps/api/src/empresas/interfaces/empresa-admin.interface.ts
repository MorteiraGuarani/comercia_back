export interface EmpresaAdminFila {
  id: number;
  nombre: string;
  dbName: string | null;
  diasAvisoVencimiento: number;
  padre: { id: number; nombre: string } | null;
  _count: {
    usuarios: number;
    hijas: number;
    modulos: number;
    paginas: number;
  };
}

export interface EmpresaAdminDto {
  id: number;
  nombre: string;
  dbName: string | null;
  diasAvisoVencimiento: number;
  padre: { id: number; nombre: string } | null;
  usuariosCount: number;
  hijasCount: number;
  configuracionCount: number;
}

export interface EmpresaJerarquiaFila {
  empresaId: number | null;
}
