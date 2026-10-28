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

describe('Alta de usuario con referencias ERP', () => {
  const erp = {
    ERP_CanalVenta: 'MAYORISTA',
    ERP_Almacen: 'ALM01',
    ERP_Supervisor: 'SUP01',
    ERP_Vendedor: 0,
    ERP_Repositor: 'REP01',
    ERP_Impulsador: 'IMP01',
  };

  it.each([erp, undefined])(
    'persiste las referencias ERP opcionales sin agregarlas a la sesión',
    async (campos) => {
      const prisma = {
        empresa: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
        usuario: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...data,
              id: 7,
              fotoPerfil: null,
              empresa: { id: 1, nombre: 'Empresa' },
              rol: null,
            }),
          ),
        },
      };
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        {} as ConfigService,
      );
      const sesion = await service.crearUsuario(
        {
          nombre: 'Ana',
          apellido: 'Rojas',
          correo: 'ana@example.com',
          nombreLogin: 'ana',
          empresaId: 1,
          password: 'password123',
          ...campos,
        },
        { rolId: null },
        'hash-de-prueba',
      );
      const esperados = Object.fromEntries(
        Object.keys(erp).map((campo) => [
          campo,
          campos?.[campo as keyof typeof erp] ?? null,
        ]),
      );
      expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject(
        esperados,
      );
      expect(sesion).not.toHaveProperty('ERP_Vendedor');
      expect(sesion).not.toHaveProperty('passwordHash');
    },
  );
});
