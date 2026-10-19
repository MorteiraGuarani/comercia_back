import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { EntradaCampoDto, MarcaCampoDto } from './dto/campo.dto';
import { JornadaCampoService } from './jornada-campo.service';
import { fechaCampo, relojCampo } from './utils/calendario';

const local = { latitud: -25.3, longitud: -57.6, radioMetros: 100 };

function contexto() {
  const tx = {
    configuracionTolerancia: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    asignacionCampo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 2,
        localId: 3,
        local,
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
      findFirst: jest.fn().mockResolvedValue({ local }),
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

  it('busca solo la visita de hoy y las entradas anteriores no bloquean otra fecha', async () => {
    const { servicio, prisma, tx, marca } = contexto();
    prisma.visitaCampo.findFirst.mockResolvedValue(null);
    expect(await servicio.abierta(1)).toBeNull();
    expect(prisma.visitaCampo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha: new Date('2026-10-10T00:00:00Z'),
          salida: null,
          usuarioId: 1,
        }) as unknown,
      }),
    );
    await servicio.entrada(
      1,
      Object.assign(new EntradaCampoDto(), marca, { asignacionId: 2 }),
    );
    expect(tx.visitaCampo.count).toHaveBeenCalledWith({
      where: {
        usuarioId: 1,
        fecha: new Date('2026-10-10T00:00:00Z'),
        salida: null,
      },
    });
  });

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
  it('guarda la distancia de entrada y bloquea una entrada fuera del radio', async () => {
    const { servicio, tx, marca } = contexto();
    await servicio.entrada(
      1,
      Object.assign(new EntradaCampoDto(), marca, { asignacionId: 2 }),
    );
    const llamadasEntrada = tx.visitaCampo.create.mock
      .calls as unknown as Array<
      [{ data: { entradaDistancia: number; entradaPrecision: number } }]
    >;
    const entrada = llamadasEntrada[0][0];
    expect(entrada.data.entradaDistancia).toBe(0);
    expect(entrada.data.entradaPrecision).toBe(20);

    await expect(
      servicio.entrada(
        1,
        Object.assign(new EntradaCampoDto(), marca, {
          asignacionId: 2,
          latitud: local.latitud + 0.001,
        }),
      ),
    ).rejects.toThrow('fuera del radio');
    expect(tx.visitaCampo.create).toHaveBeenCalledTimes(1);
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
