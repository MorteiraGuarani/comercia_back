import { JwtAuthGuard } from './jwt-auth.guard';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('JwtAuthGuard', () => {
  const jwt = {
    verify: jest.fn(),
    sign: jest.fn(),
  };
  const prisma = { usuario: { findUnique: jest.fn() } };
  const guard = new JwtAuthGuard(
    jwt as never,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renueva el token y la cookie en cada request autenticada', async () => {
    const request = { cookies: { comercia_token: 'token-vigente' } };
    const response = { cookie: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    jwt.verify.mockReturnValue({ sub: 42 });
    jwt.sign.mockReturnValue('token-renovado');
    prisma.usuario.findUnique.mockResolvedValue({ isActive: true, empresaId: 7 });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toMatchObject({ usuarioId: 42, empresaId: 7 });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 42 });
    expect(response.cookie).toHaveBeenCalledWith(
      'comercia_token',
      'token-renovado',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it('no renueva la sesión de un usuario desactivado', async () => {
    const request = { cookies: { comercia_token: 'token-vigente' } };
    const response = { cookie: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    jwt.verify.mockReturnValue({ sub: 42 });
    prisma.usuario.findUnique.mockResolvedValue({ isActive: false });

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      'Sesión inválida o expirada',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('acepta un Bearer token móvil sin emitir una cookie', async () => {
    const request = { headers: { authorization: 'Bearer token-movil' } };
    const response = { cookie: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    jwt.verify.mockReturnValue({ sub: 42 });
    prisma.usuario.findUnique.mockResolvedValue({ isActive: true, empresaId: 9 });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toMatchObject({ usuarioId: 42, empresaId: 9 });
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
