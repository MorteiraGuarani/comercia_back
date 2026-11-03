import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { CategoriasService } from './categorias.service';
import { ActualizarCategoriaDto, CrearCategoriaDto } from './dto/categoria.dto';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('campo_categoria', () => {
  it('valida Modo de un carácter y deja codesap vacío con null', async () => {
    const ok = plainToInstance(CrearCategoriaDto, {
      nombre_categoria: ' Resto ',
      codesap: null,
      Modo: 'T',
      orden: '5',
    });
    expect(await validate(ok)).toEqual([]);
    expect(ok).toMatchObject({
      nombre_categoria: 'Resto',
      codesap: null,
      orden: 5,
    });
    const mal = plainToInstance(ActualizarCategoriaDto, { Modo: 'TM' });
    expect((await validate(mal)).map((e) => e.property)).toEqual(['Modo']);
  });

  it('no modifica ni borra categorías de otra empresa', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ empresaId: 2 }) },
      categoriaCampo: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const servicio = new CategoriasService(prisma as unknown as PrismaService);
    await expect(servicio.actualizar(7, 9, { orden: 1 })).rejects.toThrow(
      'Categoría no disponible',
    );
    await expect(servicio.eliminar(7, 9)).rejects.toThrow(
      'Categoría no disponible',
    );
    expect(prisma.categoriaCampo.deleteMany).toHaveBeenCalledWith({
      where: { id: 9, empresaId: 2 },
    });
  });
});
