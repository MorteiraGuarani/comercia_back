import type { Prisma } from '../../../generated/prisma/client';
import { heredarTolerancias } from './tolerancia-horario';
export async function cargarTolerancias(
  tx: Prisma.TransactionClient,
  empresaId: number,
  usuarioId?: number,
  horarioId?: number,
) {
  const claves = [
    'global:0',
    'empresa:' + empresaId,
    ...(horarioId ? ['horario:' + horarioId] : []),
    ...(usuarioId ? ['usuario:' + usuarioId] : []),
  ];
  const filas = await tx.configuracionTolerancia.findMany({
    where: { clave: { in: claves }, OR: [{ empresaId }, { empresaId: null }] },
    select: { clave: true, valores: true },
    take: 4,
  });
  const porClave = new Map(filas.map((f) => [f.clave, f.valores]));
  return heredarTolerancias(...claves.map((c) => porClave.get(c)));
}

export async function cargarToleranciasAgenda(
  tx: Prisma.TransactionClient,
  empresaId: number,
  usuarioId: number,
  horarios: number[],
) {
  if (!horarios.length)
    return new Map<number, ReturnType<typeof heredarTolerancias>>();
  const bases = ['global:0', 'empresa:' + empresaId, 'usuario:' + usuarioId];
  const claves = [...bases, ...new Set(horarios.map((id) => 'horario:' + id))];
  const filas = await tx.configuracionTolerancia.findMany({
    where: { clave: { in: claves }, OR: [{ empresaId }, { empresaId: null }] },
    select: { clave: true, valores: true },
    take: claves.length,
  });
  const mapa = new Map(filas.map((f) => [f.clave, f.valores]));
  return new Map(
    horarios.map((id) => [
      id,
      heredarTolerancias(
        mapa.get(bases[0]),
        mapa.get(bases[1]),
        mapa.get('horario:' + id),
        mapa.get(bases[2]),
      ),
    ]),
  );
}
