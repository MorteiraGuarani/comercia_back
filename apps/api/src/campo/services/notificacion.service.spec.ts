import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { NotificacionService } from './notificacion.service';

function preparar() {
  const personas = [
    { id: 1, empresaId: 10, superiorId: null, isActive: true },
    { id: 2, empresaId: 10, superiorId: 1, isActive: true },
    { id: 3, empresaId: 10, superiorId: 2, isActive: true },
  ];
  const prisma = {
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ nombre: 'Ana', apellido: 'Pérez' }),
      findMany: jest.fn(
        ({ where }: { where: { empresaId: number; id: { in: number[] } } }) =>
          Promise.resolve(
            personas.filter(
              (u) =>
                u.empresaId === where.empresaId && where.id.in.includes(u.id),
            ),
          ),
      ),
    },
    notificacionCampo: {
      createMany: jest.fn(
        (args: { data: { usuarioDestinatarioId: number }[] }) =>
          Promise.resolve({ count: args.data.length }),
      ),
      findFirst: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            id: number;
            empresaId: number;
            usuarioDestinatarioId: number;
          };
        }) =>
          Promise.resolve(
            where.id === 99 &&
              where.empresaId === 10 &&
              where.usuarioDestinatarioId === 1
              ? { referenciaId: 8 }
              : null,
          ),
      ),
    },
    cargaInventarioCampo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 8,
        fecha: new Date('2026-10-26'),
        cantidad: 12,
        vencimiento: new Date('2026-10-27'),
        creadaEn: new Date('2026-10-26T10:00Z'),
        actualizadaEn: new Date('2026-10-26T11:00Z'),
        producto: {
          itemcode: 'P1',
          itemname: 'Producto con nombre '.repeat(20),
        },
        local: { CardCode: 'L1', CardName: 'Local con nombre '.repeat(20) },
        usuario: {
          id: 3,
          nombre: 'Ana',
          apellido: 'Pérez',
          rol: { descripcion: 'Impulsador' },
        },
      }),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { CardCode: 'L1', Address: 'Centro', Street: 'Calle 1' },
      ]),
  };
  return {
    prisma,
    servicio: new NotificacionService(prisma as unknown as PrismaService),
  };
}

describe('notificaciones de campo', () => {
  it.each(['comentario', 'foto', 'novedad'] as const)(
    'envía %s a todos los superiores del emisor',
    async (tipo) => {
      const { servicio, prisma } = preparar();
      if (tipo === 'comentario')
        await servicio.crearNotificacionComentario(10, 3, 8, 'Tarea');
      if (tipo === 'foto')
        await servicio.crearNotificacionFoto(10, 3, 8, 'Tarea', 'ANTES');
      if (tipo === 'novedad')
        await servicio.crearNotificacionNovedad(10, 3, 8, 'Local', 'RECLAMO');
      expect(
        prisma.notificacionCampo.createMany.mock.calls[0][0].data.map(
          (n) => n.usuarioDestinatarioId,
        ),
      ).toEqual([2, 1]);
    },
  );
  it('envía respuestas a los otros participantes de la cadena sin repetir al emisor', async () => {
    const { servicio, prisma } = preparar();
    await servicio.crearNotificacionRespuestaNovedad(10, 2, 3, 8, 'Novedad');
    expect(
      prisma.notificacionCampo.createMany.mock.calls[0][0].data.map(
        (n) => n.usuarioDestinatarioId,
      ),
    ).toEqual([3, 1]);
  });
  it('avisa el cierre al autor y a los demás superiores', async () => {
    const { servicio, prisma } = preparar();
    await servicio.crearNotificacionNovedadActualizada(
      10,
      2,
      3,
      8,
      'Local',
      'CERRADA',
    );
    expect(
      prisma.notificacionCampo.createMany.mock.calls[0][0].data.map(
        (n) => n.usuarioDestinatarioId,
      ),
    ).toEqual([3, 1]);
  });
  it('devuelve todos los datos de inventario sin recortar nombres ni exigir permiso de edición', async () => {
    const { servicio, prisma } = preparar();
    const detalle = await servicio.detalleInventario(1, 10, 99);
    expect(detalle).toMatchObject({
      cantidad: 12,
      fecha: '2026-10-26',
      vencimiento: '2026-10-27',
      autor: { nombre: 'Ana Pérez', rol: 'Impulsador' },
      local: { codigo: 'L1', direccion: 'Centro, Calle 1' },
    });
    expect(detalle.producto.nombre.length).toBeGreaterThan(250);
    expect(detalle.local.nombre.length).toBeGreaterThan(250);
    expect(prisma.cargaInventarioCampo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8, empresaId: 10 } }),
    );
  });
  it.each([
    [2, 10, 99],
    [1, 20, 99],
    [1, 10, 999],
  ])(
    'rechaza avisos ajenos, de otra empresa o inexistentes',
    async (usuario, empresa, id) => {
      const { servicio, prisma } = preparar();
      await expect(
        servicio.detalleInventario(usuario, empresa, id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cargaInventarioCampo.findFirst).not.toHaveBeenCalled();
    },
  );
});
