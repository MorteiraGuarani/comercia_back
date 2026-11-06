import type { UcheckSincronizacionService } from '../ucheck/ucheck-sincronizacion.service';
import type { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest objectContaining returns any. */
import {
  BadRequestException,
  NotFoundException,
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
          // Titular del local: sus tareas son las que se exigen.
          asignacion: {
            usuario: {
              rol: {
                equipoCampo: {
                  id: 2,
                  nombre: 'Repositores',
                  tipo: 'REPOSITOR',
                  activo: true,
                },
              },
            },
          },
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
      {} as UcheckClienteService,
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

  it('el supervisor de repositores puede iniciar visita en un local heredado de su cadena', async () => {
    const prisma = {
      usuario: {
        // Cadena: antonio (218) → maria (222) → nadie.
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 222 }])
          .mockResolvedValueOnce([]),
      },
      // Sin asignación: alcanza con ver qué alcance se consultó.
      asignacionCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const servicio = new RepositorCampoService(
      prisma as unknown as PrismaService,
      {
        ejecutar: jest.fn().mockResolvedValue({
          id: 218,
          empresaId: 2,
          equipoCampo: { id: 5, tipo: 'REPOSITOR', activo: true },
        }),
      } as unknown as CampoAccesoService,
      { get: jest.fn() } as unknown as ConfigService,
      { ahora: jest.fn() } as unknown as UcheckSincronizacionService,
      {} as UcheckClienteService,
    );
    await expect(
      servicio.entrada(218, { asignacionId: 7, nota: '' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const [[{ where }]] = prisma.asignacionCampo.findFirst.mock.calls as [
      [{ where: { AND: Array<{ OR: unknown[] }> } }],
    ];
    expect(where.AND[1].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ usuarioId: { in: [222] } }),
        {
          backups: {
            some: expect.objectContaining({ usuarioId: { in: [222] } }),
          },
        },
      ]),
    );
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
      {} as UcheckClienteService,
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

  it('un rechazo de Ucheck llega como 400; 401/403/5xx como 503 para que la web reintente', async () => {
    const tomadaEn = new Date(Date.now() - 5 * 60_000).toISOString();
    const marca = {
      tipo: 'ENTRADA' as const,
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
    const respuesta = (status: number, message: string) =>
      new Response(JSON.stringify({ message }), { status });
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuesta(400, 'Estás fuera del radio permitido'))
      .mockResolvedValueOnce(
        respuesta(401, 'Credencial de integración inválida'),
      )
      .mockResolvedValueOnce(
        respuesta(403, 'Programa de Comercia no habilitado'),
      )
      .mockResolvedValueOnce(respuesta(500, 'error'));
    const servicio = supervisora();
    try {
      await expect(servicio.marcaSinConexion(3, marca)).rejects.toMatchObject({
        status: 400,
        message: 'Estás fuera del radio permitido',
      });
      for (const detalle of ['respondió 401', 'respondió 403', ''])
        await expect(servicio.marcaSinConexion(3, marca)).rejects.toMatchObject(
          {
            status: 503,
            message: expect.stringContaining(detalle) as unknown,
            response: { codigo: 'UCHECK_SIN_CONEXION' },
          },
        );
    } finally {
      fetch.mockRestore();
    }
  });

  it('reintentar pide a Ucheck reenviar las marcas pendientes y las trae', async () => {
    const id = 'rep-' + 'a'.repeat(48);
    const count = jest.fn().mockResolvedValueOnce(0);
    const prisma = {
      operacionCampo: {
        findMany: jest.fn().mockResolvedValue([{ id }]),
        count,
      },
    };
    const pedir = jest.fn().mockResolvedValue({ reencolados: 1 });
    const servicio = new RepositorCampoService(
      prisma as unknown as PrismaService,
      { ejecutar: jest.fn() } as unknown as CampoAccesoService,
      { get: jest.fn() } as unknown as ConfigService,
      { ahora: jest.fn() } as unknown as UcheckSincronizacionService,
      { pedir } as unknown as UcheckClienteService,
    );
    const estado = jest
      .spyOn(servicio, 'estadoOperacion')
      .mockResolvedValue({ estado: 'CONFIRMADA', mensaje: '' });
    await expect(servicio.reintentarPendientes(3)).resolves.toEqual({
      pendientes: 0,
    });
    expect(pedir).toHaveBeenCalledWith(
      '/comercia-integracion/marcaciones/reintentar',
      { method: 'POST', body: { ids: [id] } },
    );
    expect(estado).toHaveBeenCalledWith(3, id);
    expect(prisma.operacionCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 3, estado: 'PENDIENTE' } }),
    );
  });
});
