import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { TareaCampoDto } from './dto/campo.dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';

function contexto(
  rolDescripcion: string | null,
  permisos?: ('CONSULTAR' | 'CREAR' | 'EDITAR' | 'ARCHIVAR')[],
) {
  const prisma = {
    tareaCampo: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 10, nombre: 'Control de precios' }]),
      findFirst: jest.fn(),
    },
    localCampo: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 3,
      empresaId: 2,
      rolDescripcion,
      permisosTareas:
        permisos ??
        (rolDescripcion?.startsWith('SUPERVISOR')
          ? ['CONSULTAR', 'CREAR', 'EDITAR', 'ARCHIVAR']
          : rolDescripcion
                ?.replace(/[^a-z]/gi, '')
                .toLowerCase()
                .startsWith('teamleader')
            ? ['CONSULTAR']
            : []),
      equipoCampo: {
        id: 5,
        nombre: 'Equipo',
        tipo: 'IMPULSADOR',
        activo: true,
      },
    }),
  };
  return {
    prisma,
    service: new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    ),
  };
}

describe('Permisos del catálogo de tareas', () => {
  it('un nombre nuevo conserva los permisos explícitos y un nombre Supervisor no los concede por sí mismo', async () => {
    const autorizado = contexto('Responsable Norte', [
      'CONSULTAR',
      'CREAR',
      'EDITAR',
      'ARCHIVAR',
    ]);
    expect(
      (await autorizado.service.tareas(3, {})).permisos.puedeAdministrar,
    ).toBe(true);
    const denegado = contexto('SUPERVISOR', []);
    await expect(denegado.service.tareas(3, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it.each([
    'TeamLeader',
    ' Team Leader ',
    'TEAMLEADER_IMPULSADOR',
    'Impulsador',
    'REPOSITOR',
    'Superadministrador',
    'Rol nuevo',
    null,
  ])(
    'rechaza altas, cambios y bajas del rol %s aunque tenga acceso a la página',
    async (rol) => {
      const { service, prisma } = contexto(rol);
      const dto = Object.assign(new TareaCampoDto(), {
        nombre: 'Cambio',
        todosLocales: true,
        localIds: [],
      });
      await expect(service.guardarTarea(3, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.guardarTarea(3, dto, 10)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.eliminarTarea(3, 10)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.localCampo.count).not.toHaveBeenCalled();
      expect(prisma.tareaCampo.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('el TeamLeader puede consultar y recibe el catálogo en modo solo lectura', async () => {
    const { service } = contexto('TeamLeader');
    const resultado = await service.tareas(3, { page: 1, limit: 7 });
    expect(resultado.items).toEqual([{ id: 10, nombre: 'Control de precios' }]);
    expect(resultado.permisos).toMatchObject({
      puedeAdministrar: false,
      consultar: true,
      crear: false,
      editar: false,
      archivar: false,
    });
  });

  it.each(['SUPERVISOR', 'SUPERVISOR_REPOSITORES'])(
    'mantiene el ABM para %s',
    async (rol) => {
      const { service } = contexto(rol);
      expect((await service.tareas(3, { page: 1, limit: 7 })).permisos).toEqual(
        expect.objectContaining({ puedeAdministrar: true }),
      );
    },
  );
});
