/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest objectContaining returns any. */
import { BadRequestException } from '@nestjs/common';
import { RepositorCampoService } from './repositor-campo.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import type { ConfigService } from '@nestjs/config';

describe('RepositorCampoService', () => {
  it('exige terminar las tareas aplicables antes de registrar salida en Ucheck', async () => {
    const prisma = {
      visitaCampo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9,
          localId: 8,
          asignacionId: 7,
          horarioId: null,
          fecha: new Date('2026-09-25'),
          ucheckJornadaId: 6,
        }),
      },
      tareaCampo: { count: jest.fn().mockResolvedValue(2) },
      usuario: { findUnique: jest.fn() },
    };
    const acceso = {
      ejecutar: jest
        .fn()
        .mockResolvedValue({ empresaId: 1, rolDescripcion: 'REPOSITOR' }),
    };
    const config = { get: jest.fn() };
    const servicio = new RepositorCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
      config as unknown as ConfigService,
    );
    await expect(servicio.salida(3, 9, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tareaCampo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 1, activo: true }),
      }),
    );
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });
});
