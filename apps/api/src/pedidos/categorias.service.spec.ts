import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { CategoriasService } from './categorias.service';
import { ActualizarCategoriaDto, CrearCategoriaDto } from './dto/categoria.dto';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('campo_categoria', () => {
  it('acepta Modo I o G (en mayúscula) y deja ItemGroupCode vacío con null', async () => {
    const ok = plainToInstance(CrearCategoriaDto, {
      nombre_categoria: ' Otros ',
      ItemGroupCode: null,
      Modo: ' g ',
      orden: '5',
    });
    expect(await validate(ok)).toEqual([]);
    expect(ok).toMatchObject({
      nombre_categoria: 'Otros',
      ItemGroupCode: null,
      Modo: 'G',
      orden: 5,
    });
    const mal = plainToInstance(ActualizarCategoriaDto, { Modo: 'T' });
    expect((await validate(mal)).map((e) => e.property)).toEqual(['Modo']);
  });

  it('no guarda un grupo que no está en OITB de la empresa', async () => {
    const prisma = {
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 2 }) },
      grupoArticulo: { findFirst: jest.fn().mockResolvedValue(null) },
      categoriaCampo: { create: jest.fn(), updateMany: jest.fn() },
    };
    const servicio = new CategoriasService(prisma as unknown as PrismaService);
    await expect(
      servicio.crear(2, { nombre_categoria: 'Papas', ItemGroupCode: 999 }),
    ).rejects.toThrow('El grupo 999 no existe');
    await expect(
      servicio.actualizar(2, 1, { ItemGroupCode: 999 }),
    ).rejects.toThrow('El grupo 999 no existe');
    expect(prisma.grupoArticulo.findFirst).toHaveBeenCalledWith({
      where: { empresaId: 2, Number: 999 },
      select: { id: true },
    });
    expect(prisma.categoriaCampo.create).not.toHaveBeenCalled();
    expect(prisma.categoriaCampo.updateMany).not.toHaveBeenCalled();
  });

  it('no modifica ni borra categorías de otra empresa', async () => {
    const prisma = {
      categoriaCampo: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const servicio = new CategoriasService(prisma as unknown as PrismaService);
    await expect(servicio.actualizar(2, 9, { orden: 1 })).rejects.toThrow(
      'Categoría no disponible',
    );
    await expect(servicio.eliminar(2, 9)).rejects.toThrow(
      'Categoría no disponible',
    );
    expect(prisma.categoriaCampo.deleteMany).toHaveBeenCalledWith({
      where: { id: 9, empresaId: 2 },
    });
  });

  it('no crea categorías en una empresa que no existe', async () => {
    const prisma = {
      empresa: { findUnique: jest.fn().mockResolvedValue(null) },
      categoriaCampo: { create: jest.fn() },
    };
    const servicio = new CategoriasService(prisma as unknown as PrismaService);
    await expect(
      servicio.crear(99, { nombre_categoria: 'Otros' }),
    ).rejects.toThrow('Empresa no disponible');
    expect(prisma.categoriaCampo.create).not.toHaveBeenCalled();
  });
});
