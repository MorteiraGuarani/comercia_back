import { NotFoundException } from '@nestjs/common';
import { CampoAccesoService } from './campo-acceso.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
describe('Alcance de campo', () => {
  it('rechaza usuarios fuera del equipo y consulta empresa y superior', async () => {
    const prisma = {
      usuario: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            rol: {
              descripcion: 'TeamLeader',
              equipoCampo: {
                id: 1,
                nombre: 'Impulsadores',
                tipo: 'IMPULSADOR',
                activo: true,
              },
            },
          })
          .mockResolvedValueOnce(null),
      },
    };
    const plataforma = { exigirAccesoAlgunaPagina: jest.fn() };
    const service = new CampoAccesoService(
      prisma as unknown as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    await expect(service.subordinado(10, 20, 30)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: {
        id: 30,
        empresaId: 10,
        superiorId: 20,
        isActive: true,
        esSuperadmin: false,
        rol: { equipoCampoId: 1 },
      },
      select: { id: true },
    });
    expect(plataforma.exigirAccesoAlgunaPagina).not.toHaveBeenCalled();
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
