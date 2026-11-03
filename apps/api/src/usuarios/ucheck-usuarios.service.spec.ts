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
    expect(programasUcheck(null)).toEqual([]);
  });
});

describe('UcheckUsuariosService', () => {
  const USUARIO = {
    correo: 'lucia.gimenez@example.com',
    nombreLogin: 'lucia.gimenez',
    nombre: 'Lucía',
    apellido: 'Giménez',
    celular: '+595981000111',
    legajo: null,
    isActive: true,
    esSuperadmin: false,
    permitirVinculoAutomatico: true,
    programasUcheck: ['COMERCIA', 'SEGUIMIENTO'],
    empresa: { nombre: 'Frigorifico Guarani' },
    identidadUcheck: null as { ucheckUsuarioId: number } | null,
  };

  function preparar(usuario: unknown = USUARIO, pendiente = {}) {
    const tx = {
      $queryRaw: jest.fn(),
      usuario: { update: jest.fn<Promise<unknown>, [unknown]>() },
      ucheckUsuarioPendiente: {
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn(),
        upsert: jest.fn<Promise<unknown>, [unknown]>(),
      },
      identidadUcheck: { upsert: jest.fn<Promise<unknown>, [unknown]>() },
    };
    const prisma = {
      ucheckUsuarioPendiente: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              usuarioId: 7,
              version: 3,
              ucheckUsuarioId: null,
              programas: true,
              intentos: 0,
              ...pendiente,
            },
          ])
          .mockResolvedValue([]),
        updateMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      usuario: { findUnique: jest.fn().mockResolvedValue(usuario) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const ucheck = {
      configurado: () => true,
      pedir: jest.fn<Promise<unknown>, [string, unknown]>().mockResolvedValue({
        ucheckUsuarioId: 42,
        correo: USUARIO.correo,
        programas: ['COMERCIA', 'UWEB'],
      }),
    };
    const servicio = new UcheckUsuariosService(
      prisma as unknown as PrismaService,
      ucheck as unknown as UcheckClienteService,
    );
    return { tx, prisma, ucheck, servicio };
  }

  it('manda el estado con su usuario único y programas, guarda la copia y el vínculo, y borra el pendiente', async () => {
    const { tx, ucheck, servicio } = preparar();
    await servicio.sincronizar();
    expect(ucheck.pedir).toHaveBeenCalledWith(
      '/comercia-integracion/usuarios',
      {
        method: 'PUT',
        body: {
          ucheckUsuarioId: undefined,
          correo: USUARIO.correo,
          nombreUsuario: 'lucia.gimenez',
          nombre: 'Lucía Giménez',
          telefono: '+595981000111',
          legajo: null,
          empresa: 'Frigorifico Guarani',
          activo: true,
          programas: ['COMERCIA', 'SEGUIMIENTO'],
        },
      },
    );
    // La copia es lo que Ucheck confirmó, no lo pedido.
    expect(tx.usuario.update.mock.calls[0][0]).toMatchObject({
      where: { id: 7 },
      data: { programasUcheck: ['COMERCIA', 'UWEB'] },
    });
    expect(tx.identidadUcheck.upsert.mock.calls[0][0]).toMatchObject({
      create: {
        usuarioId: 7,
        ucheckUsuarioId: 42,
        correoVinculado: USUARIO.correo,
      },
    });
    expect(tx.ucheckUsuarioPendiente.delete).toHaveBeenCalledWith({
      where: { usuarioId: 7 },
    });
  });

  it('sin cambio de programas en el ABM no los manda: Ucheck conserva los suyos', async () => {
    const { ucheck, servicio } = preparar(
      { ...USUARIO, identidadUcheck: { ucheckUsuarioId: 42 } },
      { programas: false },
    );
    await servicio.sincronizar();
    expect(ucheck.pedir.mock.calls[0][1]).toMatchObject({
      body: { ucheckUsuarioId: 42, programas: undefined },
    });
  });

  it('si lo editaron durante el envío no guarda la copia ni borra el pendiente', async () => {
    const { tx, servicio } = preparar();
    tx.ucheckUsuarioPendiente.count.mockResolvedValue(0);
    await servicio.sincronizar();
    expect(tx.usuario.update).not.toHaveBeenCalled();
    expect(tx.ucheckUsuarioPendiente.delete).not.toHaveBeenCalled();
  });

  it('da de baja la cuenta vinculada antes del cambio de correo', async () => {
    const { ucheck, servicio } = preparar(
      { ...USUARIO, isActive: false, programasUcheck: [] },
      { ucheckUsuarioId: 42 },
    );
    await servicio.sincronizar();
    expect(ucheck.pedir.mock.calls[0][1]).toMatchObject({
      body: { ucheckUsuarioId: 42, activo: false, programas: [] },
    });
  });

  it('no crea en Ucheck a quien no tiene programas, ni re-vincula una cuenta desvinculada a mano', async () => {
    for (const usuario of [
      { ...USUARIO, programasUcheck: [] },
      { ...USUARIO, permitirVinculoAutomatico: false },
      { ...USUARIO, correo: 'sin.correo@sin-correo.invalid' },
    ]) {
      const { tx, ucheck, servicio } = preparar(usuario);
      await servicio.sincronizar();
      expect(ucheck.pedir).not.toHaveBeenCalled();
      expect(tx.ucheckUsuarioPendiente.delete).toHaveBeenCalled();
    }
  });

  it('si Ucheck no responde conserva el cambio y lo reprograma con espera creciente', async () => {
    const { prisma, ucheck, servicio } = preparar(USUARIO, { intentos: 2 });
    ucheck.pedir.mockRejectedValue(new Error('No se pudo conectar con Ucheck'));
    const antes = Date.now();
    await servicio.sincronizar();
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

  it('anotar programas los guarda junto con la versión y la marca de programas', async () => {
    const { tx, servicio } = preparar();
    await servicio.marcar(7, { ucheckUsuarioId: 42, programas: ['UWEB'] });
    expect(tx.usuario.update.mock.calls[0][0]).toMatchObject({
      where: { id: 7 },
      data: { programasUcheck: ['UWEB'] },
    });
    expect(tx.ucheckUsuarioPendiente.upsert.mock.calls[0][0]).toMatchObject({
      where: { usuarioId: 7 },
      create: { usuarioId: 7, ucheckUsuarioId: 42, programas: true },
      update: {
        version: { increment: 1 },
        ucheckUsuarioId: 42,
        programas: true,
        intentos: 0,
        ultimoError: null,
      },
    });
  });
});
