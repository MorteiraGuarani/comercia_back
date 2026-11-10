import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { PedidosAccesoGuard } from './pedidos-acceso.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function probar(usuario: unknown) {
  const prisma = {
    usuario: { findUnique: jest.fn().mockResolvedValue(usuario) },
  };
  const contexto = {
    switchToHttp: () => ({ getRequest: () => ({ usuarioId: 7 }) }),
  } as unknown as ExecutionContext;
  return new PedidosAccesoGuard(prisma as unknown as PrismaService).canActivate(
    contexto,
  );
}

const base = { isActive: true, esSuperadmin: false, rol: { esAdminTi: false } };

describe('PedidosAccesoGuard', () => {
  it('deja pasar a Admin TI y a los usuarios de prueba', async () => {
    await expect(
      probar({ ...base, nombreLogin: 'x', rol: { esAdminTi: true } }),
    ).resolves.toBe(true);
    await expect(probar({ ...base, nombreLogin: 'falmiron' })).resolves.toBe(
      true,
    );
    await expect(
      probar({ ...base, nombreLogin: 'Giselle.Romero' }),
    ).resolves.toBe(true);
  });

  it('rechaza al resto y a los inactivos', async () => {
    await expect(
      probar({ ...base, nombreLogin: 'tania.garcia' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      probar({ ...base, isActive: false, nombreLogin: 'falmiron' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
