import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from './productos.service';
import { PrecioCatalogoDto } from './dto/catalogo.dto';

describe('Catalogo por empresa', () => {
  const precio = {
    cardCode: '0001',
    nroListaPrecio: 1,
    listaPrecio: 'General',
    precio: '999999999999999.123456',
  };
  const producto = {
    cardCode: '0001',
    descripcion: 'Articulo',
    iva: 10,
    grupo: 1,
    nombreGrupo: '',
    inventario: true,
    tipo: '',
  };
  let service: ProductosService;
  let db: {
    usuario: { findFirst: jest.Mock };
    empresa: { findUnique: jest.Mock };
    producto: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    precio: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };
  beforeEach(() => {
    const fila = {
      ...precio,
      id: 5,
      precio: new Decimal(precio.precio),
      producto: { descripcion: 'Articulo' },
    };
    db = {
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 20 }) },
      producto: {
        findUnique: jest.fn().mockResolvedValue({ cardCode: '0001' }),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      precio: {
        create: jest.fn().mockResolvedValue(fila),
        update: jest.fn().mockResolvedValue(fila),
        delete: jest.fn(),
      },
    };
    service = new ProductosService(db as unknown as PrismaService);
  });

  it('rechaza todas las mutaciones si el usuario no es superadmin activo', async () => {
    db.usuario.findFirst.mockResolvedValue(null);
    const acciones = [
      () => service.crearProducto(1, 20, producto),
      () => service.editarProducto(1, 20, '0001', producto),
      () => service.eliminarProducto(1, 20, '0001'),
      () => service.guardarPrecio(1, 20, precio),
      () => service.guardarPrecio(1, 20, precio, 5),
      () => service.eliminarPrecio(1, 20, 5),
    ];
    for (const accion of acciones)
      await expect(accion()).rejects.toThrow(ForbiddenException);
    expect(db.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 1, esSuperadmin: true, isActive: true },
      select: { id: true },
    });
    expect(db.empresa.findUnique).not.toHaveBeenCalled();
    for (const model of [db.producto, db.precio]) {
      expect(model.create).not.toHaveBeenCalled();
      expect(model.update).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
    }
  });

  it('mantiene el codigo y empresa en la clave de producto y alcance del precio', async () => {
    await service.eliminarProducto(1, 20, '0001');
    expect(db.producto.delete).toHaveBeenCalledWith({
      where: { empresaId_cardCode: { empresaId: 20, cardCode: '0001' } },
      select: { cardCode: true },
    });
    const resultado = await service.guardarPrecio(1, 20, precio, 5);
    expect(db.producto.findUnique).toHaveBeenCalledWith({
      where: { empresaId_cardCode: { empresaId: 20, cardCode: '0001' } },
      select: { cardCode: true },
    });
    expect(db.precio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, empresaId: 20 },
        data: precio,
      }),
    );
    expect(resultado?.precio).toBe(precio.precio);
    await service.eliminarPrecio(1, 20, 5);
    expect(db.precio.delete).toHaveBeenCalledWith({
      where: { id: 5, empresaId: 20 },
      select: { id: true },
    });
  });

  it('no permite asignar precios a productos de otra empresa', async () => {
    db.producto.findUnique.mockResolvedValue(null);
    await expect(service.guardarPrecio(1, 20, precio)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.precio.create).not.toHaveBeenCalled();
  });

  it.each(['0', '0.000001', '999999999999999.123456'])(
    'conserva el decimal valido %s como texto',
    async (valor) => {
      expect(
        await validate(
          plainToInstance(PrecioCatalogoDto, { ...precio, precio: valor }),
        ),
      ).toHaveLength(0);
    },
  );
  it.each(['1.1234567', '1000000000000000', '-1', '1e3', 1.23])(
    'rechaza precio invalido %s sin redondearlo',
    async (valor) => {
      const errores = await validate(
        plainToInstance(PrecioCatalogoDto, { ...precio, precio: valor }),
      );
      expect(errores.some((error) => error.property === 'precio')).toBe(true);
    },
  );
});
