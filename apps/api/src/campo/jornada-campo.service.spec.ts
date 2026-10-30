import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { MarcaCampoDto } from './dto/campo.dto';
import { JornadaCampoService } from './jornada-campo.service';
import { fechaCampo, relojCampo } from './utils/calendario';

const local = { latitud: -25.3, longitud: -57.6 };
// Fila de OCRD: SAP guarda las coordenadas como texto.
const socio = {
  CardCode: 'L3',
  CardName: 'Centro',
  U_Latitud: '-25.3',
  U_Longitud: '-57.6',
  // 0.001° de latitud ≈ 111 m: queda fuera de este radio.
  U_RadioMetros: 100,
};

function contexto() {
  const tx = {
    configuracionTolerancia: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    asignacionCampo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 2,
        localId: 'L3',
        local: socio,
        usuarioId: 1,
        backups: [],
      }),
    },
    visitaCampo: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 4,
        fecha: fechaCampo(relojCampo().fecha),
        entrada: new Date(),
        salida: null,
        local: socio,
      }),
    },
    horarioCampo: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    visitaCampo: {
      findFirst: jest.fn().mockResolvedValue({ local: socio }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const acceso = {
    ejecutar: jest.fn().mockResolvedValue({
      id: 1,
      empresaId: 10,
      equipoCampo: {
        id: 1,
        nombre: 'Impulsadores',
        tipo: 'IMPULSADOR',
        activo: true,
      },
    }),
  };
  const servicio = new JornadaCampoService(
    prisma as unknown as PrismaService,
    acceso as unknown as CampoAccesoService,
  );
  const marca = {
    latitud: local.latitud,
    longitud: local.longitud,
    precisionMetros: 20,
    capturadaEn: new Date().toISOString(),
    nota: '',
  };
  return { servicio, prisma, tx, marca, acceso };
}

describe('marcaciones directas de Comercia', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T10:30:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());

  it('rechaza la salida de una jornada vencida sin cambiar registros', async () => {
    const { servicio, prisma, marca } = contexto();
    prisma.visitaCampo.findFirst.mockResolvedValue(null);
    await expect(
      servicio.salida(1, 11, Object.assign(new MarcaCampoDto(), marca)),
    ).rejects.toThrow('Visita abierta no disponible');
    expect(prisma.visitaCampo.updateMany).not.toHaveBeenCalled();
  });
  it('el repositor ve las tareas del local antes de marcar entrada', async () => {
    const { servicio, prisma, acceso } = contexto();
    acceso.ejecutar.mockResolvedValue({
      id: 1,
      empresaId: 10,
      equipoCampo: {
        id: 2,
        nombre: 'Repositores',
        tipo: 'REPOSITOR',
        activo: true,
      },
    });
    Object.assign(prisma, {
      asignacionCampo: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 2, localId: 3, usuarioId: 1, backups: [] }),
      },
      tareaCampo: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            nombre: 'Reponer góndola',
            destinatario: 'REPOSITOR',
            descripcion: 'Frente completo',
            requiereFotos: false,
            fotosObligatorias: false,
            categoria: 'Góndola',
            esObligatoria: true,
            cumplimientos: [],
          },
        ]),
      },
    });
    const respuesta = await servicio.tareas(1, 2, { fecha: '2026-10-10' });
    expect(respuesta.total).toBe(1);
    expect(respuesta.items[0]).toMatchObject({
      id: 7,
      nombre: 'Reponer góndola',
      iniciadaAt: null,
      visitasCompletadas: [],
    });
    // Ya no depende de tener una visita abierta para listar.
    expect(prisma.visitaCampo.findFirst).not.toHaveBeenCalled();
  });

  it('trae las tareas de varios locales en una consulta y omite asignaciones ajenas', async () => {
    const { servicio, prisma } = contexto();
    const tarea = (id: number, todosLocales: boolean, locales: number[]) => ({
      id,
      nombre: `Tarea ${id}`,
      destinatario: 'IMPULSADOR',
      descripcion: '',
      requiereFotos: false,
      fotosObligatorias: false,
      categoria: null,
      esObligatoria: false,
      activo: true,
      fechaDesde: new Date('2026-10-01T00:00:00Z'),
      fechaHasta: null,
      todosLocales,
      locales: locales.map((localId) => ({ localId })),
      cumplimientos: [],
    });
    const findManyTareas = jest
      .fn()
      .mockResolvedValue([
        tarea(1, true, []),
        tarea(2, false, [3]),
        tarea(3, false, [9]),
      ]);
    Object.assign(prisma, {
      asignacionCampo: {
        findMany: jest.fn().mockResolvedValue([
          { id: 2, localId: 3, usuarioId: 1, backups: [] },
          { id: 5, localId: 9, usuarioId: 1, backups: [] },
          { id: 6, localId: 4, usuarioId: 77, backups: [] },
        ]),
      },
      // Sin nadie a cargo: la asignación del usuario 77 no es de su ruta.
      usuario: { findMany: jest.fn().mockResolvedValue([]) },
      tareaCampo: { findMany: findManyTareas },
    });
    const respuesta = await servicio.tareasDelDia(1, {
      fecha: '2026-10-10',
      asignaciones: [2, 5, 6],
    });
    expect(respuesta.items.map((i) => i.asignacionId)).toEqual([2, 5]);
    expect(respuesta.items[0].items.map((t) => t.id)).toEqual([1, 2]);
    expect(respuesta.items[1].items.map((t) => t.id)).toEqual([1, 3]);
    expect(respuesta.items[0].items[0]).not.toHaveProperty('locales');
    expect(findManyTareas).toHaveBeenCalledTimes(1);
  });

  it('un supervisor ve las tareas de los locales que hereda de su cadena', async () => {
    const { servicio, prisma } = contexto();
    const findManyUsuarios = jest
      .fn()
      .mockResolvedValueOnce([{ id: 30 }]) // su TeamLeader
      .mockResolvedValueOnce([{ id: 77 }]) // el impulsador del TeamLeader
      .mockResolvedValue([]);
    Object.assign(prisma, {
      asignacionCampo: {
        findMany: jest.fn().mockResolvedValue([
          { id: 2, localId: 3, usuarioId: 1, backups: [] },
          { id: 6, localId: 4, usuarioId: 77, backups: [] },
          { id: 8, localId: 5, usuarioId: 99, backups: [] },
        ]),
      },
      usuario: { findMany: findManyUsuarios },
      tareaCampo: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const respuesta = await servicio.tareasDelDia(1, {
      fecha: '2026-10-10',
      asignaciones: [2, 6, 8],
    });
    expect(respuesta.items.map((i) => i.asignacionId)).toEqual([2, 6]);
    // La cadena se arma solo con gente activa de su mismo equipo.
    const where: unknown = expect.objectContaining({
      isActive: true,
      superiorId: { in: [1] },
      rol: { equipoCampoId: 1 },
    });
    expect(findManyUsuarios).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
  });

  it('no completa una tarea sobre una jornada anterior sin salida', async () => {
    const { servicio, tx } = contexto();
    Object.assign(tx.visitaCampo, {
      findFirst: jest.fn().mockResolvedValue({
        id: 11,
        localId: 3,
        fecha: new Date('2026-10-09'),
        salida: null,
      }),
    });
    const upsert = jest.fn();
    Object.assign(tx, {
      cumplimientoCampo: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
      },
    });
    await expect(servicio.completar(1, 11, 7)).rejects.toThrow(
      'La visita ya terminó',
    );
    expect(upsert).not.toHaveBeenCalled();
  });
  it('guarda la distancia de salida y bloquea una salida fuera del radio', async () => {
    const { servicio, prisma, marca } = contexto();
    await servicio.salida(1, 4, Object.assign(new MarcaCampoDto(), marca));
    const llamadasSalida = prisma.visitaCampo.updateMany.mock
      .calls as unknown as Array<
      [{ data: { salidaDistancia: number; salidaPrecision: number } }]
    >;
    const salida = llamadasSalida[0][0];
    expect(salida.data.salidaDistancia).toBe(0);
    expect(salida.data.salidaPrecision).toBe(20);

    await expect(
      servicio.salida(
        1,
        4,
        Object.assign(new MarcaCampoDto(), marca, {
          latitud: local.latitud + 0.001,
        }),
      ),
    ).rejects.toThrow('fuera del radio');
    expect(prisma.visitaCampo.updateMany).toHaveBeenCalledTimes(1);
  });
});
