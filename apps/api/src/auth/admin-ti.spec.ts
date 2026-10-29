import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from './auth.service';
import type { CampoAccesoService } from '../campo/campo-acceso.service';
import type { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import { AdminTiGuard } from './admin-ti.guard';
import { UsuariosService } from '../usuarios/usuarios.service';
import { OrganigramaService } from '../campo/services/organigrama.service';
import { UbicacionesService } from '../ubicaciones/ubicaciones.service';
import { MiPlataformaService } from '../plataforma/mi-plataforma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('AdminTI: alcance y límites', () => {
  const actor = {
    id: 1,
    empresaId: 2,
    isActive: true,
    esSuperadmin: false,
    rol: { descripcion: 'AdminTI', esAdminTi: true },
  };
  const prisma = {
    usuario: { findUnique: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    empresa: { findMany: jest.fn(), findUnique: jest.fn() },
    modulo: { findUnique: jest.fn() },
  };
  const db = prisma as unknown as PrismaService;
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(actor);
  });

  it('autoriza por el permiso explícito, no por el nombre del rol', async () => {
    const guard = new AdminTiGuard(db);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ usuarioId: 1 }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    prisma.usuario.findUnique.mockResolvedValue({
      ...actor,
      rol: { descripcion: 'AdminTI', esAdminTi: false },
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.usuario.findUnique.mockResolvedValue({ ...actor, isActive: false });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('permite listar usuarios y empresas globalmente, sin otorgar superadmin', async () => {
    const service = new UsuariosService(db, {} as AuthService);
    prisma.empresa.findMany.mockResolvedValue([
      { id: 2, nombre: 'A' },
      { id: 9, nombre: 'B' },
    ]);
    prisma.usuario.count.mockResolvedValue(0);
    prisma.usuario.findMany.mockResolvedValue([]);
    await expect(service.meta(1)).resolves.toMatchObject({
      empresas: [{ id: 2 }, { id: 9 }],
      esSuperadmin: false,
    });
    await service.listar(1, { empresaId: 9 });
    const consulta = prisma.usuario.findMany.mock.calls[0] as unknown as [
      { where: { empresaId: number } },
    ];
    expect(consulta[0].where.empresaId).toBe(9);
    await expect(
      service.crear(1, { empresaId: 9, esSuperadmin: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite consultar organigrama y ubicaciones de otra empresa', async () => {
    const gestionar = jest.fn();
    const acceso = { gestionar } as unknown as CampoAccesoService;
    prisma.empresa.findUnique.mockResolvedValue(null);
    const organigrama = new OrganigramaService(db, acceso);
    await expect(
      organigrama.organigrama(1, { empresaId: 9 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.empresa.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 9 } }),
    );
    const ubicaciones = new UbicacionesService(
      db,
      acceso,
      {} as UcheckClienteService,
    );
    await expect(
      ubicaciones.enVivo(1, { empresaId: 9 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.empresa.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 9 } }),
    );
    expect(gestionar).not.toHaveBeenCalled();
  });

  it('oculta y bloquea los módulos de plataforma para AdminTI', async () => {
    await expect(new MiPlataformaService(db).menu(1)).resolves.toEqual([]);
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(
      new AccesoPlataformaService(db).exigirAccesoPagina(
        1,
        'gestion-campo',
        'tareas',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new AccesoPlataformaService(db).exigirAccesosPaginasEnModulos(
        1,
        ['gestion-campo'],
        ['tareas'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
