import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { VinculosUcheckService } from './vinculos-ucheck.service';

function preparar() {
  const prisma = {
    usuario: { findUnique: jest.fn(), update: jest.fn() },
    identidadUcheck: { deleteMany: jest.fn() },
    seguimientoCampo: { deleteMany: jest.fn() },
    visitaCampo: { count: jest.fn().mockResolvedValue(0) },
    operacionCampo: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.usuario.findUnique
    .mockResolvedValueOnce({ esSuperadmin: true, isActive: true })
    .mockResolvedValueOnce({ id: 8, correo: 'repositor@example.com' });
  prisma.$transaction.mockImplementation((fn: (p: unknown) => unknown) =>
    fn(prisma),
  );
  return {
    prisma,
    servicio: new VinculosUcheckService(
      prisma as unknown as PrismaService,
      new ConfigService(),
    ),
  };
}

describe('Administracion de vinculos Ucheck', () => {
  it('un supervisor sin superadmin no consulta ni cambia identidades', async () => {
    const { prisma, servicio } = preparar();
    prisma.usuario.findUnique
      .mockReset()
      .mockResolvedValue({ esSuperadmin: false, isActive: true });
    await expect(servicio.consultar(7, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(servicio.desvincular(7, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('no desvincula una cuenta con visita abierta', async () => {
    const { prisma, servicio } = preparar();
    prisma.visitaCampo.count.mockResolvedValue(1);
    await expect(servicio.desvincular(1, 8)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.identidadUcheck.deleteMany).not.toHaveBeenCalled();
  });
  it('no desvincula mientras existe una marcacion pendiente', async () => {
    const { prisma, servicio } = preparar();
    prisma.operacionCampo.count.mockResolvedValue(1);
    await expect(servicio.desvincular(1, 8)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.identidadUcheck.deleteMany).not.toHaveBeenCalled();
  });
  it('al desvincular impide el emparejamiento automatico y retira el punto', async () => {
    const { prisma, servicio } = preparar();
    await servicio.desvincular(1, 8);
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { permitirVinculoAutomatico: false },
      select: { id: true },
    });
    expect(prisma.seguimientoCampo.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: 8 },
    });
  });
});
