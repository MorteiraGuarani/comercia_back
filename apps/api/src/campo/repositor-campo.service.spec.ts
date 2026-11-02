import type { UcheckSincronizacionService } from '../ucheck/ucheck-sincronizacion.service';
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest objectContaining returns any. */
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RepositorCampoService } from './repositor-campo.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import type { ConfigService } from '@nestjs/config';

describe('RepositorCampoService', () => {
  it('exige terminar las tareas aplicables antes de registrar salida en Ucheck', async () => {
    const prisma = {
      visitaCampo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9,
          localId: 8,
          asignacionId: 7,
          horarioId: null,
          fecha: new Date('2026-09-25'),
          ucheckJornadaId: 6,
        }),
      },
      tareaCampo: { count: jest.fn().mockResolvedValue(2) },
      usuario: { findUnique: jest.fn() },
    };
    const acceso = {
      ejecutar: jest.fn().mockResolvedValue({
        empresaId: 1,
        rolDescripcion: 'REPOSITOR',
        equipoCampo: {
          id: 2,
          nombre: 'Repositores',
          tipo: 'REPOSITOR',
          activo: true,
        },
      }),
    };
    const config = { get: jest.fn() };
    const servicio = new RepositorCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
      config as unknown as ConfigService,
      { ahora: jest.fn() } as unknown as UcheckSincronizacionService,
    );
    await expect(servicio.salida(3, 9, { nota: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tareaCampo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          empresaId: 1,
          equipoCampoId: 2,
          OR: expect.arrayContaining([
            expect.objectContaining({ activo: true }),
            { cumplimientos: { some: { visitaId: 9, completadaAt: null } } },
          ]),
        }),
      }),
    );
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  const supervisora = () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          correo: 'tania@example.com',
          identidadUcheck: null,
          permitirVinculoAutomatico: true,
          isActive: true,
          rol: {
            descripcion: 'Supervisor',
            equipoCampo: { id: 2, tipo: 'IMPULSADOR', activo: true },
          },
        }),
      },
      visitaCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const servicio = new RepositorCampoService(
      prisma as unknown as PrismaService,
      {
        ejecutar: jest.fn().mockResolvedValue({
          empresaId: 1,
          equipoCampo: { id: 2, tipo: 'IMPULSADOR', activo: true },
        }),
      } as unknown as CampoAccesoService,
      {
        get: (k: string) =>
          k === 'integrations.ucheckApiUrl' ? 'http://ucheck' : 'secreto',
      } as unknown as ConfigService,
      {
        ahora: jest.fn().mockResolvedValue(undefined),
      } as unknown as UcheckSincronizacionService,
    );
    return servicio;
  };

  it('un supervisor sin GPS del navegador marca con la ubicación del teléfono en Ucheck', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ucheckJornadaId: 6, tipo: 'ENTRADA' })),
      );
    const servicio = supervisora();
    try {
      // Sin la copia todavía en Comercia: lo que importa es lo que fue a Ucheck.
      await expect(
        servicio.entradaWeb(3, { asignacionId: 7, nota: '' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      const cuerpo = JSON.parse(
        (fetch.mock.calls[0][1] as { body: string }).body,
      ) as Record<string, unknown>;
      expect(cuerpo).toMatchObject({ asignacionId: 7, tipo: 'ENTRADA' });
      expect(cuerpo).not.toHaveProperty('ubicacion');
    } finally {
      fetch.mockRestore();
    }
  });

  it('una marca guardada sin conexión va a Ucheck con su hora y su GPS reales', async () => {
    const tomadaEn = new Date(Date.now() - 30 * 60_000).toISOString();
    const marca = {
      tipo: 'SALIDA' as const,
      asignacionId: 7,
      fecha: tomadaEn.slice(0, 10),
      tomadaEn,
      nota: '',
      ubicacion: {
        latitud: -25.3,
        longitud: -57.6,
        precisionMetros: 9,
        capturadaEn: tomadaEn,
      },
    };
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ucheckJornadaId: 6, tipo: 'SALIDA' })),
      );
    const servicio = supervisora();
    try {
      // Ucheck caído: la web la conserva en el navegador y reintenta.
      await expect(servicio.marcaSinConexion(3, marca)).rejects.toMatchObject({
        response: { codigo: 'UCHECK_SIN_CONEXION' },
      });
      await expect(servicio.marcaSinConexion(3, marca)).resolves.toEqual({
        estado: 'CONFIRMADA',
      });
      const cuerpo = JSON.parse(
        (fetch.mock.calls[1][1] as { body: string }).body,
      ) as Record<string, unknown>;
      expect(cuerpo).toMatchObject({
        tipo: 'SALIDA',
        registradaEn: tomadaEn,
        ubicacion: { latitud: -25.3, precisionMetros: 9 },
      });
      await expect(
        servicio.marcaSinConexion(3, {
          ...marca,
          tomadaEn: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      fetch.mockRestore();
    }
  });
});
