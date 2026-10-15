import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from './productos.service';
import {
  ConsultaCatalogoDto,
  CrearProductoDto,
  ProductoCatalogoParams,
} from './dto/catalogo.dto';

describe('Catálogo tbl_itm1 por empresa', () => {
  const producto = {
    itemcode: '0001',
    itemname: 'Artículo',
    iva: 10,
    itmsgrpcode: 1,
    itmsgrpnam: null,
    inventory: 'Y',
    tipo: null,
    pricelist: 1,
    pricelistname: 'General',
    price: '999999999999999.123456',
  };
  const modelo = () => ({
    count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(1),
    findMany: jest.fn(),
    create: jest.fn(),
    createManyAndReturn: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });
  let db: {
    usuario: { findFirst: jest.Mock };
    empresa: { findUnique: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    producto: ReturnType<typeof modelo>;
  };
  let service: ProductosService;
  beforeEach(() => {
    const fila = {
      ...producto,
      id: 9007199254740993n,
      price: new Decimal(producto.price),
    };
    db = {
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      empresa: {
        findUnique: jest.fn().mockResolvedValue({ id: 20 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      producto: modelo(),
    };
    db.producto.findMany.mockResolvedValue([fila]);
    db.producto.create.mockResolvedValue(fila);
    db.producto.update.mockResolvedValue(fila);
    service = new ProductosService(db as unknown as PrismaService);
  });

  it('permite lecturas y mutaciones sin consultar una sesión de usuario', async () => {
    db.usuario.findFirst.mockResolvedValue(null);
    for (const accion of [
      () => service.empresas({}),
      () => service.productos(20, {}),
      () => service.productos(20, {}, true),
      () => service.crearProducto(20, producto),
      () => service.editarProducto(20, '5', producto),
      () => service.eliminarProducto(20, '5'),
    ])
      await expect(accion()).resolves.toBeDefined();
    expect(db.usuario.findFirst).not.toHaveBeenCalled();
  });

  it('no opera sobre empresas inexistentes', async () => {
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(service.crearProducto(20, producto)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.producto.create).not.toHaveBeenCalled();
  });

  it('conserva IDs BIGINT y decimales exactos y pagina dentro de la empresa', async () => {
    const resultado = await service.productos(20, {
      itemcode: '0001',
      pricelist: 0,
      page: 2,
      limit: 7,
      buscar: 'Artículo',
    });
    const consulta = db.producto.count.mock.calls[0][0] as { where: unknown };
    expect(consulta.where).toMatchObject({
      empresaId: 20,
      itemcode: '0001',
      pricelist: 0,
    });
    expect(db.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 7, take: 7 }),
    );
    expect(resultado.items[0]).toEqual({ ...producto, id: '9007199254740993' });
    expect(JSON.stringify(resultado)).toContain(producto.price);
    const opciones = await service.productos(20, {}, true);
    expect(opciones.items[0]).toEqual({
      id: '9007199254740993',
      nombre: '0001 · Artículo · Lista 1',
    });
  });

  it('usa la empresa de la ruta y modifica o elimina solo la fila indicada', async () => {
    const creado = await service.crearProducto(20, producto);
    expect(creado.price).toBe(producto.price);
    expect(db.producto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...producto, empresaId: 20 } }),
    );
    await service.editarProducto(20, '9007199254740993', producto);
    expect(db.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9007199254740993n, empresaId: 20 },
        data: producto,
      }),
    );
    await service.eliminarProducto(20, '9007199254740993');
    expect(db.producto.delete).toHaveBeenCalledWith({
      where: { id: 9007199254740993n, empresaId: 20 },
      select: { id: true },
    });
  });

  it('devuelve nulos y traduce duplicados o IDs de otras empresas', async () => {
    db.producto.create.mockResolvedValue({ ...producto, id: 5n, price: null });
    expect(
      (await service.crearProducto(20, { ...producto, price: null })).price,
    ).toBeNull();
    db.producto.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.crearProducto(20, producto)).rejects.toThrow(
      ConflictException,
    );
    db.producto.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.editarProducto(20, '5', producto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('crea un lote con el mismo artículo en listas distintas y conserva el orden', async () => {
    const lote = [13, 14, 16, 21, 22].map((pricelist) => ({
      ...producto,
      itemcode: 'AV00018',
      pricelist,
      price: 141650,
    }));
    db.producto.createManyAndReturn.mockResolvedValue(
      lote
        .map((p) => ({
          ...p,
          id: BigInt(p.pricelist),
          price: new Decimal(p.price),
        }))
        .reverse(),
    );
    const resultado = await service.crearProductos(20, lote);
    expect(resultado.map((p) => p.pricelist)).toEqual([13, 14, 16, 21, 22]);
    expect(resultado[0].price).toBe('141650.000000');
    expect(db.producto.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: lote.map((p) => ({ ...p, empresaId: 20 })),
      }),
    );
    expect(db.producto.create).not.toHaveBeenCalled();
  });

  it('rechaza parejas repetidas dentro del lote antes de insertar', async () => {
    await expect(
      service.crearProductos(20, [producto, producto]),
    ).rejects.toMatchObject({
      response: {
        statusCode: 409,
        index: 1,
        itemcode: '0001',
        pricelist: 1,
      },
    });
    expect(db.producto.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('identifica la fila en conflicto con una pareja existente de la misma empresa', async () => {
    db.producto.createManyAndReturn.mockRejectedValue({ code: 'P2002' });
    db.producto.findMany.mockResolvedValue([
      { itemcode: '0001', pricelist: 1 },
    ]);
    await expect(
      service.crearProductos(20, [{ ...producto, pricelist: 13 }, producto]),
    ).rejects.toMatchObject({
      response: {
        statusCode: 409,
        index: 1,
        itemcode: '0001',
        pricelist: 1,
      },
    });
    expect(db.producto.findMany).toHaveBeenCalledWith({
      where: {
        empresaId: 20,
        OR: [
          { itemcode: '0001', pricelist: 13 },
          { itemcode: '0001', pricelist: 1 },
        ],
      },
      select: { itemcode: true, pricelist: true },
      take: 2,
    });
  });

  it('no ejecuta el lote sobre una empresa inexistente', async () => {
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(service.crearProductos(20, [producto])).rejects.toThrow(
      NotFoundException,
    );
    expect(db.producto.createManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    0.000001,
    15000.123456,
    '0',
    '-1',
    '0.000001',
    '999999999999999.123456',
    null,
    undefined,
  ])('acepta price %s', async (price) => {
    expect(
      await validate(plainToInstance(CrearProductoDto, { ...producto, price })),
    ).toHaveLength(0);
  });
  it.each([
    '1.1234567',
    '1000000000000000',
    '1e3',
    1.1234567,
    1000000000000000,
    Number.NaN,
    Infinity,
    {},
    [],
  ])('rechaza price %s sin redondearlo', async (price) => {
    const errores = await validate(
      plainToInstance(CrearProductoDto, { ...producto, price }),
    );
    expect(errores.some((e) => e.property === 'price')).toBe(true);
  });
  it.each([
    ['iva', 32768],
    ['iva', -32769],
    ['pricelist', 32768],
    ['pricelist', -32769],
    ['itmsgrpcode', 2147483648],
    ['tipo', 'a'.repeat(51)],
    ['inventory', 'YY'],
    ['itemcode', '   '],
    ['itemname', null],
    ['pricelist', null],
  ])('valida el tipo SQL de %s', async (campo, valor) => {
    const errores = await validate(
      plainToInstance(CrearProductoDto, { ...producto, [campo]: valor }),
    );
    expect(errores.some((e) => e.property === campo)).toBe(true);
  });
  it('permite omitir los campos SQL anulables y conserva el default de inventory', async () => {
    const minimo = {
      itemcode: '0001',
      itemname: 'Artículo',
      iva: -32768,
      itmsgrpcode: -2147483648,
      pricelist: 32767,
    };
    expect(
      await validate(plainToInstance(CrearProductoDto, minimo)),
    ).toHaveLength(0);
    await service.crearProducto(20, minimo);
    expect(db.producto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...minimo, empresaId: 20 } }),
    );
  });
  it.each(['9007199254740993', '9223372036854775807'])(
    'acepta BIGINT %s sin Number',
    async (id) => {
      expect(
        await validate(
          plainToInstance(ProductoCatalogoParams, { empresaId: '20', id }),
        ),
      ).toHaveLength(0);
    },
  );
  it.each(['0', '-1', '1.5', '1e3', '9223372036854775808', 5])(
    'rechaza ID inválido %s',
    async (id) => {
      expect(
        (
          await validate(
            plainToInstance(ProductoCatalogoParams, { empresaId: 20, id }),
          )
        ).some((e) => e.property === 'id'),
      ).toBe(true);
    },
  );
  it('limita el filtro pricelist a SMALLINT', async () => {
    expect(
      (
        await validate(
          plainToInstance(ConsultaCatalogoDto, { pricelist: '32768' }),
        )
      ).some((e) => e.property === 'pricelist'),
    ).toBe(true);
  });
});
