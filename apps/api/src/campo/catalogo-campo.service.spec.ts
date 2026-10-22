import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';

describe('Catálogo de tareas', () => {
  it('edita el cliente y su dirección principal solo dentro de la empresa del usuario', async () => {
    const tx = {
      socioNegocio: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          CardCode: 'C001',
          CardName: 'Granusa',
          LicTradNum: null,
          U_Latitud: '-25.3000000',
          U_Longitud: '-57.6000000',
        }),
      },
      socioNegocioDireccion: {
        // Sin dirección de entrega: se edita la primera que tenga.
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 7n }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({ empresaId: 10 }),
    };
    const service = new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    await expect(
      service.editarLocal(1, 'C001', {
        CardName: 'Granusa',
        Address: 'Itauguá',
        Street: 'Gobernador Irala',
        latitud: -25.3,
        longitud: -57.6,
      }),
    ).resolves.toMatchObject({
      id: 'C001',
      direccion: 'Itauguá, Gobernador Irala',
      latitud: -25.3,
      ruc: '',
    });
    expect(tx.socioNegocio.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 10, CardCode: 'C001' },
      data: {
        CardName: 'Granusa',
        LicTradNum: null,
        U_Latitud: '-25.3000000',
        U_Longitud: '-57.6000000',
      },
    });
    expect(tx.socioNegocioDireccion.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { Address: 'Itauguá', Street: 'Gobernador Irala' },
      select: { id: true },
    });
    expect(tx.socioNegocioDireccion.create).not.toHaveBeenCalled();
    await expect(
      service.editarLocal(1, 'OTRA', { CardName: 'X' }),
    ).rejects.toThrow('Cliente no disponible');
    await expect(
      service.editarLocal(1, 'C001', { CardName: 'X', latitud: 1 }),
    ).rejects.toThrow('Marcá el punto completo en el mapa');
  });

  it('filtra antes de paginar y calcula el resumen de toda la empresa', async () => {
    const prisma = {
      tareaCampo: {
        count: jest
          .fn()
          .mockResolvedValueOnce(9)
          .mockResolvedValueOnce(30)
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(15),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 8, nombre: 'Precios', locales: [] }]),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({
        id: 1,
        empresaId: 10,
        permisosTareas: ['CONSULTAR', 'CREAR', 'EDITAR', 'ARCHIVAR'],
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };
    const service = new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    const respuesta = await service.tareas(1, {
      page: 2,
      limit: 7,
      categoria: 'Precios',
      tipo: 'con_fotos',
      buscar: 'cartel',
    });
    expect(acceso.gestionar).toHaveBeenCalledWith(1, 'tareas');
    expect(prisma.tareaCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 7,
        take: 7,
        where: {
          empresaId: 10,
          destinatario: 'IMPULSADOR',
          equipoCampoId: 1,
          archivadaEn: null,
          categoria: 'Precios',
          requiereFotos: true,
          OR: [
            { nombre: { contains: 'cartel', mode: 'insensitive' } },
            { descripcion: { contains: 'cartel', mode: 'insensitive' } },
          ],
        },
      }),
    );
    expect(respuesta.resumen).toEqual({
      total: 30,
      obligatorias: 12,
      conFotos: 15,
    });
    expect(respuesta.total).toBe(9);
  });
});
