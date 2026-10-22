import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';

describe('Catálogo de tareas', () => {
  it('guarda la ubicación en OCRD solo dentro de la empresa del usuario', async () => {
    const prisma = {
      socioNegocio: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          CardCode: 'C001',
          CardName: 'Granusa',
          U_Latitud: '-25.3000000',
          U_Longitud: '-57.6000000',
        }),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({ empresaId: 10 }),
    };
    const service = new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    await expect(
      service.ubicarLocal(1, 'C001', { latitud: -25.3, longitud: -57.6 }),
    ).resolves.toMatchObject({ id: 'C001', nombre: 'Granusa', latitud: -25.3 });
    expect(prisma.socioNegocio.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 10, CardCode: 'C001' },
      data: { U_Latitud: '-25.3000000', U_Longitud: '-57.6000000' },
    });
    await expect(
      service.ubicarLocal(1, 'OTRA', { latitud: 1, longitud: 1 }),
    ).rejects.toThrow('Local no disponible');
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
