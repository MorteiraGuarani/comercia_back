import type { Prisma } from '../../../generated/prisma/client';

// Cada término puede coincidir en una columna distinta; así "Ana Rojas"
// encuentra nombre + apellido sin concatenaciones SQL ni consultas crudas.
export function filtrosBusquedaUsuario(
  valor?: string,
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
    ],
  }));
}
