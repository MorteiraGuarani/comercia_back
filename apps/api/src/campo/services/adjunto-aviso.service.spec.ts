import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

jest.mock('../utils/multer-config', () => ({
  validarArchivoImagen: jest.fn(),
}));

import { AdjuntoCampoService } from './adjunto-campo.service';

describe('fotos de avisos con destinatarios fijados', () => {
  const adjunto = {
    id: 5,
    empresaId: 10,
    nombreOriginal: 'foto.jpg',
    rutaArchivo: '/uploads/foto.jpg',
    mimeType: 'image/jpeg',
    tamanioBytes: 100,
    creadoAt: new Date(),
    novedad: null,
    aviso: {
      emisorId: 1,
      tipo: 'EQUIPO',
      destinatarioId: null,
      destinatarios: [{ usuarioId: 2 }],
    },
  };
  const prisma = {
    adjuntoCampo: { findFirst: jest.fn().mockResolvedValue(adjunto) },
    usuario: { findFirst: jest.fn() },
  };
  const service = new AdjuntoCampoService(prisma as unknown as PrismaService);

  it('permite al destinatario de ese envío ver la foto', async () => {
    await expect(service.obtenerArchivo(2, 10, 5)).resolves.toMatchObject({
      id: 5,
    });
  });

  it('deniega a un subordinado incorporado después del envío', async () => {
    await expect(service.obtenerArchivo(3, 10, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });
});
