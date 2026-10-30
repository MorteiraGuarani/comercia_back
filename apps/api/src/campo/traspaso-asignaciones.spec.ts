import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanificacionCampoService } from './planificacion-campo.service';
import type { TraspasoAsignacionesDto } from './dto/traspaso.dto';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

// Fecha lejana: el traspaso exige hoy o después y no depende del reloj del test.
const FECHA = '2099-01-10';
const DIA = new Date('2099-01-10T00:00:00.000Z');
const ANTERIOR = new Date('2099-01-09T00:00:00.000Z');

function preparar() {
  const tx = {
    $queryRaw: jest.fn(),
    asignacionCampo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          localId: 'C1',
          fechaDesde: new Date('2099-01-01'),
          fechaHasta: null,
        },
      ]),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 50 }),
    },
    backupCampo: { updateMany: jest.fn() },
    usuario: { updateMany: jest.fn() },
    horarioCampo: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 2,
      empresaId: 10,
      equipoCampo: {
        id: 1,
        nombre: 'Repositores',
        tipo: 'REPOSITOR',
        activo: true,
      },
    }),
    subordinado: jest.fn().mockResolvedValue({ id: 0 }),
  };
  return {
    tx,
    prisma,
    acceso,
    servicio: new PlanificacionCampoService(prisma as never, acceso as never),
  };
}

const pedido = (
  extra: Partial<TraspasoAsignacionesDto> = {},
): TraspasoAsignacionesDto => ({
  origenId: 4,
  destinoId: 5,
  fecha: FECHA,
  seleccion: { locales: ['C1'], excluir: [] },
  ...extra,
});

it('cierra la asignación del origen el día anterior y crea la del destino con sus franjas, sin tocar el historial', async () => {
  const { tx, prisma, acceso, servicio } = preparar();
  tx.horarioCampo.findMany.mockResolvedValueOnce([
    {
      empresaId: 10,
      localId: 'C1',
      fechaDesde: new Date('2098-12-01'),
      fechaHasta: null,
      entrada: '08:00',
      salida: '12:00',
    },
  ]);
  const resultado = await servicio.traspasarAsignaciones(2, pedido());
  expect(acceso.subordinado).toHaveBeenCalledTimes(2);
  expect(tx.asignacionCampo.update).toHaveBeenCalledWith({
    where: { id: 1 },
    data: { fechaHasta: ANTERIOR },
  });
  expect(tx.asignacionCampo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        empresaId: 10,
        localId: 'C1',
        usuarioId: 5,
        fechaDesde: DIA,
        fechaHasta: null,
      },
    }),
  );
  // La franja copiada empieza en la fecha del traspaso y cuelga de la asignación nueva.
  expect(tx.horarioCampo.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        asignacionId: 50,
        fechaDesde: DIA,
        entrada: '08:00',
      }),
    ],
  });
  expect(tx.usuario.updateMany).toHaveBeenCalledWith({
    where: { id: 4, empresaId: 10, localPrincipalId: 'C1' },
    data: { localPrincipalId: null },
  });
  expect(resultado).toEqual({ pasados: 1, intercambiados: 0, omitidos: [] });
  expect(prisma.$transaction).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({ isolationLevel: 'Serializable' }),
  );
});

it('si el destino ya atendía el local, solo cierra la del origen y lo informa', async () => {
  const { tx, servicio } = preparar();
  tx.asignacionCampo.count.mockResolvedValueOnce(1);
  const resultado = await servicio.traspasarAsignaciones(2, pedido());
  expect(tx.asignacionCampo.update).toHaveBeenCalled();
  expect(tx.asignacionCampo.create).not.toHaveBeenCalled();
  expect(resultado.pasados).toBe(0);
  expect(resultado.omitidos).toEqual([
    {
      localId: 'C1',
      motivo: expect.stringContaining('Ya lo atendía') as unknown,
    },
  ]);
});

it('"todos" se resuelve en el servidor excluyendo los desmarcados', async () => {
  const { tx, servicio } = preparar();
  await servicio.traspasarAsignaciones(
    2,
    pedido({ seleccion: { todos: true, excluir: ['C9'], locales: [] } }),
  );
  expect(tx.asignacionCampo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        usuarioId: 4,
        localId: { notIn: ['C9'] },
      }) as unknown,
    }),
  );
});

it('intercambia en las dos direcciones dentro de la misma transacción', async () => {
  const { tx, servicio } = preparar();
  tx.asignacionCampo.findMany
    .mockResolvedValueOnce([
      {
        id: 1,
        localId: 'C1',
        fechaDesde: new Date('2099-01-01'),
        fechaHasta: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 2,
        localId: 'C2',
        fechaDesde: new Date('2099-01-01'),
        fechaHasta: null,
      },
    ]);
  const resultado = await servicio.traspasarAsignaciones(
    2,
    pedido({ intercambio: { locales: ['C2'], excluir: [] } }),
  );
  expect(tx.asignacionCampo.create).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      data: expect.objectContaining({ localId: 'C1', usuarioId: 5 }) as unknown,
    }),
  );
  expect(tx.asignacionCampo.create).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      data: expect.objectContaining({ localId: 'C2', usuarioId: 4 }) as unknown,
    }),
  );
  expect(resultado).toEqual({ pasados: 1, intercambiados: 1, omitidos: [] });
});

it('rechaza un local que está en las dos listas sin modificar nada', async () => {
  const { tx, servicio } = preparar();
  await expect(
    servicio.traspasarAsignaciones(
      2,
      pedido({ intercambio: { locales: ['C1'], excluir: [] } }),
    ),
  ).rejects.toThrow(BadRequestException);
  expect(tx.asignacionCampo.update).not.toHaveBeenCalled();
});

it('rechaza el mismo usuario, una persona fuera del equipo, una fecha pasada y un local que el origen no atiende', async () => {
  const caso = preparar();
  await expect(
    caso.servicio.traspasarAsignaciones(2, pedido({ destinoId: 4 })),
  ).rejects.toThrow(BadRequestException);
  caso.acceso.subordinado.mockRejectedValueOnce(
    new NotFoundException('Usuario no disponible en tu equipo'),
  );
  await expect(
    caso.servicio.traspasarAsignaciones(2, pedido()),
  ).rejects.toThrow(NotFoundException);
  await expect(
    caso.servicio.traspasarAsignaciones(2, pedido({ fecha: '2000-01-01' })),
  ).rejects.toThrow('anterior a hoy');
  expect(caso.prisma.$transaction).not.toHaveBeenCalled();
  caso.tx.asignacionCampo.findMany.mockResolvedValueOnce([]);
  await expect(
    caso.servicio.traspasarAsignaciones(2, pedido()),
  ).rejects.toThrow('No atiende estos locales');
  expect(caso.tx.asignacionCampo.update).not.toHaveBeenCalled();
});
