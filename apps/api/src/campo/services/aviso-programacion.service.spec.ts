import { ForbiddenException } from '@nestjs/common';
import { AvisoService } from './aviso.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjuntoCampoService } from './adjunto-campo.service';

jest.mock('../utils/multer-config', () => ({
  validarArchivoImagen: jest.fn(),
}));

describe('AvisoService: destinatarios', () => {
  const usuario = { findMany: jest.fn(), findUnique: jest.fn() };
  const prisma = { usuario, avisoCampo: { create: jest.fn() } };
  const adjuntos = { descartarArchivos: jest.fn() };
  const servicio = new AvisoService(
    prisma as unknown as PrismaService,
    adjuntos as unknown as AdjuntoCampoService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rechaza destinatarios fuera del equipo activo', async () => {
    usuario.findMany.mockResolvedValue([{ id: 2 }]);
    await expect(
      servicio.crear(1, 9, {
        tipo: 'SELECCION',
        destinatariosIds: '2,3',
        mensaje: 'Aviso válido',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.avisoCampo.create).not.toHaveBeenCalled();
  });

  it('filtra los recibidos por membresía fijada y solo usa jerarquía para avisos antiguos', async () => {
    usuario.findUnique.mockResolvedValue({ superiorId: 1 });
    const filtro = await servicio['filtroRecibidos'](2, 9);
    expect(filtro).toEqual({
      empresaId: 9,
      emisorId: { not: 2 },
      OR: [
        { destinatarios: { some: { usuarioId: 2 } } },
        {
          destinatarios: { none: {} },
          OR: [{ destinatarioId: 2 }, { tipo: 'EQUIPO', emisorId: 1 }],
        },
      ],
    });
  });
});
