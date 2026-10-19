import type { PrismaService } from '../../prisma/prisma.service';
import type { CampoAccesoService } from '../campo-acceso.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { SupervisionService } from './supervision.service';

describe('SupervisionService', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T10:30:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());
  it('entrega las fotos y comentarios de cada cumplimiento al líder sin contar borradores', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          empresaId: 1,
          isActive: true,
          rol: { equipoCampoId: 1 },
        }),
        findMany: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { superiorId?: { in: number[] } } }) =>
              where.superiorId?.in.includes(1) ? [{ id: 2 }] : [],
          ),
        findFirst: jest.fn().mockResolvedValue({
          id: 2,
          nombre: 'Ana',
          apellido: 'Pérez',
          celular: '',
          correo: '',
          rol: {
            descripcion: 'Impulsador',
            equipoCampo: {
              id: 1,
              nombre: 'Impulsadores',
              tipo: 'IMPULSADOR',
              activo: true,
            },
          },
        }),
      },
      asignacionCampo: { findMany: jest.fn().mockResolvedValue([]) },
      visitaCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 50,
            localId: 8,
            fecha: new Date('2026-09-17T00:00:00.000Z'),
            entrada: new Date('2026-09-17T08:00:00.000Z'),
            salida: null,
            local: {
              id: 8,
              nombre: 'Local 8',
              cliente: { nombre: 'Cliente' },
              horarios: [],
            },
            cumplimientos: [
              {
                tareaId: 10,
                nombreTarea: 'Exhibición',
                completadaAt: new Date('2026-09-17T09:00:00.000Z'),
                fotos: [
                  { id: 7, momento: 'ANTES', creadoAt: new Date() },
                  { id: 8, momento: 'DESPUES', creadoAt: new Date() },
                ],
                comentarios: [
                  {
                    id: 4,
                    comentario: 'Realizado',
                    creadoAt: new Date(),
                    usuario: { nombre: 'Ana', apellido: 'Pérez' },
                  },
                ],
              },
              {
                tareaId: 11,
                nombreTarea: 'Inventario',
                completadaAt: null,
                fotos: [],
                comentarios: [],
              },
            ],
          },
        ]),
      },
      tareaCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 10,
            nombre: 'Exhibición',
            categoria: 'Tienda',
            esObligatoria: true,
          },
          {
            id: 11,
            nombre: 'Inventario',
            categoria: 'Tienda',
            esObligatoria: true,
          },
        ]),
      },
      novedadCampo: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({
        id: 1,
        empresaId: 1,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };
    const service = new SupervisionService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );

    const detalle = await service.detalleColaborador(1, 2, {
      fecha: '2026-09-17',
    });

    expect(detalle.tareasCategorias[0].completadas).toBe(1);
    expect(detalle.evidencias).toHaveLength(2);
    expect(detalle.evidencias[0].fotos.map((foto) => foto.id)).toEqual([7, 8]);
    expect(detalle.evidencias[0].comentarios[0].comentario).toBe('Realizado');
    expect(detalle.evidencias[1].completadaAt).toBeNull();
    expect(detalle.colaborador.asistencia).toBe('incompleto');
    expect(detalle.colaborador.estadoPresentismo).toBe('INCOMPLETO');
    expect(detalle.ruta[0].estado).toBe('incompleto');
    expect(detalle.ruta[0].checkout).toBeNull();
    expect(detalle.evidencias[0].estado).toBe('INCOMPLETA');
  });

  it('calcula métricas de presentismo y resumen de equipo', async () => {
    const prisma = {
      usuario: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: number } }) => {
            if (where.id === 1) {
              return Promise.resolve({
                id: 1,
                empresaId: 10,
                isActive: true,
                rol: { equipoCampoId: 1 },
              });
            }
            return Promise.resolve({
              id: where.id,
              empresaId: 10,
              isActive: true,
            });
          }),
        findMany: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { superiorId?: { in: number[] } } }) =>
              where.superiorId
                ? where.superiorId.in.includes(1)
                  ? [{ id: 2 }]
                  : []
                : [
                    {
                      id: 2,
                      nombre: 'Diego',
                      apellido: 'Ramírez',
                      celular: '11223344',
                      superiorId: 1,
                      rol: {
                        descripcion: 'Impulsador',
                        equipoCampo: {
                          id: 1,
                          nombre: 'Impulsadores',
                          tipo: 'IMPULSADOR',
                          activo: true,
                        },
                      },
                    },
                  ],
          ),
      },
      asignacionCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 10,
            localId: 100,
            usuarioId: 2,
            fechaDesde: new Date('2026-09-01'),
            fechaHasta: null,
            usuario: { superiorId: 1, isActive: true },
            backups: [],
            horarios: [],
            local: { zonaHoraria: 'America/Asuncion', horarios: [] },
          },
        ]),
      },
      visitaCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 50,
            localId: 100,
            usuarioId: 2,
            fecha: new Date('2026-09-17T00:00:00Z'),
            local: { zonaHoraria: 'America/Asuncion' },
            entrada: new Date('2026-09-17T08:30:00.000Z'),
            salida: null,
            cumplimientos: [{ tareaId: 1 }],
          },
        ]),
      },
      tareaCampo: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, esObligatoria: true, todosLocales: true, locales: [] },
          {
            id: 2,
            esObligatoria: true,
            todosLocales: false,
            locales: [{ localId: 100 }],
          },
          {
            id: 3,
            esObligatoria: true,
            todosLocales: false,
            locales: [{ localId: 999 }],
          },
        ]),
      },
      novedadCampo: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ usuarioId: 2, _count: { _all: 1 } }]),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({
        id: 1,
        empresaId: 10,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };

    const service = new SupervisionService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );

    const resumen = await service.resumen(1, { fecha: '2026-09-17' });

    expect(resumen.presentismo.enRuta).toBe(0);
    expect(resumen.presentismo.incompletos).toBe(1);
    expect(resumen.presentismo.estados.INCOMPLETO).toBe(1);
    expect(resumen.rutas.incompletas).toBe(1);
    expect(resumen.rutas.pendientes).toBe(0);
    expect(resumen.presentismo.totalEquipo).toBe(1);
    expect(resumen.colaboradores[0].asistencia).toBe('incompleto');
    expect(resumen.colaboradores[0].novedadesCount).toBe(1);
    // La tarea 3 es de un local que no está en su ruta.
    expect(resumen.colaboradores[0].tareas.total).toBe(2);
    expect(resumen.colaboradores[0].tareas.obligPendientes).toBe(1);
    // Una consulta de visitas para todo el equipo, no una por colaborador.
    expect(prisma.visitaCampo.findMany).toHaveBeenCalledTimes(1);
    prisma.visitaCampo.findMany.mockResolvedValue([
      {
        id: 51,
        localId: 100,
        usuarioId: 2,
        fecha: new Date('2026-10-10'),
        local: { zonaHoraria: 'America/Asuncion' },
        entrada: new Date('2026-10-10T10:00:00-03:00'),
        salida: null,
        cumplimientos: [{ tareaId: 1 }],
      },
    ]);
    const hoy = await service.resumen(1, { fecha: '2026-10-10' });
    expect(hoy.presentismo.enRuta).toBe(1);
    expect(hoy.presentismo.estados.PRESENTE).toBe(1);
    expect(hoy.rutas.incompletas).toBe(0);
  });
});
