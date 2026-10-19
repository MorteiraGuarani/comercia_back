import { ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const decimal = (valor: string) => ({
  toFixed: (digitos: number) => Number(valor).toFixed(digitos),
});

describe('Inventario del impulsador', () => {
  function preparar() {
    const prisma = {
      producto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(7),
            itemcode: 'A-1',
            itemname: 'Carne molida',
            pricelist: 1,
            pricelistname: 'Minorista',
            price: decimal('25000'),
          },
          {
            id: BigInt(8),
            itemcode: 'A-1',
            itemname: 'Carne molida',
            pricelist: 2,
            pricelistname: null,
            price: null,
          },
        ]),
      },
    };
    const plataforma = {
      exigirAccesoPagina: jest
        .fn()
        .mockResolvedValue({ id: 30, empresaId: 10, rolId: 4 }),
    };
    const service = new InventarioService(
      prisma as unknown as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    return { prisma, plataforma, service };
  }

  it('entrega todas las filas de la empresa del usuario, una por artículo y lista, sin paginar', async () => {
    const { prisma, plataforma, service } = preparar();
    const respuesta = await service.listarItems(30);

    expect(plataforma.exigirAccesoPagina).toHaveBeenCalledWith(
      30,
      'mi-jornada',
      'inventario',
    );
    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: { empresaId: 10 },
      select: {
        id: true,
        itemcode: true,
        itemname: true,
        pricelist: true,
        pricelistname: true,
        price: true,
      },
      orderBy: [{ itemcode: 'asc' }, { pricelist: 'asc' }],
      take: 50_001,
    });
    expect(respuesta).toEqual({
      items: [
        {
          id: '7',
          itemcode: 'A-1',
          itemname: 'Carne molida',
          pricelist: 1,
          pricelistname: 'Minorista',
          price: '25000.000000',
        },
        {
          id: '8',
          itemcode: 'A-1',
          itemname: 'Carne molida',
          pricelist: 2,
          pricelistname: null,
          price: null,
        },
      ],
      total: 2,
    });
  });

  it('no entrega un catálogo truncado si supera el máximo', async () => {
    const { prisma, service } = preparar();
    prisma.producto.findMany.mockResolvedValue(
      Array.from({ length: 50_001 }, (_, i) => ({
        id: BigInt(i),
        itemcode: `A-${i}`,
        itemname: 'Artículo',
        pricelist: 1,
        pricelistname: null,
        price: null,
      })),
    );
    await expect(service.listarItems(30)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('no consulta artículos si el rol no tiene la página', async () => {
    const { prisma, plataforma, service } = preparar();
    plataforma.exigirAccesoPagina.mockRejectedValue(
      new ForbiddenException('No tenés acceso a esta sección'),
    );
    await expect(service.listarItems(30)).rejects.toThrow(ForbiddenException);
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
  });
});
