import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { EntradaCampoDto, MarcaCampoDto } from './dto/campo.dto';
import { JornadaCampoService } from './jornada-campo.service';

const local = { latitud: -25.3, longitud: -57.6, radioMetros: 100 };

function contexto() {
  const tx = {
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
      create: jest.fn().mockResolvedValue({ id: 4 }),
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
    ejecutar: jest.fn().mockResolvedValue({ id: 1, empresaId: 10 }),
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
  return { servicio, prisma, tx, marca };
}

describe('marcaciones directas de Comercia', () => {
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
