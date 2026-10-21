import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from './productos.service';
import {
  CrearProductoDto,
  ConsultaCatalogoDto,
  ProductoCatalogoParams,
} from './dto/catalogo.dto';
describe('Maestro OITM y precios ITM1 con pantalla compatible', () => {
  function preparar() {
    const maestro = {
      itemcode: 'A',
      itemname: 'Artículo',
      iva: 10,
      itmsgrpcode: 100,
      inventory: 'Y',
      tipo: null,
      validFor: 'Y',
      frozenFor: 'N',
    };
    const fila = {
      id: 9007199254740993n,
      itemcode: 'A',
      pricelist: 1,
      price: new Decimal('999999999999999.123456'),
      producto: maestro,
    };
    const db = {
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      empresa: {
        findUnique: jest.fn().mockResolvedValue({ id: 20 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: 20, nombre: 'Empresa' }]),
      },
      producto: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue(maestro),
      },
      productoPrecio: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([fila]),
        findUnique: jest.fn().mockResolvedValue(fila),
        create: jest.fn().mockResolvedValue(fila),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(fila),
        delete: jest.fn().mockResolvedValue(fila),
      },
      socioNegocioListaPrecio: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ListNum: 1, ListName: 'General' }]),
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 20 }]),
    };
    const prisma = {
      ...db,
      $transaction: jest.fn((fn: (tx: typeof db) => Promise<unknown>) =>
        fn(db),
      ),
    };
    return {
      db,
      prisma,
      service: new ProductosService(prisma as unknown as PrismaService),
      datos: {
        itemcode: 'A',
        itemname: 'Artículo',
        iva: 10,
        itmsgrpcode: 100,
        pricelist: 1,
        price: '999999999999999.123456',
      },
    };
  }
  it('proyecta maestro y precio con ID y decimal exactos y lista aislada por empresa', async () => {
    const { db, service } = preparar();
    const r = await service.productos(20, {});
    expect(r.limit).toBe(7);
    expect(r.items[0]).toMatchObject({
      id: '9007199254740993',
      itemname: 'Artículo',
      price: '999999999999999.123456',
      pricelistname: 'General',
      itmsgrpnam: null,
    });
    expect(db.productoPrecio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20 }, skip: 0, take: 7 }),
    );
    expect(db.socioNegocioListaPrecio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 20, ListNum: { in: [1] } },
        take: 1,
      }),
    );
    expect(db.usuario.findFirst).not.toHaveBeenCalled();
  });
  it('crea maestro y precio en una transacción sin mezclar sus campos', async () => {
    const { db, prisma, service, datos } = preparar();
    await service.crearProducto(20, datos);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.producto.createMany).toHaveBeenCalledWith({
      data: [
        {
          empresaId: 20,
          itemcode: 'A',
          itemname: 'Artículo',
          iva: 10,
          itmsgrpcode: 100,
          inventory: undefined,
          tipo: undefined,
        },
      ],
      skipDuplicates: true,
    });
    expect(db.productoPrecio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          empresaId: 20,
          itemcode: 'A',
          pricelist: 1,
          price: datos.price,
        },
      }),
    );
  });
  it('bulk conserva primera pareja, no actualiza maestros existentes y cuenta omitidos', async () => {
    const { db, service, datos } = preparar();
    expect(
      await service.crearProductos(20, [
        datos,
        { ...datos, itemname: 'Repetido' },
        { ...datos, pricelist: 2 },
      ]),
    ).toEqual({
      recibidos: 3,
      insertados: 1,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
    });
    expect(db.producto.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          {
            empresaId: 20,
            itemcode: 'A',
            itemname: 'Artículo',
            iva: 10,
            itmsgrpcode: 100,
            inventory: undefined,
            tipo: undefined,
          },
        ],
      }),
    );
    expect(db.productoPrecio.createMany).toHaveBeenCalledWith({
      data: [
        { empresaId: 20, itemcode: 'A', pricelist: 1, price: datos.price },
        { empresaId: 20, itemcode: 'A', pricelist: 2, price: datos.price },
      ],
      skipDuplicates: true,
    });
    expect(db.producto.upsert).not.toHaveBeenCalled();
  });
  it('edita el maestro compartido y el precio de la empresa; borrar conserva el maestro', async () => {
    const { db, service, datos } = preparar();
    await service.editarProducto(20, 'A', 1, datos);
    expect(db.producto.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId_itemcode: { empresaId: 20, itemcode: 'A' } },
      }),
    );
    expect(db.productoPrecio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId_itemcode_pricelist: {
            empresaId: 20,
            itemcode: 'A',
            pricelist: 1,
          },
        },
      }),
    );
    await service.eliminarProducto(20, 'A', 1);
    expect(db.productoPrecio.delete).toHaveBeenCalledWith({
      where: {
        empresaId_itemcode_pricelist: {
          empresaId: 20,
          itemcode: 'A',
          pricelist: 1,
        },
      },
      select: { id: true },
    });
  });
  it('no edita una fila ajena ni opera con una empresa ausente', async () => {
    const { db, service, datos } = preparar();
    db.productoPrecio.findUnique.mockResolvedValue(null);
    await expect(
      service.editarProducto(20, '0001', 2, datos),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.producto.upsert).not.toHaveBeenCalled();
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(service.crearProducto(20, datos)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.productoPrecio.create).not.toHaveBeenCalled();
  });
  it('conserva 409 y permisos especiales', async () => {
    const { db, service, datos } = preparar();
    db.productoPrecio.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.crearProducto(20, datos)).rejects.toBeInstanceOf(
      ConflictException,
    );
    db.usuario.findFirst.mockResolvedValue(null);
    await expect(service.autorizar(2, 20)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('acepta PriceList int4 y metadatos nulos; rechaza maestros fuera de longitud/rango', async () => {
    expect(
      await validate(
        plainToInstance(CrearProductoDto, {
          itemcode: 'A',
          pricelist: 2147483647,
          itemname: null,
          iva: null,
          itmsgrpcode: null,
        }),
      ),
    ).toHaveLength(0);
    for (const valor of [
      { itemcode: 'x'.repeat(16) },
      { itmsgrpcode: 32768 },
      { price: '1.1234567' },
    ])
      expect(
        (
          await validate(
            plainToInstance(CrearProductoDto, {
              itemcode: 'A',
              pricelist: 1,
              ...valor,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(ConsultaCatalogoDto, { pricelist: '2147483647' }),
      ),
    ).toHaveLength(0);
  });
  it.each(['00001', 'A/B + 1', '123456789012345'])(
    'conserva ItemCode textual %s y valida la lista',
    async (ItemCode) => {
      const p = plainToInstance(ProductoCatalogoParams, {
        empresaId: 20,
        ItemCode,
        PriceList: '2',
      });
      expect(await validate(p)).toHaveLength(0);
      expect(p.ItemCode).toBe(ItemCode);
      expect(p.PriceList).toBe(2);
    },
  );
  it.each(['', '1234567890123456'])(
    'rechaza ItemCode inválido %s',
    async (ItemCode) => {
      expect(
        (
          await validate(
            plainToInstance(ProductoCatalogoParams, {
              empresaId: 20,
              ItemCode,
              PriceList: '1',
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
});
