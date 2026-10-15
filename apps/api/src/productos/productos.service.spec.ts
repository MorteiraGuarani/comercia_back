import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    update: jest.fn(),
    delete: jest.fn(),
  });
  let db: {
    usuario: { findFirst: jest.Mock };
    empresa: { findUnique: jest.Mock };
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
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 20 }) },
      producto: modelo(),
    };
    db.producto.findMany.mockResolvedValue([fila]);
    db.producto.create.mockResolvedValue(fila);
    db.producto.update.mockResolvedValue(fila);
    service = new ProductosService(db as unknown as PrismaService);
  });

  it('rechaza lecturas y mutaciones sin superadmin activo', async () => {
    db.usuario.findFirst.mockResolvedValue(null);
    for (const accion of [
      () => service.empresas(1, {}),
      () => service.productos(1, 20, {}),
      () => service.crearProducto(1, 20, producto),
      () => service.editarProducto(1, 20, '5', producto),
      () => service.eliminarProducto(1, 20, '5'),
    ])
      await expect(accion()).rejects.toThrow(ForbiddenException);
    expect(db.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 1, esSuperadmin: true, isActive: true },
      select: { id: true },
    });
    for (const operacion of Object.values(db.producto))
      expect(operacion).not.toHaveBeenCalled();
  });

  it('no opera sobre empresas inexistentes', async () => {
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(service.crearProducto(1, 20, producto)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.producto.create).not.toHaveBeenCalled();
  });

  it('conserva IDs BIGINT y decimales exactos y pagina dentro de la empresa', async () => {
    const resultado = await service.productos(1, 20, {
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
    const opciones = await service.productos(1, 20, {}, true);
    expect(opciones.items[0]).toEqual({
      id: '9007199254740993',
      nombre: '0001 · Artículo · Lista 1',
    });
  });

  it('asigna la empresa autorizada y modifica o elimina solo la fila indicada', async () => {
    const creado = await service.crearProducto(1, 20, producto);
    expect(creado.price).toBe(producto.price);
    expect(db.producto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...producto, empresaId: 20 } }),
    );
    await service.editarProducto(1, 20, '9007199254740993', producto);
    expect(db.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9007199254740993n, empresaId: 20 },
        data: producto,
      }),
    );
    await service.eliminarProducto(1, 20, '9007199254740993');
    expect(db.producto.delete).toHaveBeenCalledWith({
      where: { id: 9007199254740993n, empresaId: 20 },
      select: { id: true },
    });
  });

  it('devuelve nulos y traduce duplicados o IDs de otras empresas', async () => {
    db.producto.create.mockResolvedValue({ ...producto, id: 5n, price: null });
    expect(
      (await service.crearProducto(1, 20, { ...producto, price: null })).price,
    ).toBeNull();
    db.producto.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.crearProducto(1, 20, producto)).rejects.toThrow(
      ConflictException,
    );
    db.producto.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.editarProducto(1, 20, '5', producto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each(['0', '-1', '0.000001', '999999999999999.123456', null, undefined])(
    'acepta price %s',
    async (price) => {
      expect(
        await validate(
          plainToInstance(CrearProductoDto, { ...producto, price }),
        ),
      ).toHaveLength(0);
    },
  );
  it.each(['1.1234567', '1000000000000000', '1e3', 1.23])(
    'rechaza price %s sin redondearlo',
    async (price) => {
      const errores = await validate(
        plainToInstance(CrearProductoDto, { ...producto, price }),
      );
      expect(errores.some((e) => e.property === 'price')).toBe(true);
    },
  );
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
    await service.crearProducto(1, 20, minimo);
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
