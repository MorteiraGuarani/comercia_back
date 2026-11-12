import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import { PedidosAccesoGuard } from './pedidos-acceso.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../plataforma/acceso-plataforma.service', () => ({
  AccesoPlataformaService: class {},
}));

function probar(usuario: unknown, paginaHabilitada = false) {
  const prisma = {
    usuario: { findUnique: jest.fn().mockResolvedValue(usuario) },
    modulo: {
      findMany: jest.fn().mockResolvedValue([{ ruta: 'mi-jornada' }]),
    },
  };
  const exigirAccesoPagina = jest.fn(() =>
    paginaHabilitada
      ? Promise.resolve({ id: 7, empresaId: 2 })
      : Promise.reject(
          new ForbiddenException('No tenés acceso a esta sección'),
        ),
  );
  const contexto = {
    switchToHttp: () => ({ getRequest: () => ({ usuarioId: 7 }) }),
  } as unknown as ExecutionContext;
  const resultado = new PedidosAccesoGuard(
    prisma as unknown as PrismaService,
    { exigirAccesoPagina } as unknown as AccesoPlataformaService,
  ).canActivate(contexto);
  return { resultado, exigirAccesoPagina };
}

const base = { isActive: true, esSuperadmin: false, rol: { esAdminTi: false } };

describe('PedidosAccesoGuard', () => {
  it('deja pasar a Admin TI y a los usuarios de prueba', async () => {
    await expect(
      probar({ ...base, nombreLogin: 'x', rol: { esAdminTi: true } }).resultado,
    ).resolves.toBe(true);
    await expect(
      probar({ ...base, nombreLogin: 'falmiron' }).resultado,
    ).resolves.toBe(true);
    await expect(
      probar({ ...base, nombreLogin: 'Giselle.Romero' }).resultado,
    ).resolves.toBe(true);
  });

  it('deja pasar a quien tiene la página Pedidos en Acceso por empresa', async () => {
    const { resultado, exigirAccesoPagina } = probar(
      { ...base, nombreLogin: 'tania.garcia' },
      true,
    );
    await expect(resultado).resolves.toBe(true);
    expect(exigirAccesoPagina).toHaveBeenCalledWith(7, 'mi-jornada', 'pedidos');
  });

  it('rechaza al resto y a los inactivos', async () => {
    await expect(
      probar({ ...base, nombreLogin: 'tania.garcia' }).resultado,
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      probar({ ...base, isActive: false, nombreLogin: 'falmiron' }, true)
        .resultado,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
