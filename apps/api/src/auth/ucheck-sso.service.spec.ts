jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { UcheckSsoService } from './ucheck-sso.service';

describe('UcheckSsoService', () => {
  const identidad = {
    usuarioId: 22,
    correo: 'persona@empresa.com',
    nombre: 'Persona',
    destino: 'http://192.168.10.104:3000/panel',
  };

  afterEach(() => jest.restoreAllMocks());

  it('vincula por correo solo en el primer acceso validado', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(identidad),
    } as Response);
    const prisma = {
      identidadUcheck: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      usuario: {
        findMany: jest.fn().mockResolvedValue([{ id: 7 }]),
      },
    };
    const config = {
      get: jest.fn((clave: string) =>
        clave === 'integrations.ucheckApiUrl'
          ? 'http://192.168.10.104:3001/api/v1'
          : 's'.repeat(32),
      ),
      getOrThrow: jest.fn().mockReturnValue('http://192.168.10.104:3000'),
    };
    const auth = {
      iniciarSesionPorUsuarioId: jest.fn().mockResolvedValue({
        usuario: { id: 7 },
        token: 'jwt-comercia',
      }),
    };
    const servicio = new UcheckSsoService(
      prisma as never,
      config as never,
      auth as never,
    );

    const resultado = await servicio.iniciarSesion('a'.repeat(43));

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
    expect(prisma.identidadUcheck.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 7,
        ucheckUsuarioId: 22,
        correoVinculado: 'persona@empresa.com',
      },
    });
    expect(resultado.token).toBe('jwt-comercia');
  });

  it('usa la vinculación estable aunque el correo recibido cambie', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest
        .fn()
        .mockResolvedValue({ ...identidad, correo: 'nuevo@empresa.com' }),
    } as Response);
    const prisma = {
      identidadUcheck: {
        findUnique: jest.fn().mockResolvedValue({
          usuario: { id: 7, isActive: true },
        }),
      },
      usuario: { findMany: jest.fn() },
    };
    const config = {
      get: jest.fn((clave: string) =>
        clave === 'integrations.ucheckApiUrl'
          ? 'http://192.168.10.104:3001/api/v1'
          : 's'.repeat(32),
      ),
      getOrThrow: jest.fn().mockReturnValue('http://192.168.10.104:3000'),
    };
    const auth = {
      iniciarSesionPorUsuarioId: jest.fn().mockResolvedValue({
        usuario: { id: 7 },
        token: 'jwt-comercia',
      }),
    };
    const servicio = new UcheckSsoService(
      prisma as never,
      config as never,
      auth as never,
    );

    await servicio.iniciarSesion('a'.repeat(43));

    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    expect(auth.iniciarSesionPorUsuarioId).toHaveBeenCalledWith(7);
  });
});
