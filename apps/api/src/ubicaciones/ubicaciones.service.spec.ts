import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from '../campo/campo-acceso.service';
import type { UcheckClienteService } from '../ucheck/ucheck-cliente.service';

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

type Pedido = {
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
};

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
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 3,
        correo: 'leo@x.com',
        identidadUcheck: { ucheckUsuarioId: 30 },
      }),
      findMany: jest.fn(
        ({ where }: { where: { superiorId?: { in: number[] } } }) =>
          where.superiorId
            ? where.superiorId.in.includes(1)
              ? [{ id: 2 }]
              : where.superiorId.in.includes(2)
                ? [{ id: 3 }]
                : []
            : [
                {
                  id: 2,
                  correo: 'ana@x.com',
                  identidadUcheck: null,
                  nombre: 'Ana',
                  apellido: 'Paz',
                  rol: null,
                },
              ],
      ),
      findFirst: jest.fn().mockResolvedValue({
        id: 3,
        correo: 'leo@x.com',
        identidadUcheck: { ucheckUsuarioId: 30 },
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
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({ id: 1, empresaId: 5 }),
    ejecutar: jest.fn().mockResolvedValue({ id: 3, empresaId: 5 }),
  };
  // Ucheck guarda y devuelve los pings; acá solo se reenvían y consultan.
  const ucheck = {
    pedir: jest.fn((ruta: string, pedido: Pedido = {}) =>
      Promise.resolve(
        ruta.endsWith('/ultimas')
          ? {
              ubicaciones: [
                {
                  ucheckUsuarioId: 20,
                  correo: 'ana@x.com',
                  ...ping('2026-10-23T09:50:00-03:00'),
                },
              ],
            }
          : ruta.endsWith('/recorrido')
            ? { puntos: [] }
            : {
                guardados: (pedido.body as { puntos: unknown[] }).puntos.length,
              },
      ),
    ),
  };
  const service = new UbicacionesService(
    prisma as unknown as PrismaService,
    acceso as unknown as CampoAccesoService,
    ucheck as unknown as UcheckClienteService,
  );
  return { prisma, acceso, ucheck, service };
}

describe('UbicacionesService', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-23T10:00:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());

  it('el líder ve en vivo solo su cadena, con la última posición de Ucheck', async () => {
    const { prisma, acceso, ucheck, service } = armar();
    const r = await service.enVivo(1, {});
    expect(acceso.gestionar).toHaveBeenCalledWith(1, 'ubicaciones');
    const consulta = prisma.usuario.findMany.mock.calls.find(
      ([a]) => !(a as { where: { superiorId?: unknown } }).where.superiorId,
    )![0] as { where: { empresaId: number; id: { in: number[] } } };
    expect(consulta.where.empresaId).toBe(5);
    expect(consulta.where.id.in).toEqual([2, 3]);
    // Sin vínculo con Ucheck se la busca por correo.
    expect(ucheck.pedir.mock.calls[0][1]).toMatchObject({
      query: { correos: 'ana@x.com' },
    });
    expect(r.personas[0].ultima).toMatchObject({ latitud: -25.3 });
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
    const { ucheck, service } = armar();
    await expect(service.recorrido(1, 9, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.recorrido(1, 1, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ucheck.pedir).not.toHaveBeenCalled();
  });

  it('el recorrido de alguien de la cadena se pide a Ucheck por su identidad', async () => {
    const { prisma, ucheck, service } = armar();
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
    expect(ucheck.pedir).toHaveBeenCalledWith(
      '/comercia-integracion/ubicaciones/recorrido',
      expect.objectContaining({
        query: expect.objectContaining({ ucheckUsuarioId: '30' }) as unknown,
      }),
    );
  });

  it('la semana pide a Ucheck día por día y la noche no cuenta como sin señal', async () => {
    const { prisma, ucheck, service } = armar();
    prisma.visitaCampo.findMany.mockResolvedValue([]);
    // Un punto al mediodía de cada día pedido.
    ucheck.pedir.mockImplementation(((_: string, pedido: Pedido = {}) => {
      const desde = new Date(String(pedido.query?.desde));
      return Promise.resolve({
        puntos: [
          ping(new Date(desde.getTime() + 27 * 3_600_000).toISOString()),
        ],
      });
    }) as never);
    const r = await service.recorrido(1, 3, { fecha: '2026-10-22', dias: 3 });
    expect(ucheck.pedir).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ fecha: '2026-10-22', dias: 3 });
    expect(
      r.puntos.map((p) => p.capturadaEn.toISOString().slice(0, 10)),
    ).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(r.resumen).toMatchObject({ puntos: 3, minutosSinDatos: 0 });
    const llamadas = prisma.visitaCampo.findMany.mock.calls as unknown[][];
    const visitas = llamadas[llamadas.length - 1][0] as {
      where: { fecha: { in: Date[] } };
    };
    expect(visitas.where.fecha.in).toHaveLength(3);
  });

  it('manda a Ucheck solo las posiciones de la jornada', async () => {
    const { ucheck, service } = armar();
    const r = await service.registrar(3, {
      pings: [
        ping('2026-10-23T09:59:00-03:00'),
        ping('2026-10-23T07:30:00-03:00'), // antes de la entrada
        ping('2026-10-23T10:30:00-03:00'), // en el futuro
        ping('2026-10-20T09:00:00-03:00'), // más de 48 h
      ],
    });
    expect(r).toEqual({ guardados: 1, descartados: 3, activa: true });
    expect(ucheck.pedir).toHaveBeenCalledWith(
      '/comercia-integracion/ubicaciones',
      expect.objectContaining({
        method: 'POST',
        body: {
          correo: 'leo@x.com',
          ucheckUsuarioId: 30,
          puntos: [
            expect.objectContaining({
              capturadaEn: '2026-10-23T12:59:00.000Z',
            }),
          ],
        },
      }),
    );
  });

  it('sin entrada hoy la jornada no está activa y no se manda nada', async () => {
    const { prisma, ucheck, service } = armar();
    prisma.visitaCampo.findMany.mockResolvedValue([]);
    expect(await service.estado(3)).toEqual({
      activa: false,
      intervaloSegundos: 30,
    });
    const r = await service.registrar(3, {
      pings: [ping('2026-10-23T09:59:00-03:00')],
    });
    expect(r).toEqual({ guardados: 0, descartados: 1, activa: false });
    expect(ucheck.pedir).not.toHaveBeenCalled();
  });
});
