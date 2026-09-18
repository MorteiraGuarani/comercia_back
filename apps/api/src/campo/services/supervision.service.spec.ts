import type { PrismaService } from '../../prisma/prisma.service';
import type { CampoAccesoService } from '../campo-acceso.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { SupervisionService } from './supervision.service';

describe('SupervisionService', () => {
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
