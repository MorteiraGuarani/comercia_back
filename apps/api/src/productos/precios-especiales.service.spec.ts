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
import { PreciosEspecialesService } from './precios-especiales.service';
import {
  PrecioEspecialDetalleDto,
  PrecioEspecialDto,
  PrecioEspecialParams,
} from './dto/precio-especial.dto';

describe('Precios especiales por empresa', () => {
  const cabecera = { cardCode: 'C001', itemCode: 'A001', price: '15000.5' };
  const detalle = { cardCode: 'C001', itemCode: 'A001', lineNum: 0 };
  let service: PreciosEspecialesService;
  let db: {
    usuario: { findFirst: jest.Mock };
    empresa: { findUnique: jest.Mock };
    precioEspecial: Record<
      'count' | 'findMany' | 'create' | 'update' | 'delete',
      jest.Mock
    >;
    precioEspecialDetalle: Record<
      'count' | 'findMany' | 'create' | 'update' | 'delete',
      jest.Mock
    >;
  };
  const modelo = (fila: object) => ({
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([fila]),
    create: jest.fn().mockResolvedValue(fila),
    update: jest.fn().mockResolvedValue(fila),
    delete: jest.fn(),
  });

  beforeEach(() => {
    db = {
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 20 }) },
      precioEspecial: modelo({
        ...cabecera,
        id: 9007199254740993n,
        price: new Decimal('15000.5'),
      }),
      precioEspecialDetalle: modelo({
        ...detalle,
        id: 7n,
        price: null,
        discount: new Decimal('-5.5'),
      }),
    };
    const prisma = db as unknown as PrismaService;
    service = new PreciosEspecialesService(
      prisma,
      new ProductosService(prisma),
    );
  });

  it('rechaza todas las operaciones si el usuario no es superadmin activo', async () => {
    db.usuario.findFirst.mockResolvedValue(null);
    const acciones = [
      () => service.listar(1, 20, {}),
      () => service.crear(1, 20, cabecera),
      () => service.editar(1, 20, '1', cabecera),
      () => service.eliminar(1, 20, '1'),
      () => service.listarDetalle(1, 20, {}),
      () => service.crearDetalle(1, 20, detalle),
      () => service.editarDetalle(1, 20, '1', detalle),
      () => service.eliminarDetalle(1, 20, '1'),
    ];
    for (const accion of acciones)
      await expect(accion()).rejects.toThrow(ForbiddenException);
    for (const model of [db.precioEspecial, db.precioEspecialDetalle])
      for (const operacion of Object.values(model))
        expect(operacion).not.toHaveBeenCalled();
  });

  it('crea con la empresa de la ruta y devuelve id y decimales como texto', async () => {
    const creado = await service.crear(1, 20, cabecera);
    expect(db.precioEspecial.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...cabecera, empresaId: 20 } }),
    );
    expect(creado).toMatchObject({
      id: '9007199254740993',
      price: '15000.500000',
    });
    const linea = await service.crearDetalle(1, 20, detalle);
    expect(linea).toMatchObject({
      id: '7',
      price: null,
      discount: '-5.500000',
    });
  });

  it('edita y elimina solo dentro de la empresa, con id BIGINT', async () => {
    await service.editar(1, 20, '9007199254740993', { price: null });
    expect(db.precioEspecial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9007199254740993n, empresaId: 20 },
        data: { price: null },
      }),
    );
    await service.eliminarDetalle(1, 20, '7');
    expect(db.precioEspecialDetalle.delete).toHaveBeenCalledWith({
      where: { id: 7n, empresaId: 20 },
      select: { id: true },
    });
  });

  it('traduce duplicados y registros ajenos a 409 y 404', async () => {
    db.precioEspecial.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.crear(1, 20, cabecera)).rejects.toThrow(
      ConflictException,
    );
    db.precioEspecialDetalle.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.editarDetalle(1, 20, '7', detalle)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('filtra el listado por empresa, códigos exactos y texto', async () => {
    const pagina = await service.listar(1, 20, {
      cardCode: 'C001',
      itemCode: 'A001',
      buscar: 'carne',
    });
    const [consulta] = db.precioEspecial.findMany.mock.calls[0] as [
      { where: { empresaId: number; cardCode: string; OR: unknown[] } },
    ];
    const { where } = consulta;
    expect(where).toMatchObject({
      empresaId: 20,
      cardCode: 'C001',
      itemCode: 'A001',
    });
    expect(where.OR).toContainEqual({
      itemName: { contains: 'carne', mode: 'insensitive' },
    });
    expect(pagina).toMatchObject({ total: 1, page: 1, limit: 7 });
    expect(pagina.items[0].id).toBe('9007199254740993');
  });

  it('acepta cuerpos vacíos o con null porque todos los campos son opcionales', async () => {
    for (const [dto, cuerpo] of [
      [PrecioEspecialDto, {}],
      [PrecioEspecialDto, { cardCode: null, price: null, valid: 'N' }],
      [PrecioEspecialDetalleDto, {}],
      [
        PrecioEspecialDetalleDto,
        { discount: '-5.5', fromDate: '2026-10-01', toDate: null },
      ],
    ] as const)
      expect(await validate(plainToInstance(dto, cuerpo))).toHaveLength(0);
  });

  it.each([
    [PrecioEspecialDto, { valid: 'X' }, 'valid'],
    [PrecioEspecialDto, { price: '-1' }, 'price'],
    [PrecioEspecialDto, { price: '1.1234567' }, 'price'],
    [PrecioEspecialDto, { cardCode: 'x'.repeat(51) }, 'cardCode'],
    [PrecioEspecialDetalleDto, { lineNum: 40000 }, 'lineNum'],
    [PrecioEspecialDetalleDto, { cardCode: 'x'.repeat(16) }, 'cardCode'],
    [PrecioEspecialDetalleDto, { fromDate: 'no-es-fecha' }, 'fromDate'],
    [PrecioEspecialParams, { empresaId: 20, id: '0' }, 'id'],
    [PrecioEspecialParams, { empresaId: 20, id: '1e3' }, 'id'],
    [PrecioEspecialParams, { empresaId: 20, id: '1'.repeat(19) }, 'id'],
  ] as const)('rechaza %p con %j', async (dto, cuerpo, propiedad) => {
    const errores = await validate(plainToInstance(dto, cuerpo));
    expect(errores.map((error) => error.property)).toContain(propiedad);
  });
});
