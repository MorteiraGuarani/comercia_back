jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { SupervisionService } from './supervision.service';
import { ConsultaSupervisionDto } from '../dto/supervision.dto';
import type { Prisma } from '../../../generated/prisma/client';
import { contextoTecnico } from '../../common/utils/contexto-tecnico';

function crear(equipo = [2], tipo = 'IMPULSADOR') {
  const prisma = {
    visitaCampo: {
      count: jest.fn().mockResolvedValue(15),
      findMany: jest
        .fn<Promise<unknown[]>, [Prisma.VisitaCampoFindManyArgs]>()
        .mockResolvedValue([]),
    },
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 1,
      empresaId: 4,
      rolDescripcion: 'Líder',
      equipoCampo: { id: 1, tipo, activo: true, nombre: 'Equipo' },
    }),
  };
  const servicio = new SupervisionService(prisma as never, acceso as never);
  jest
    .spyOn(
      servicio as unknown as { idsEquipo: () => Promise<number[]> },
      'idsEquipo',
    )
    .mockResolvedValue(equipo);
  return { prisma, acceso, servicio };
}
describe('Señales de marcación del equipo', () => {
  it('rechaza colaboradores ajenos antes de consultar sus visitas, incluso la autoinspección de repositor', async () => {
    const c = crear([]);
    await expect(c.servicio.marcacionesColaborador(1, 9, {})).rejects.toThrow(
      'No tienes acceso',
    );
    expect(c.prisma.visitaCampo.findMany).not.toHaveBeenCalled();
    const r = crear([], 'REPOSITOR');
    await expect(r.servicio.marcacionesColaborador(1, 1, {})).rejects.toThrow(
      'No tienes acceso',
    );
  });
  it('pagina dentro de empresa/equipo/fecha y restringe los eventos relacionados a esa misma empresa/persona', async () => {
    const c = crear();
    const q = Object.assign(new ConsultaSupervisionDto(), {
      fecha: '2026-10-09',
      page: 2,
      limit: 7,
    });
    const result = await c.servicio.marcacionesColaborador(1, 2, q);
    expect(c.acceso.gestionar).toHaveBeenCalledWith(1, 'visitas');
    const args = c.prisma.visitaCampo.findMany.mock.calls[0][0];
    expect(args).toMatchObject({
      skip: 7,
      take: 7,
      where: {
        usuarioId: 2,
        usuario: { empresaId: 4 },
        local: { cliente: { empresaId: 4 } },
      },
      select: {
        eventosUcheck: { take: 2, where: { empresaId: 4, usuarioId: 2 } },
      },
    });
    expect(c.prisma.visitaCampo.count).toHaveBeenCalledWith({
      where: args.where,
    });
    expect(result).toMatchObject({
      total: 15,
      page: 2,
      limit: 7,
      totalPages: 3,
    });
  });
  it('conserva señales de cada evento, ceros y falsos; no expone JSON desconocido ni simula datos de visitas antiguas', async () => {
    const c = crear();
    const v = {
      id: 8,
      fecha: new Date('2026-10-09'),
      entrada: new Date('2026-10-09T11:00:00Z'),
      salida: null,
      usuario: { id: 2, nombre: 'Ana', apellido: 'Pérez' },
      local: { id: 5, nombre: 'Centro', zonaHoraria: 'America/Asuncion' },
      entradaLat: 0,
      entradaLng: -57,
      entradaPrecision: 5,
      entradaDistancia: 0,
      entradaFueraHorario: null,
      entradaFueraAtencion: null,
      eventosUcheck: [],
    };
    c.prisma.visitaCampo.findMany.mockResolvedValueOnce([v]);
    const result = await c.servicio.marcacionesColaborador(1, 2, {});
    expect(result.items[0].entrada.contexto).toEqual({});
    expect(result.items[0].entrada.latitud).toBe(0);
    expect(result.items[0].salida).toBeNull();
    expect(
      contextoTecnico({
        bateriaNivelPorcentaje: 0,
        redConectada: false,
        token: 'secreto',
        horaAutomatica: 'true',
      }),
    ).toEqual({ bateriaNivelPorcentaje: 0, redConectada: false });
  });
});
