import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from './productos.service';
import {
  PRODUCTOS_POR_BLOQUE,
  TIMEOUT_LOTE_PRODUCTOS_MS,
} from './productos.constants';
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
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });
  let db: {
    usuario: { findFirst: jest.Mock };
    empresa: { findUnique: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    producto: ReturnType<typeof modelo>;
    $transaction: jest.Mock;
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
      $transaction: jest.fn(
        (
          operacion: (tx: {
            producto: ReturnType<typeof modelo>;
          }) => Promise<unknown>,
        ) => operacion({ producto: db.producto }),
      ),
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

  it('crea un lote con el mismo artículo en listas distintas y devuelve el resumen', async () => {
    const lote = [13, 14, 16, 21, 22].map((pricelist) => ({
      ...producto,
      itemcode: 'AV00018',
      pricelist,
      price: 141650,
    }));
    db.producto.createMany.mockResolvedValue({ count: 5 });
    const resultado = await service.crearProductos(20, lote);
    expect(resultado).toEqual({
      recibidos: 5,
      insertados: 5,
      existentes: 0,
      duplicadosEnLote: 0,
      omitidos: 0,
    });
    expect(db.producto.createMany).toHaveBeenCalledWith({
      data: lote.map((p) => ({ ...p, empresaId: 20 })),
      skipDuplicates: true,
    });
    expect(db.producto.create).not.toHaveBeenCalled();
  });

  it('omite parejas repetidas dentro del lote y conserva los datos de la primera aparición', async () => {
    db.producto.createMany.mockResolvedValue({ count: 1 });
    expect(
      await service.crearProductos(20, [producto, { ...producto, price: 1 }]),
    ).toEqual({
      recibidos: 2,
      insertados: 1,
      existentes: 0,
      duplicadosEnLote: 1,
      omitidos: 1,
    });
    expect(db.producto.createMany).toHaveBeenCalledWith({
      data: [{ ...producto, empresaId: 20 }],
      skipDuplicates: true,
    });
  });

  it('continúa con las parejas nuevas y cuenta los existentes sin sobrescribirlos', async () => {
    db.producto.createMany.mockResolvedValue({ count: 1 });
    expect(
      await service.crearProductos(20, [
        producto,
        { ...producto, pricelist: 13 },
        producto,
      ]),
    ).toEqual({
      recibidos: 3,
      insertados: 1,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
    });
    expect(db.producto.update).not.toHaveBeenCalled();
    expect(db.producto.findMany).not.toHaveBeenCalled();
  });

  it('acepta un lote que ya existe completo y cuenta sus repeticiones por separado', async () => {
    db.producto.createMany.mockResolvedValue({ count: 0 });
    expect(await service.crearProductos(20, [producto, producto])).toEqual({
      recibidos: 2,
      insertados: 0,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
    });
  });

  it('no ejecuta el lote sobre una empresa inexistente', async () => {
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(service.crearProductos(20, [producto])).rejects.toThrow(
      NotFoundException,
    );
    expect(db.producto.createMany).not.toHaveBeenCalled();
  });

  it.each([5_000, 20_000])(
    'divide %i filas en bloques y continúa cuando las primeras 200 ya existen',
    async (cantidad) => {
      const lote = Array.from({ length: cantidad }, (_, index) => ({
        ...producto,
        itemcode: `LOTE-${index}`,
        price: 123.5,
      }));
      db.producto.createMany
        .mockResolvedValue({ count: PRODUCTOS_POR_BLOQUE })
        .mockResolvedValueOnce({ count: PRODUCTOS_POR_BLOQUE - 200 });
      const resultado = await service.crearProductos(20, lote);
      expect(resultado).toEqual({
        recibidos: cantidad,
        insertados: cantidad - 200,
        existentes: 200,
        duplicadosEnLote: 0,
        omitidos: 200,
      });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 5_000,
        timeout: TIMEOUT_LOTE_PRODUCTOS_MS,
      });
      expect(db.producto.createMany).toHaveBeenCalledTimes(
        cantidad / PRODUCTOS_POR_BLOQUE,
      );
      for (const [args] of db.producto.createMany.mock.calls as [
        { data: { empresaId: number }[]; skipDuplicates: boolean },
      ][]) {
        expect(args.data).toHaveLength(PRODUCTOS_POR_BLOQUE);
        expect(args.data.every((d) => d.empresaId === 20)).toBe(true);
        expect(args.skipDuplicates).toBe(true);
      }
    },
  );

  it('omite repeticiones entre bloques y sigue contabilizando los existentes en bloques posteriores', async () => {
    const lote = Array.from(
      { length: PRODUCTOS_POR_BLOQUE + 2 },
      (_, index) => ({ ...producto, itemcode: `LOTE-${index}` }),
    );
    lote.push({ ...lote[0], price: '1' });
    db.producto.createMany
      .mockResolvedValueOnce({ count: PRODUCTOS_POR_BLOQUE })
      .mockResolvedValueOnce({ count: 1 });
    expect(await service.crearProductos(20, lote)).toEqual({
      recibidos: 1003,
      insertados: 1001,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
    });
    expect(db.producto.createMany).toHaveBeenNthCalledWith(2, {
      data: lote.slice(1000, 1002).map((p) => ({ ...p, empresaId: 20 })),
      skipDuplicates: true,
    });
  });

  it('propaga errores reales de base de datos para revertir la transacción completa', async () => {
    const error = new Error('Base de datos no disponible');
    const lote = Array.from(
      { length: PRODUCTOS_POR_BLOQUE + 1 },
      (_, index) => ({ ...producto, itemcode: `LOTE-${index}` }),
    );
    db.producto.createMany
      .mockResolvedValueOnce({ count: PRODUCTOS_POR_BLOQUE })
      .mockRejectedValueOnce(error);
    await expect(service.crearProductos(20, lote)).rejects.toBe(error);
    expect(db.producto.createMany).toHaveBeenCalledTimes(2);
  });

  it('la misma pareja en otra empresa se inserta dentro del alcance solicitado', async () => {
    db.producto.createMany.mockResolvedValue({ count: 1 });
    expect((await service.crearProductos(30, [producto])).insertados).toBe(1);
    expect(db.producto.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ ...producto, empresaId: 30 }] }),
    );
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
