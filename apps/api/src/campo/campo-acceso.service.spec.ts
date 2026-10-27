import { NotFoundException } from '@nestjs/common';
import { CampoAccesoService } from './campo-acceso.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
describe('Alcance de campo', () => {
  const equipoCampo = {
    id: 1,
    nombre: 'Impulsadores',
    tipo: 'IMPULSADOR',
    activo: true,
  };
  const usuariosDelEquipo = new Set([25, 30]);
  function preparar() {
    const prisma = {
      usuario: {
        findFirst: jest.fn(
          ({
            where,
          }: {
            where: {
              id?: number;
              AND?: [{ id: { not: number } }, { id: number }];
            };
          }) =>
            Promise.resolve(
              where.id === 20
                ? { rol: { descripcion: 'Supervisor', equipoCampo } }
                : usuariosDelEquipo.has(where.AND?.[1].id ?? -1)
                  ? { id: where.AND?.[1].id }
                  : null,
            ),
        ),
      },
    };
    const plataforma = {
      exigirAccesoAlgunaPagina: jest
        .fn()
        .mockResolvedValue({ id: 30, equipoCampo }),
    };
    const service = new CampoAccesoService(
      prisma as unknown as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    return { prisma, plataforma, service };
  }
  it('rechaza usuarios fuera del equipo operativo del líder', async () => {
    const { prisma, plataforma, service } = preparar();
    await expect(service.subordinado(10, 20, 40)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.usuario.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              empresaId: 10,
              id: { not: 20 },
              isActive: true,
              esSuperadmin: false,
              rol: { equipoCampoId: 1 },
            },
            { id: 40 },
          ],
        },
      }),
    );
    expect(plataforma.exigirAccesoAlgunaPagina).not.toHaveBeenCalled();
  });
  it('permite al supervisor asignar a los impulsadores de sus TeamLeaders', async () => {
    const { plataforma, service } = preparar();
    await expect(service.subordinado(10, 20, 30)).resolves.toEqual({ id: 30 });
    await expect(service.subordinado(10, 20, 25)).resolves.toEqual({ id: 25 });
    expect(plataforma.exigirAccesoAlgunaPagina).toHaveBeenCalledWith(
      30,
      'mi-jornada',
      ['locales', 'tareas'],
    );
  });
  it('usa permisos de módulos en lugar de nombres de roles', async () => {
    const plataforma = {
      exigirAccesoPagina: jest.fn().mockResolvedValue({
        id: 1,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
      exigirAccesoAlgunaPagina: jest.fn().mockResolvedValue({
        id: 1,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };
    const service = new CampoAccesoService(
      {} as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    await service.gestionar(1, 'tareas');
    await service.ejecutar(1);
    expect(plataforma.exigirAccesoPagina).toHaveBeenCalledWith(
      1,
      'gestion-campo',
      'tareas',
    );
    expect(plataforma.exigirAccesoAlgunaPagina).toHaveBeenCalledWith(
      1,
      'mi-jornada',
      ['locales', 'tareas'],
    );
  });
});
