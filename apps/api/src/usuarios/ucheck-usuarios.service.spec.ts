import type { PrismaService } from '../prisma/prisma.service';
import type { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import { UcheckUsuariosService } from './ucheck-usuarios.service';
import { programasUcheck } from './utils/programas-ucheck';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const equipo = (tipo: string, activo = true) => ({ tipo, activo });

describe('programasUcheck', () => {
  it('da el programa del equipo de campo y SEGUIMIENTO; nada sin equipo activo', () => {
    expect(
      programasUcheck({
        descripcion: 'Repositor',
        equipoCampo: equipo('REPOSITOR'),
      }),
    ).toEqual(['COMERCIA_REPOSITOR', 'SEGUIMIENTO']);
    expect(
      programasUcheck({
        descripcion: 'Team Leader',
        equipoCampo: equipo('IMPULSADOR'),
      }),
    ).toEqual(['COMERCIA_TEAMLEADER', 'SEGUIMIENTO']);
    expect(
      programasUcheck({
        descripcion: 'SUPERVISOR',
        equipoCampo: equipo('AMBOS'),
      }),
    ).toEqual(['COMERCIA_TEAMLEADER', 'SEGUIMIENTO']);
    expect(
      programasUcheck({
        descripcion: 'Impulsador',
        equipoCampo: equipo('IMPULSADOR'),
      }),
    ).toEqual(['COMERCIA', 'SEGUIMIENTO']);
    expect(
      programasUcheck({
        descripcion: 'Impulsador',
        equipoCampo: equipo('IMPULSADOR', false),
      }),
    ).toEqual([]);
    expect(
      programasUcheck({ descripcion: 'Gerente', equipoCampo: null }),
    ).toEqual([]);
    expect(programasUcheck(null)).toEqual([]);
  });
});

describe('UcheckUsuariosService', () => {
  const USUARIO = {
    correo: 'lucia.gimenez@example.com',
    nombre: 'Lucía',
    apellido: 'Giménez',
    celular: '+595981000111',
    legajo: null,
    isActive: true,
    esSuperadmin: false,
    permitirVinculoAutomatico: true,
    empresa: { nombre: 'Frigorifico Guarani' },
    rol: { descripcion: 'Impulsador', equipoCampo: equipo('IMPULSADOR') },
    identidadUcheck: null as { ucheckUsuarioId: number } | null,
  };

  function preparar(usuario: unknown = USUARIO, pendiente = {}) {
    const prisma = {
      ucheckUsuarioPendiente: {
        upsert: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              usuarioId: 7,
              version: 3,
              ucheckUsuarioId: null,
              intentos: 0,
              ...pendiente,
            },
          ])
          .mockResolvedValue([]),
        deleteMany: jest.fn(),
        updateMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      usuario: { findUnique: jest.fn().mockResolvedValue(usuario) },
      identidadUcheck: { upsert: jest.fn() },
    };
    const ucheck = {
      configurado: () => true,
      pedir: jest.fn<Promise<unknown>, [string, unknown]>().mockResolvedValue({
        ucheckUsuarioId: 42,
        correo: USUARIO.correo,
      }),
    };
    const servicio = new UcheckUsuariosService(
      prisma as unknown as PrismaService,
      ucheck as unknown as UcheckClienteService,
    );
    return { prisma, ucheck, servicio };
  }

  it('manda el estado completo a Ucheck, guarda el vínculo y borra el pendiente de esa versión', async () => {
    const { prisma, ucheck, servicio } = preparar();
    await servicio.sincronizar();
    expect(ucheck.pedir).toHaveBeenCalledWith(
      '/comercia-integracion/usuarios',
      {
        method: 'PUT',
        body: {
          ucheckUsuarioId: undefined,
          correo: USUARIO.correo,
          nombre: 'Lucía Giménez',
          telefono: '+595981000111',
          legajo: null,
          empresa: 'Frigorifico Guarani',
          activo: true,
          programas: ['COMERCIA', 'SEGUIMIENTO'],
        },
      },
    );
    expect(prisma.identidadUcheck.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          usuarioId: 7,
          ucheckUsuarioId: 42,
          correoVinculado: USUARIO.correo,
        },
      }),
    );
    expect(prisma.ucheckUsuarioPendiente.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: 7, version: 3 },
    });
  });

  it('da de baja la cuenta vinculada aunque ya no sea de campo, y usa el vínculo anterior al cambio de correo', async () => {
    const { ucheck, servicio } = preparar(
      { ...USUARIO, isActive: false, rol: null },
      { ucheckUsuarioId: 42 },
    );
    await servicio.sincronizar();
    expect(ucheck.pedir.mock.calls[0][1]).toMatchObject({
      body: { ucheckUsuarioId: 42, activo: false, programas: [] },
    });
  });

  it('no crea en Ucheck a quien no es de campo, ni re-vincula una cuenta desvinculada a mano', async () => {
    for (const usuario of [
      { ...USUARIO, rol: null },
      { ...USUARIO, permitirVinculoAutomatico: false },
      { ...USUARIO, correo: 'sin.correo@sin-correo.invalid' },
    ]) {
      const { prisma, ucheck, servicio } = preparar(usuario);
      await servicio.sincronizar();
      expect(ucheck.pedir).not.toHaveBeenCalled();
      expect(prisma.ucheckUsuarioPendiente.deleteMany).toHaveBeenCalled();
    }
  });

  it('si Ucheck no responde conserva el cambio y lo reprograma con espera creciente', async () => {
    const { prisma, ucheck, servicio } = preparar(USUARIO, { intentos: 2 });
    ucheck.pedir.mockRejectedValue(new Error('No se pudo conectar con Ucheck'));
    const antes = Date.now();
    await servicio.sincronizar();
    expect(prisma.ucheckUsuarioPendiente.deleteMany).not.toHaveBeenCalled();
    const llamada = prisma.ucheckUsuarioPendiente.updateMany.mock
      .calls[0][0] as {
      where: unknown;
      data: { intentos: number; ultimoError: string; siguienteIntento: Date };
    };
    expect(llamada.where).toEqual({ usuarioId: 7, version: 3 });
    expect(llamada.data.intentos).toBe(3);
    expect(llamada.data.ultimoError).toBe('No se pudo conectar con Ucheck');
    // Tercer intento: 30 s · 2² = 2 min.
    expect(
      llamada.data.siguienteIntento.getTime() - antes,
    ).toBeGreaterThanOrEqual(120_000);
  });

  it('anotar un cambio sube la versión y lo deja listo para mandar ya', async () => {
    const { prisma, servicio } = preparar();
    await servicio.marcar(7, 42);
    expect(prisma.ucheckUsuarioPendiente.upsert.mock.calls[0][0]).toMatchObject(
      {
        where: { usuarioId: 7 },
        create: { usuarioId: 7, ucheckUsuarioId: 42 },
        update: {
          version: { increment: 1 },
          ucheckUsuarioId: 42,
          intentos: 0,
          ultimoError: null,
        },
      },
    );
  });
});
