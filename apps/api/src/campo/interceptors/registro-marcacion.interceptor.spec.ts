import {
  BadRequestException,
  type ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CampoController } from '../campo.controller';
import { RegistroMarcacionInterceptor } from './registro-marcacion.interceptor';
import type { RegistroMarcacionesService } from '../services/registro-marcaciones.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('uuid', () => ({ v4: () => 'archivo-de-prueba' }));

describe('RegistroMarcacionInterceptor', () => {
  const registrar = jest.fn().mockResolvedValue(undefined);
  const interceptor = new RegistroMarcacionInterceptor({
    registrar,
  } as unknown as RegistroMarcacionesService);
  const body = {
    tipo: 'ENTRADA',
    asignacionId: 7,
    tomadaEn: '2026-11-06T12:00:00.000Z',
    ubicacion: {
      latitud: -25.301234,
      longitud: -57.601234,
      precisionMetros: 9,
    },
  };
  const pedido = {
    method: 'POST',
    route: { path: '/api/campo/jornada/marcas-sin-conexion' },
    params: {},
    query: {},
    body,
    usuarioId: 3,
  };
  const contexto = (p: Record<string, unknown> = pedido) =>
    ({
      switchToHttp: () => ({ getRequest: () => p }),
      getHandler: () => () => undefined,
    }) as unknown as ExecutionContext;
  const fila = () =>
    (registrar.mock.calls.at(-1) as [Record<string, unknown>])[0];

  beforeEach(() => jest.clearAllMocks());

  it('guarda la aceptada con el pedido completo, coordenadas incluidas', async () => {
    await expect(
      lastValueFrom(
        interceptor.intercept(contexto(), {
          handle: () => of({ estado: 'PENDIENTE' }),
        }),
      ),
    ).resolves.toEqual({ estado: 'PENDIENTE' });
    expect(fila()).toMatchObject({
      ruta: 'POST /api/campo/jornada/marcas-sin-conexion',
      tipo: 'ENTRADA',
      resultado: 'ACEPTADA',
      usuarioId: 3,
      estadoHttp: 201,
      motivo: 'Guardada en Ucheck, pendiente de sincronización',
      solicitud: { params: {}, query: {}, body },
      respuesta: { estado: 'PENDIENTE' },
    });
  });

  it('el rechazo queda con su motivo y la web recibe el mismo error', async () => {
    const rechazo = new BadRequestException({
      message: 'Estás fuera del radio permitido',
      codigo: 'FUERA_DE_RADIO',
    });
    await expect(
      lastValueFrom(
        interceptor.intercept(
          contexto({
            ...pedido,
            route: { path: '/api/campo/jornada/visitas/:id/salida' },
            body: { nota: '' },
          }),
          { handle: () => throwError(() => rechazo) },
        ),
      ),
    ).rejects.toBe(rechazo);
    expect(fila()).toMatchObject({
      tipo: 'SALIDA',
      resultado: 'RECHAZADA',
      estadoHttp: 400,
      codigo: 'FUERA_DE_RADIO',
      motivo: 'Estás fuera del radio permitido',
    });
  });

  it('validación fallida y Ucheck caído también quedan', async () => {
    await expect(
      lastValueFrom(
        interceptor.intercept(contexto(), {
          handle: () =>
            throwError(() => new BadRequestException({ message: ['a', 'b'] })),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fila()).toMatchObject({ resultado: 'RECHAZADA', motivo: 'a. b' });
    await expect(
      lastValueFrom(
        interceptor.intercept(contexto(), {
          handle: () =>
            throwError(
              () =>
                new ServiceUnavailableException({
                  message: 'Ucheck respondió 403 a Comercia',
                  codigo: 'UCHECK_SIN_CONEXION',
                }),
            ),
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fila()).toMatchObject({
      resultado: 'ERROR',
      estadoHttp: 503,
      codigo: 'UCHECK_SIN_CONEXION',
    });
  });

  it('está en todos los endpoints de marca de campo', () => {
    for (const metodo of [
      'entrada',
      'entradaRepositor',
      'salida',
      'marcaSinConexion',
      'salidaRepositor',
    ])
      expect(
        Reflect.getMetadata(
          INTERCEPTORS_METADATA,
          (CampoController.prototype as unknown as Record<string, object>)[
            metodo
          ],
        ),
      ).toContain(RegistroMarcacionInterceptor);
  });
});
