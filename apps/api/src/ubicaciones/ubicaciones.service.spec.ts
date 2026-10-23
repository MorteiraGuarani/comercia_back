import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from '../campo/campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { UbicacionesService } from './ubicaciones.service';

const ping = (capturadaEn: string) => ({
  latitud: -25.3,
  longitud: -57.6,
  precisionMetros: 12,
  capturadaEn,
});

function armar({ superadmin = false } = {}) {
  // Líder 1 → TeamLeader 2 → impulsador 3; el 9 es de otra cadena.
  const prisma = {
    usuario: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        where.id === 1 && superadmin
          ? { empresaId: 5, isActive: true, esSuperadmin: true }
          : {
              id: where.id,
              empresaId: 5,
              isActive: true,
              esSuperadmin: false,
              rol: { equipoCampoId: 4 },
            },
      ),
      findMany: jest.fn(
        ({ where }: { where: { superiorId?: { in: number[] } } }) =>
          where.superiorId
            ? where.superiorId.in.includes(1)
              ? [{ id: 2 }]
              : where.superiorId.in.includes(2)
                ? [{ id: 3 }]
                : []
            : [{ id: 2, nombre: 'Ana', apellido: 'Paz', rol: null }],
      ),
      findFirst: jest.fn().mockResolvedValue({
        id: 3,
        nombre: 'Leo',
        apellido: 'Gómez',
      }),
    },
    empresa: {
      findUnique: jest.fn().mockResolvedValue({ id: 5, nombre: 'Guaraní' }),
    },
    visitaCampo: {
      findMany: jest.fn().mockResolvedValue([
        {
          fecha: new Date('2026-10-23T00:00:00.000Z'),
          entrada: new Date('2026-10-23T08:00:00-03:00'),
          salida: null,
        },
      ]),
    },
    ubicacionCampo: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn(({ data }: { data: unknown[] }) => ({
        count: data.length,
      })),
    },
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({ id: 1, empresaId: 5 }),
    ejecutar: jest.fn().mockResolvedValue({ id: 3, empresaId: 5 }),
  };
  const service = new UbicacionesService(
    prisma as unknown as PrismaService,
    acceso as unknown as CampoAccesoService,
  );
  return { prisma, acceso, service };
}

describe('UbicacionesService', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-23T10:00:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());

  it('el líder ve en vivo solo su cadena, sin incluirse', async () => {
    const { prisma, acceso, service } = armar();
    await service.enVivo(1, {});
    expect(acceso.gestionar).toHaveBeenCalledWith(1, 'ubicaciones');
    const consulta = prisma.usuario.findMany.mock.calls.find(
      ([a]) => !(a as { where: { superiorId?: unknown } }).where.superiorId,
    )![0] as { where: { empresaId: number; id: { in: number[] } } };
    expect(consulta.where.empresaId).toBe(5);
    expect(consulta.where.id.in).toEqual([2, 3]);
  });

  it('el líder no puede pedir otra empresa', async () => {
    const { service } = armar();
    await expect(service.enVivo(1, { empresaId: 8 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el superadmin ve la empresa elegida sin pasar por la cadena', async () => {
    const { prisma, acceso, service } = armar({ superadmin: true });
    await service.enVivo(1, { empresaId: 8 });
    expect(acceso.gestionar).not.toHaveBeenCalled();
    const consulta = prisma.usuario.findMany.mock.calls[0][0] as {
      where: { empresaId: number; id?: unknown };
    };
    expect(consulta.where.empresaId).toBe(8);
    expect(consulta.where.id).toBeUndefined();
  });

  it('el recorrido de alguien fuera de la cadena responde como inexistente', async () => {
    const { prisma, service } = armar();
    await expect(service.recorrido(1, 9, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.recorrido(1, 1, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.ubicacionCampo.findMany).not.toHaveBeenCalled();
  });

  it('el recorrido de alguien de la cadena se busca en la empresa del líder', async () => {
    const { prisma, service } = armar();
    prisma.visitaCampo.findMany.mockResolvedValue([
      {
        id: 7,
        entrada: new Date('2026-10-22T08:00:00-03:00'),
        salida: null,
        entradaLat: -25.31,
        entradaLng: -57.61,
        local: {
          CardCode: 'C1',
          CardName: 'Súper',
          U_Latitud: null,
          U_Longitud: null,
        },
      },
    ]);
    const r = await service.recorrido(1, 3, { fecha: '2026-10-22' });
    expect(r.persona).toEqual({ id: 3, nombre: 'Leo Gómez' });
    // Local sin coordenadas en OCRD: se marca donde se registró la entrada.
    expect(r.visitas[0]).toMatchObject({ latitud: -25.31, longitud: -57.61 });
    expect(
      (prisma.ubicacionCampo.findMany.mock.calls[0] as unknown[])[0],
    ).toMatchObject({
      where: {
        empresaId: 5,
        usuarioId: 3,
        fecha: new Date('2026-10-22T00:00:00.000Z'),
      },
    });
  });

  it('guarda como propias solo las posiciones de la jornada y sin duplicar', async () => {
    const { prisma, service } = armar();
    const r = await service.registrar(3, {
      pings: [
        ping('2026-10-23T09:59:00-03:00'),
        ping('2026-10-23T07:30:00-03:00'), // antes de la entrada
        ping('2026-10-23T10:30:00-03:00'), // en el futuro
        ping('2026-10-20T09:00:00-03:00'), // más de 48 h
      ],
    });
    expect(r).toEqual({ guardados: 1, descartados: 3, activa: true });
    expect(prisma.ubicacionCampo.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          empresaId: 5,
          usuarioId: 3,
          fecha: new Date('2026-10-23T00:00:00.000Z'),
          capturadaEn: new Date('2026-10-23T12:59:00.000Z'),
          velocidadMps: null,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('sin entrada hoy la jornada no está activa y no se guarda nada', async () => {
    const { prisma, service } = armar();
    prisma.visitaCampo.findMany.mockResolvedValue([]);
    expect(await service.estado(3)).toEqual({
      activa: false,
      intervaloSegundos: 60,
    });
    const r = await service.registrar(3, {
      pings: [ping('2026-10-23T09:59:00-03:00')],
    });
    expect(r).toEqual({ guardados: 0, descartados: 1, activa: false });
    expect(prisma.ubicacionCampo.createMany).not.toHaveBeenCalled();
  });

  it('del seguimiento de UCheck guarda un punto por minuto', async () => {
    const { prisma, service } = armar();
    const punto = (hora: string) => ({
      latitud: -25.3,
      longitud: -57.6,
      precisionMetros: 8,
      capturadaEn: new Date(`2026-10-23T${hora}-03:00`),
    });
    expect(
      await service.registrarSeguimientoUcheck(
        { id: 3, empresaId: 5 },
        punto('09:00:00'),
      ),
    ).toBe(true);
    prisma.ubicacionCampo.findFirst.mockResolvedValue({
      capturadaEn: new Date('2026-10-23T09:00:00-03:00'),
    });
    expect(
      await service.registrarSeguimientoUcheck(
        { id: 3, empresaId: 5 },
        punto('09:00:10'),
      ),
    ).toBe(false);
    expect(
      await service.registrarSeguimientoUcheck(
        { id: 3, empresaId: 5 },
        punto('09:00:58'),
      ),
    ).toBe(true);
    expect(prisma.ubicacionCampo.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.ubicacionCampo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 5,
          usuarioId: 3,
          fecha: new Date('2026-10-23T00:00:00.000Z'),
        },
      }),
    );
  });
});
