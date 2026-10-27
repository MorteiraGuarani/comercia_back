import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { AdjuntoCampoService } from './adjunto-campo.service';

jest.mock('../utils/multer-config', () => ({ validarArchivoImagen: jest.fn() }));

describe('adjuntos de novedades para superiores', () => {
  it('permite las imágenes al autor y sus superiores, sin exponerlas a otras cadenas o empresas', async () => {
    const personas = [
      { id: 1, empresaId: 10, superiorId: null, isActive: true },
      { id: 2, empresaId: 10, superiorId: 1, isActive: true },
      { id: 3, empresaId: 10, superiorId: 2, isActive: true },
    ];
    const prisma = {
      adjuntoCampo: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 8,
            novedad: { usuarioId: 3 },
            aviso: null,
            rutaArchivo: 'prueba.jpg',
          }),
      },
      usuario: {
        findMany: jest.fn(
          ({ where }: { where: { empresaId: number; id: { in: number[] } } }) =>
            Promise.resolve(
              personas.filter(
                (u) =>
                  u.empresaId === where.empresaId && where.id.in.includes(u.id),
              ),
            ),
        ),
      },
    };
    const service = new AdjuntoCampoService(prisma as unknown as PrismaService);
    expect(await service.obtenerArchivo(1, 10, 8)).toMatchObject({ id: 8 });
    expect(await service.obtenerArchivo(3, 10, 8)).toMatchObject({ id: 8 });
    await expect(service.obtenerArchivo(99, 10, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.obtenerArchivo(1, 20, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
