/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- Partial Prisma mocks are intentionally cast at the service boundary. */

import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CampoAccesoService } from '../campo-acceso.service';
import type { NotificacionService } from './notificacion.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {},
  DestinatarioTareaCampo: {
    IMPULSADOR: 'IMPULSADOR',
    REPOSITOR: 'REPOSITOR',
    AMBOS: 'AMBOS',
  },
}));
jest.mock('../utils/multer-config', () => ({
  validarArchivoImagen: jest.fn(),
}));

import { FotoService } from './foto.service';
import { JornadaCampoService } from '../jornada-campo.service';
import { ComentarioService } from './comentario.service';
import { MomentoFotoDto } from '../dto/foto-tarea.dto';
import * as autorizacion from '../utils/autorizacion';

describe('Evidencias antes de completar una tarea', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-09-17T10:30:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());
  function contexto(obligatorias = true) {
    const fotos: { momento: string }[] = [];
    const prisma = {
      visitaCampo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 20,
          localId: 30,
          fecha: new Date('2026-09-17'),
          usuario: {
            rol: {
              descripcion: 'Operador nuevo',
              equipoCampo: {
                id: 1,
                nombre: 'Impulsadores',
                tipo: 'IMPULSADOR',
                activo: true,
              },
            },
          },
        }),
      },
      tareaCampo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 40,
          nombre: 'Ordenar góndola',
          requiereFotos: true,
          fotosObligatorias: obligatorias,
        }),
      },
      cumplimientoCampo: {
        update: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ tareaId: 40 }),
        findUnique: jest.fn(),
      },
      fotoTareaCampo: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(fotos)),
        count: jest
          .fn()
          .mockImplementation(() => Promise.resolve(fotos.length)),
        create: jest.fn().mockImplementation(({ data }) => {
          fotos.push({ momento: data.momento });
          return Promise.resolve({
            id: fotos.length,
            ...data,
            creadoAt: new Date(),
          });
        }),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    const servicioFotos = new FotoService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
    );
    const jornada = new JornadaCampoService(
      prisma as unknown as PrismaService,
      {
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
      } as unknown as CampoAccesoService,
    );
    const archivo = {
      path: 'uploads/prueba.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    } as Express.Multer.File;
    return { prisma, servicioFotos, jornada, archivo };
  }

  it('guarda antes y después como borrador y solo completa al tener ambas', async () => {
    const { prisma, servicioFotos, jornada, archivo } = contexto();
    await servicioFotos.subir(1, 10, 20, 40, MomentoFotoDto.ANTES, archivo);
    expect(prisma.cumplimientoCampo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          completadaAt: null,
          fotosValidadas: false,
        }),
        update: {},
      }),
    );
    await expect(jornada.completar(1, 20, 40)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await servicioFotos.subir(1, 10, 20, 40, MomentoFotoDto.DESPUES, archivo);
    await expect(jornada.completar(1, 20, 40)).resolves.toEqual({ ok: true });
    expect(prisma.cumplimientoCampo.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: { fotosValidadas: true, completadaAt: expect.any(Date) },
      }),
    );
  });

  it('permite completar sin evidencias si las fotos son opcionales', async () => {
    const { jornada } = contexto(false);
    await expect(jornada.completar(1, 20, 40)).resolves.toEqual({ ok: true });
  });

  it('permite comentar antes de completar sin incrementar el cumplimiento', async () => {
    const { prisma } = contexto();
    prisma.cumplimientoCampo.findUnique.mockResolvedValue(null);
    Object.assign(prisma, {
      comentarioTareaCampo: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          comentario: 'Falta mercadería',
          usuario: { id: 1 },
          creadoAt: new Date(),
          leidoPorLider: false,
        }),
      },
    });
    const service = new ComentarioService(
      prisma as unknown as PrismaService,
      {
        crearNotificacionComentario: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificacionService,
    );
    await expect(
      service.crear(1, 10, 20, 40, { comentario: 'Falta mercadería' }),
    ).resolves.toMatchObject({ id: 1 });
    expect(prisma.cumplimientoCampo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ completadaAt: null }),
      }),
    );
  });

  it('el líder responde en el hilo y le avisa al dueño; alguien ajeno no puede comentar', async () => {
    const { prisma } = contexto();
    prisma.cumplimientoCampo.findUnique.mockResolvedValue({
      nombreTarea: 'Visicooler',
      visita: { usuarioId: 2 },
    });
    Object.assign(prisma, {
      comentarioTareaCampo: {
        create: jest.fn().mockResolvedValue({
          id: 7,
          comentario: 'Revisá la temperatura',
          usuario: { id: 1 },
          creadoAt: new Date(),
          leidoPorLider: false,
        }),
      },
    });
    const notificaciones = {
      crearNotificacionComentario: jest.fn(),
      crearNotificacionRespuestaComentario: jest.fn(),
    };
    const service = new ComentarioService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
    );
    const lider = jest.spyOn(autorizacion, 'esLiderDe').mockResolvedValue(true);
    await service.crear(1, 10, 20, 40, { comentario: 'Revisá la temperatura' });
    expect(
      notificaciones.crearNotificacionRespuestaComentario,
    ).toHaveBeenCalledWith(10, 1, 2, 7, 'Visicooler');
    expect(notificaciones.crearNotificacionComentario).not.toHaveBeenCalled();

    lider.mockResolvedValue(false);
    await expect(
      service.crear(1, 10, 20, 40, { comentario: 'Hola' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    lider.mockRestore();
  });

  it('ubica el hilo de un comentario para abrirlo desde la notificación', async () => {
    const { prisma } = contexto();
    Object.assign(prisma, {
      comentarioTareaCampo: {
        findUnique: jest.fn().mockResolvedValue({
          cumplimientoVisitaId: 20,
          cumplimientoTareaId: 40,
          cumplimiento: { visita: { usuarioId: 2 } },
        }),
      },
    });
    const acceso = jest
      .spyOn(autorizacion, 'verificarAccesoCumplimiento')
      .mockResolvedValue(undefined);
    const service = new ComentarioService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
    );
    await expect(service.ubicar(1, 7)).resolves.toEqual({
      visitaId: 20,
      tareaId: 40,
      esPropia: false,
    });
    expect(acceso).toHaveBeenCalledWith(prisma, 1, 20, 40);
    acceso.mockRestore();
  });

  it('rechaza subir fotos fuera de una visita propia abierta y de la empresa', async () => {
    const { prisma, servicioFotos, archivo } = contexto();
    prisma.visitaCampo.findFirst.mockResolvedValue(null);
    await expect(
      servicioFotos.subir(1, 10, 20, 40, MomentoFotoDto.ANTES, archivo),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.visitaCampo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 20,
          usuarioId: 1,
          fecha: new Date('2026-09-17T00:00:00Z'),
          salida: null,
          empresaId: 10,
        },
      }),
    );
    expect(prisma.fotoTareaCampo.create).not.toHaveBeenCalled();
  });

  it('no entrega el archivo de una tarea de otro usuario sin acceso', async () => {
    const { prisma, servicioFotos } = contexto();
    prisma.fotoTareaCampo.findFirst.mockResolvedValue({
      id: 1,
      cumplimientoVisitaId: 20,
      cumplimientoTareaId: 40,
    });
    prisma.cumplimientoCampo.findUnique.mockResolvedValue({
      visita: { usuarioId: 2 },
    });
    Object.assign(prisma, {
      usuario: { findUnique: jest.fn().mockResolvedValue({ rol: null }) },
    });
    await expect(servicioFotos.obtenerPorId(1, 10, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deja quitar fotos obligatorias hasta terminar la tarea', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { prisma, servicioFotos } = contexto();
    const borrar = jest.fn();
    Object.assign(prisma.fotoTareaCampo, { delete: borrar });
    prisma.fotoTareaCampo.findUnique.mockResolvedValue({
      id: 5,
      rutaArchivo: 'no-existe.jpg',
    });
    const cumplimiento = (completadaAt: Date | null) => ({
      visita: { usuarioId: 1 },
      tarea: { fotosObligatorias: true },
      completadaAt,
    });
    prisma.cumplimientoCampo.findUnique.mockResolvedValue(cumplimiento(null));
    await servicioFotos.eliminar(1, 20, 40, MomentoFotoDto.ANTES);
    expect(borrar).toHaveBeenCalledWith({ where: { id: 5 } });

    prisma.cumplimientoCampo.findUnique.mockResolvedValue(
      cumplimiento(new Date()),
    );
    await expect(
      servicioFotos.eliminar(1, 20, 40, MomentoFotoDto.ANTES),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
