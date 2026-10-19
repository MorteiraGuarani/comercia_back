import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogoCampoService } from './catalogo-campo.service';
import { LocalCampoDto } from './dto/campo.dto';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function preparar() {
  const tx = {
    $queryRaw: jest.fn(),
    clienteCampo: {
      findFirst: jest.fn().mockResolvedValue({ id: 4 }),
      update: jest.fn(),
    },
    localCampo: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 8, clienteId: null }),
      update: jest.fn().mockResolvedValue({ id: 8, clienteId: 4 }),
    },
    usuario: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    localCampo: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 1,
      empresaId: 10,
      equipoCampo: { id: 1, tipo: 'IMPULSADOR', activo: true },
    }),
  };
  // Las altas y ediciones pasan por administrar(), que valida igual que gestionar().
  Object.assign(acceso, {
    administrar: jest.fn((usuarioId: number, pagina: string): unknown =>
      acceso.gestionar(usuarioId, pagina),
    ),
  });
  return {
    tx,
    prisma,
    acceso,
    servicio: new CatalogoCampoService(prisma as never, acceso as never),
  };
}

describe('Borrado de clientes y locales', () => {
  it('conserva los locales sin cliente por defecto y mantiene sus historiales', async () => {
    const { tx, servicio } = preparar();
    await expect(servicio.eliminarCliente(1, 4)).resolves.toEqual({ ok: true });
    expect(tx.clienteCampo.findFirst).toHaveBeenCalledWith({
      where: { id: 4, empresaId: 10, eliminadoEn: null },
      select: { id: true },
    });
    expect(tx.localCampo.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.localCampo.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 10, clienteId: 4 },
      data: { clienteId: null },
    });
    expect(tx.usuario.updateMany).not.toHaveBeenCalled();
    expect(tx.clienteCampo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { activo: false, eliminadoEn: expect.any(Date) as Date },
      }),
    );
  });

  it('elimina tambien los locales solo cuando se solicita y limpia su preferencia', async () => {
    const { tx, acceso, servicio } = preparar();
    await servicio.eliminarCliente(1, 4, { eliminarLocales: true });
    expect(acceso.gestionar).toHaveBeenCalledWith(1, 'locales');
    expect(tx.localCampo.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 10, clienteId: 4, eliminadoEn: null },
      data: { activo: false, eliminadoEn: expect.any(Date) as Date },
    });
    expect(tx.localCampo.updateMany).toHaveBeenLastCalledWith({
      where: { empresaId: 10, clienteId: 4 },
      data: { clienteId: null },
    });
    expect(tx.usuario.updateMany).toHaveBeenCalledWith({
      where: {
        empresaId: 10,
        localPrincipal: { empresaId: 10, clienteId: 4, eliminadoEn: null },
      },
      data: { localPrincipalId: null },
    });
  });

  it('no borra locales sin permiso de administrarlos', async () => {
    const { tx, acceso, prisma, servicio } = preparar();
    acceso.gestionar
      .mockResolvedValueOnce({ id: 1, empresaId: 10 })
      .mockRejectedValueOnce(new ForbiddenException());
    await expect(
      servicio.eliminarCliente(1, 4, { eliminarLocales: true }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.clienteCampo.update).not.toHaveBeenCalled();
  });

  it('rechaza clientes ajenos o ya eliminados antes de modificar locales', async () => {
    const { tx, servicio } = preparar();
    tx.clienteCampo.findFirst.mockResolvedValue(null);
    await expect(servicio.eliminarCliente(1, 99)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.localCampo.updateMany).not.toHaveBeenCalled();
    expect(tx.clienteCampo.update).not.toHaveBeenCalled();
  });

  it('solo elimina locales disponibles de la empresa del actor', async () => {
    const { tx, servicio } = preparar();
    await expect(servicio.eliminarLocal(1, 99)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.localCampo.findFirst).toHaveBeenCalledWith({
      where: { id: 99, empresaId: 10, eliminadoEn: null },
      select: { id: true },
    });
    expect(tx.localCampo.updateMany).not.toHaveBeenCalled();
    tx.localCampo.findFirst.mockResolvedValueOnce({ id: 8 });
    await servicio.eliminarLocal(1, 8);
    expect(tx.localCampo.updateMany).toHaveBeenCalledWith({
      where: { id: 8, empresaId: 10, eliminadoEn: null },
      data: { activo: false, eliminadoEn: expect.any(Date) as Date },
    });
  });

  it('lista y pagina los locales sin cliente dentro de su empresa', async () => {
    const { prisma, servicio } = preparar();
    await servicio.locales(1, {
      sinCliente: true,
      estado: 'activos',
      page: 2,
      limit: 7,
    });
    expect(prisma.localCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 10,
          eliminadoEn: null,
          activo: true,
          clienteId: null,
        },
        skip: 7,
        take: 7,
      }),
    );
  });

  it('devuelve los contadores del panel de locales solo cuando se piden', async () => {
    const { prisma, servicio } = preparar();
    const sinResumen = await servicio.locales(1, { page: 1, limit: 7 });
    expect(sinResumen).not.toHaveProperty('resumen');
    expect(prisma.localCampo.count).toHaveBeenCalledTimes(1);

    prisma.localCampo.count
      .mockReset()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(3);
    const conResumen = await servicio.locales(1, {
      conResumen: true,
      clienteId: 4,
      estado: 'inactivos',
      page: 1,
      limit: 7,
    });
    expect(conResumen).toMatchObject({
      total: 5,
      resumen: { total: 12, activos: 9, inactivos: 3, sinCliente: 3 },
    });
    // Los contadores ignoran el estado elegido y "sin cliente" usa toda la empresa.
    expect(prisma.localCampo.count).toHaveBeenNthCalledWith(2, {
      where: { empresaId: 10, eliminadoEn: null, clienteId: 4 },
    });
    expect(prisma.localCampo.count).toHaveBeenNthCalledWith(3, {
      where: { empresaId: 10, eliminadoEn: null, clienteId: 4, activo: true },
    });
    expect(prisma.localCampo.count).toHaveBeenNthCalledWith(4, {
      where: { empresaId: 10, eliminadoEn: null, clienteId: null },
    });
  });

  it('permite guardar sin cliente y asociar despues un unico cliente de la misma empresa', async () => {
    const { tx, servicio } = preparar();
    const dto = Object.assign(new LocalCampoDto(), {
      nombre: 'Sucursal',
      direccion: 'Calle 1',
      latitud: -25.3,
      longitud: -57.6,
    });
    await servicio.guardarLocal(1, dto);
    expect(tx.clienteCampo.findFirst).not.toHaveBeenCalled();
    expect(tx.localCampo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clienteId: null,
          empresaId: 10,
        }) as unknown,
      }),
    );
    tx.localCampo.findFirst.mockResolvedValueOnce({ id: 8 });
    await servicio.guardarLocal(1, { ...dto, clienteId: 4 }, 8);
    expect(tx.clienteCampo.findFirst).toHaveBeenCalledWith({
      where: { id: 4, empresaId: 10, activo: true, eliminadoEn: null },
      select: { id: true },
    });
    expect(tx.localCampo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clienteId: 4 }) as unknown,
      }),
    );
    tx.clienteCampo.findFirst.mockResolvedValueOnce(null);
    await expect(
      servicio.guardarLocal(1, { ...dto, clienteId: 20 }, 8),
    ).rejects.toThrow(NotFoundException);
    expect(tx.localCampo.update).toHaveBeenCalledTimes(1);
  });
});
