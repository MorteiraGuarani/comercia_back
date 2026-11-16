import { AsyncResource } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { defer, lastValueFrom } from 'rxjs';
import type { PrismaService } from '../../prisma/prisma.service';
import { cambiosAuditoria } from '../utils/auditoria';
import { AuditoriaInterceptor } from './auditoria.interceptor';
import { AuditoriaService } from './auditoria.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Auditoría', () => {
  const prisma = {
    usuario: { findUnique: jest.fn() },
    registroAuditoria: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    empresa: { findMany: jest.fn() },
  };
  const servicio = new AuditoriaService(prisma as unknown as PrismaService);
  // Corre `hacer` como un handler HTTP del usuario 7, a través del interceptor.
  // Como Nest, handle() ata el handler al contexto async en que se lo pide.
  const comoUsuario = <T>(hacer: () => Promise<T>) =>
    lastValueFrom(
      new AuditoriaInterceptor().intercept(
        {
          switchToHttp: () => ({ getRequest: () => ({ usuarioId: 7 }) }),
        } as unknown as ExecutionContext,
        { handle: () => defer(AsyncResource.bind(hacer)) } as CallHandler<T>,
      ) as ReturnType<CallHandler<T>['handle']>,
    );
  beforeEach(() => jest.resetAllMocks());

  it('guarda solo los campos que cambiaron y nunca credenciales', () => {
    expect(
      cambiosAuditoria(
        {
          nombre: 'Ana',
          rol: { id: 1, descripcion: 'Repositor' },
          passwordHash: 'h1',
          extra: 'solo en antes',
        },
        {
          nombre: 'Ana',
          rol: { id: 2, descripcion: 'Supervisor' },
          passwordHash: 'h2',
          sapContrasenia: 'x',
          conexion: { password_db: 'y', host: 'db' },
          updatedAt: new Date(),
        },
      ),
    ).toEqual({
      rol: {
        antes: { id: 1, descripcion: 'Repositor' },
        despues: { id: 2, descripcion: 'Supervisor' },
      },
      conexion: { antes: null, despues: { host: 'db' } },
    });
    const fecha = new Date('2026-11-16T00:00:00.000Z');
    expect(cambiosAuditoria(null, { entrada: '08:00', desde: fecha })).toEqual({
      entrada: { antes: null, despues: '08:00' },
      desde: { antes: null, despues: fecha.toISOString() },
    });
    expect(cambiosAuditoria({ id: 3, token: 't' }, null)).toEqual({
      id: { antes: 3, despues: null },
    });
  });

  it('registra quién (nombre y rol del pedido en curso), qué y el antes/después', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Tito',
      apellido: 'TI',
      esSuperadmin: false,
      rol: { descripcion: 'AdminTI' },
    });
    await comoUsuario(() =>
      servicio.registrar({
        accion: 'MODIFICAR',
        entidad: 'Horario',
        entidadId: 15,
        empresaId: 2,
        etiqueta: 'Ana Repo · local C1',
        antes: { entrada: '08:00', salida: '12:00' },
        despues: { entrada: '09:00', salida: '12:00' },
      }),
    );
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 7,
        usuarioNombre: 'Tito TI',
        usuarioRol: 'AdminTI',
        accion: 'MODIFICAR',
        entidad: 'Horario',
        entidadId: '15',
        etiqueta: 'Ana Repo · local C1',
        empresaId: 2,
        cambios: { entrada: { antes: '08:00', despues: '09:00' } },
      },
      select: { id: true },
    });
  });

  it('no corta la operación si falla el log y no registra un guardado sin cambios', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.registroAuditoria.create.mockRejectedValue(new Error('caída'));
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => {});
    await expect(
      comoUsuario(() =>
        servicio.registrar({
          accion: 'ELIMINAR',
          entidad: 'Rol',
          entidadId: 4,
          antes: { descripcion: 'Viejo' },
        }),
      ),
    ).resolves.toBeUndefined();
    prisma.registroAuditoria.create.mockClear();
    await servicio.registrar({
      accion: 'MODIFICAR',
      entidad: 'Rol',
      entidadId: 4,
      antes: { descripcion: 'Igual' },
      despues: { descripcion: 'Igual' },
    });
    expect(prisma.registroAuditoria.create).not.toHaveBeenCalled();
  });

  it('solo superadmin y Admin TI activos ven el log', async () => {
    const consulta = { page: 1, limit: 7 };
    for (const yo of [
      null,
      { isActive: true, esSuperadmin: false, rol: { esAdminTi: false } },
      { isActive: true, esSuperadmin: false, rol: null },
      { isActive: false, esSuperadmin: true, rol: null },
      { isActive: false, esSuperadmin: false, rol: { esAdminTi: true } },
    ]) {
      prisma.usuario.findUnique.mockResolvedValueOnce(yo);
      await expect(servicio.listar(1, consulta)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    expect(prisma.registroAuditoria.findMany).not.toHaveBeenCalled();

    prisma.registroAuditoria.count.mockResolvedValue(0);
    prisma.registroAuditoria.findMany.mockResolvedValue([]);
    for (const yo of [
      { isActive: true, esSuperadmin: true, rol: null },
      { isActive: true, esSuperadmin: false, rol: { esAdminTi: true } },
    ]) {
      prisma.usuario.findUnique.mockResolvedValueOnce(yo);
      await expect(servicio.listar(1, consulta)).resolves.toMatchObject({
        items: [],
        total: 0,
      });
    }
  });

  it('pagina y filtra por fecha, usuario, entidad y acción', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      esSuperadmin: false,
      rol: { esAdminTi: true },
    });
    prisma.registroAuditoria.count.mockResolvedValue(9);
    prisma.registroAuditoria.findMany.mockResolvedValue([
      {
        id: 3,
        creadoEn: new Date('2026-11-16T12:00:00.000Z'),
        usuarioId: 7,
        usuarioNombre: 'Tito TI',
        usuarioRol: 'AdminTI',
        accion: 'QUITAR',
        entidad: 'Asignación',
        entidadId: '30',
        etiqueta: 'Ana Repo',
        empresaId: 2,
        cambios: { activo: { antes: true, despues: false } },
      },
    ]);
    prisma.empresa.findMany.mockResolvedValue([{ id: 2, nombre: 'Acme' }]);
    const res = await servicio.listar(1, {
      page: 2,
      limit: 7,
      desde: '2026-11-16T03:00:00.000Z',
      hasta: '2026-11-17T03:00:00.000Z',
      usuario: ' tito ',
      entidad: 'Asignación',
      accion: 'QUITAR',
    });
    expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith({
      where: {
        creadoEn: {
          gte: new Date('2026-11-16T03:00:00.000Z'),
          lt: new Date('2026-11-17T03:00:00.000Z'),
        },
        usuarioNombre: { contains: 'tito', mode: 'insensitive' },
        entidad: 'Asignación',
        accion: 'QUITAR',
      },
      orderBy: { id: 'desc' },
      skip: 7,
      take: 7,
    });
    expect(res).toMatchObject({
      total: 9,
      page: 2,
      totalPages: 2,
      items: [
        {
          id: 3,
          creadoEn: '2026-11-16T12:00:00.000Z',
          empresaNombre: 'Acme',
          cambios: { activo: { antes: true, despues: false } },
        },
      ],
    });
  });
});
