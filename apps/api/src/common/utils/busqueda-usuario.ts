import type { Prisma } from '../../../generated/prisma/client';
import { MAX_INT4, MIN_INT4 } from './numeros';

// Cada término puede coincidir en una columna distinta; así "Ana Rojas"
// encuentra nombre + apellido sin concatenaciones SQL ni consultas crudas.
export function filtrosBusquedaUsuario(
  valor?: string,
  incluirErp = false,
): Prisma.UsuarioWhereInput[] {
  const terminos = [
    ...new Set((valor ?? '').trim().split(/\s+/u).filter(Boolean)),
  ];
  return terminos.map((termino) => ({
    OR: [
      { nombre: { contains: termino, mode: 'insensitive' } },
      { apellido: { contains: termino, mode: 'insensitive' } },
      { nombreLogin: { contains: termino, mode: 'insensitive' } },
      { correo: { contains: termino, mode: 'insensitive' } },
      { legajo: { contains: termino, mode: 'insensitive' } },
      { ruc: { contains: termino, mode: 'insensitive' } },
      ...(incluirErp
        ? [
            {
              ERP_CanalVenta: {
                contains: termino,
                mode: 'insensitive' as const,
              },
            },
            {
              ERP_Almacen: { contains: termino, mode: 'insensitive' as const },
            },
            {
              ERP_Supervisor: {
                contains: termino,
                mode: 'insensitive' as const,
              },
            },
            {
              ERP_Repositor: {
                contains: termino,
                mode: 'insensitive' as const,
              },
            },
            {
              ERP_Impulsador: {
                contains: termino,
                mode: 'insensitive' as const,
              },
            },
            ...(/^-?\d+$/.test(termino) &&
            Number(termino) >= MIN_INT4 &&
            Number(termino) <= MAX_INT4
              ? [{ ERP_Vendedor: Number(termino) }]
              : []),
          ]
        : []),
    ],
  }));
}
