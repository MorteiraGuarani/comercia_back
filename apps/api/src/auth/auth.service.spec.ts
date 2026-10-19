import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError {},
  },
}));

describe('AuthService', () => {
  const prisma = { usuario: { findMany: jest.fn() } };
  const jwt = { sign: jest.fn() };
  const config = { get: jest.fn() };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(true);
  });

  it('con el login por SIM apagado no consulta usuarios ni firma sesión', async () => {
    config.get.mockReturnValue(false);
    await expect(
      service.loginMovilConSim({ telefonos: ['0981123456'] }),
    ).rejects.toThrow('No se pudo iniciar sesión automáticamente');
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('normaliza el número de SIM y crea sesión si hay un único usuario activo', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      {
        id: 8,
        nombre: 'Ana',
        apellido: 'Gómez',
        correo: 'ana@comercia.test',
        nombreLogin: 'ana',
        ruc: '80012345-0',
        celular: '+595981123456',
        esSuperadmin: false,
        isActive: true,
        empresa: { id: 1, nombre: 'Comercia' },
        rol: null,
      },
    ]);
    jwt.sign.mockReturnValue('token-movil');

    await expect(
      service.loginMovilConSim({ telefonos: ['0981123456'] }),
    ).resolves.toMatchObject({
      token: 'token-movil',
      usuario: { id: 8, correo: 'ana@comercia.test' },
    });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { celular: { in: ['+595981123456'] } },
        take: 2,
      }),
    );
  });

  it('no inicia sesión si las dos SIM coinciden con usuarios diferentes', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { isActive: true },
      { isActive: true },
    ]);

    await expect(
      service.loginMovilConSim({
        telefonos: ['+595981123456', '+595982123456'],
      }),
    ).rejects.toThrow('No se pudo iniciar sesión automáticamente');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
