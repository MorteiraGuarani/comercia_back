import type { PrismaService } from '../../prisma/prisma.service';
import type { CampoAccesoService } from '../campo-acceso.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { SupervisionService } from './supervision.service';

describe('SupervisionService', () => {
  it('entrega las fotos y comentarios de cada cumplimiento al líder sin contar borradores', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          rol: { hijos: [{ usuarios: [{ id: 2 }] }] },
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 2, nombre: 'Ana', apellido: 'Pérez', celular: '', correo: '',
          rol: { descripcion: 'Impulsador' },
        }),
      },
      asignacionCampo: { findMany: jest.fn().mockResolvedValue([]) },
      visitaCampo: { findMany: jest.fn().mockResolvedValue([{
        id: 50,
        fecha: new Date('2026-09-17T00:00:00.000Z'),
        entrada: new Date('2026-09-17T08:00:00.000Z'),
        salida: null,
        local: { id: 8, nombre: 'Local 8', cliente: { nombre: 'Cliente' }, horarios: [] },
        cumplimientos: [
          { tareaId: 10, nombreTarea: 'Exhibición', completadaAt: new Date('2026-09-17T09:00:00.000Z'), fotos: [{ id: 7, momento: 'ANTES', creadoAt: new Date() }, { id: 8, momento: 'DESPUES', creadoAt: new Date() }], comentarios: [{ id: 4, comentario: 'Realizado', creadoAt: new Date(), usuario: { nombre: 'Ana', apellido: 'Pérez' } }] },
          { tareaId: 11, nombreTarea: 'Inventario', completadaAt: null, fotos: [], comentarios: [] },
        ],
      }]) },
      tareaCampo: { findMany: jest.fn().mockResolvedValue([
        { id: 10, nombre: 'Exhibición', categoria: 'Tienda', esObligatoria: true },
        { id: 11, nombre: 'Inventario', categoria: 'Tienda', esObligatoria: true },
      ]) },
      novedadCampo: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const acceso = { gestionar: jest.fn().mockResolvedValue({ id: 1, empresaId: 1 }) };
    const service = new SupervisionService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );

    const detalle = await service.detalleColaborador(1, 2, { fecha: '2026-09-17' });

    expect(detalle.tareasCategorias[0].completadas).toBe(1);
    expect(detalle.evidencias).toHaveLength(2);
    expect(detalle.evidencias[0].fotos.map((foto) => foto.id)).toEqual([7, 8]);
    expect(detalle.evidencias[0].comentarios[0].comentario).toBe('Realizado');
    expect(detalle.evidencias[1].completadaAt).toBeNull();
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
              rol: {
                hijos: [{ usuarios: [{ id: 2 }] }],
              },
            });
          }
          return Promise.resolve({ id: where.id, rol: null });
          }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 2,
            nombre: 'Diego',
            apellido: 'Ramírez',
            celular: '11223344',
            rol: { descripcion: 'Impulsador' },
          },
        ]),
      },
      asignacionCampo: {
        findMany: jest.fn().mockResolvedValue([{ id: 10, localId: 100 }]),
      },
      visitaCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 50,
            localId: 100,
            entrada: new Date('2026-09-17T08:30:00.000Z'),
            salida: null,
            cumplimientos: [{ tareaId: 1 }],
          },
        ]),
      },
      tareaCampo: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, esObligatoria: true },
          { id: 2, esObligatoria: true },
        ]),
      },
      novedadCampo: {
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({ id: 1, empresaId: 10 }),
    };

    const service = new SupervisionService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );

    const resumen = await service.resumen(1, { fecha: '2026-09-17' });

    expect(resumen.presentismo.enRuta).toBe(1);
    expect(resumen.presentismo.totalEquipo).toBe(1);
    expect(resumen.colaboradores[0].asistencia).toBe('en_curso');
    expect(resumen.colaboradores[0].novedadesCount).toBe(1);
    expect(resumen.colaboradores[0].tareas.obligPendientes).toBe(1);
  });
});
