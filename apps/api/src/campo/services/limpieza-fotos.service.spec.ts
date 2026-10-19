import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import { limiteRetencionFotos } from '../utils/retencion-fotos';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../utils/multer-config', () => ({
  resolverRutaFoto: (ruta: string) => ruta,
}));
jest.mock('node:fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import { LimpiezaFotosService } from './limpieza-fotos.service';

function servicio(dias: number) {
  const prisma = {
    fotoTareaCampo: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 1, rutaArchivo: '/app/uploads/tareas/2025/01/01/a.jpg' },
          { id: 2, rutaArchivo: '/app/uploads/tareas/2025/01/02/b.jpg' },
        ])
        .mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const config = { get: jest.fn().mockReturnValue(dias) };
  return {
    prisma,
    limpieza: new LimpiezaFotosService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    ),
  };
}

describe('retención de fotos de tareas', () => {
  it('calcula el límite solo con la retención activa', () => {
    const ahora = new Date('2026-10-19T12:00:00Z');
    expect(limiteRetencionFotos(ahora, 0)).toBeNull();
    expect(limiteRetencionFotos(ahora, 365)?.toISOString()).toBe(
      '2025-10-19T12:00:00.000Z',
    );
  });

  it('apagada no consulta ni borra nada', async () => {
    const { prisma, limpieza } = servicio(0);
    expect(await limpieza.limpiar()).toBe(0);
    expect(prisma.fotoTareaCampo.findMany).not.toHaveBeenCalled();
  });

  it('borra los registros vencidos y después sus archivos', async () => {
    const { prisma, limpieza } = servicio(365);
    expect(await limpieza.limpiar(new Date('2026-10-19T12:00:00Z'))).toBe(2);
    expect(prisma.fotoTareaCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creadoAt: { lt: new Date('2025-10-19T12:00:00Z') } },
      }),
    );
    expect(prisma.fotoTareaCampo.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
  });
});
