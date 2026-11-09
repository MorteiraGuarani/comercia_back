import type { ConfigService } from '@nestjs/config';
import type { PedidoSap } from './interfaces/pedido-sap.interface';
import { ServiceLayerService } from './service-layer.service';

const respuesta = (status: number, cuerpo: unknown) =>
  ({
    ok: status < 400,
    status,
    text: () => Promise.resolve(JSON.stringify(cuerpo)),
  }) as unknown as Response;

const credenciales = {
  esquema: 'FG_DESARROLLO',
  usuario: 'comercia',
  contrasenia: 'clave',
};
const orden = { CardCode: 'C1' } as PedidoSap;

describe('ServiceLayerService', () => {
  const servicio = new ServiceLayerService({
    get: () => 'http://sap.test/',
  } as unknown as ConfigService);
  afterEach(() => jest.restoreAllMocks());

  function llamadas(mock: jest.SpyInstance) {
    return (mock.mock.calls as [string, RequestInit][]).map(([url, init]) => ({
      url,
      sesion: (init.headers as Record<string, string>).sessionid,
      cuerpo: init.body ? (JSON.parse(init.body as string) as unknown) : null,
    }));
  }

  it('entra con los datos de la empresa, crea la orden y cierra la sesión', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuesta(200, { sessionId: 'S1' }))
      .mockResolvedValueOnce(respuesta(201, { DocEntry: 9, DocNum: 700 }))
      .mockResolvedValueOnce(respuesta(200, {}));
    await expect(servicio.crearOrden(credenciales, orden)).resolves.toEqual({
      DocEntry: 9,
      DocNum: 700,
    });
    expect(llamadas(fetchMock)).toEqual([
      {
        url: 'http://sap.test/auth/login',
        sesion: undefined,
        cuerpo: {
          CompanyDB: 'FG_DESARROLLO',
          UserName: 'comercia',
          Password: 'clave',
        },
      },
      {
        url: 'http://sap.test/document/create',
        sesion: 'S1',
        cuerpo: {
          document: 'Orders',
          schema: 'PL_SERVICES',
          layout: 'layout_orden',
          data: orden,
        },
      },
      { url: 'http://sap.test/auth/logout', sesion: 'S1', cuerpo: null },
    ]);
  });

  it('devuelve el motivo de SAP y cierra la sesión igual', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuesta(200, { sessionId: 'S1' }))
      .mockResolvedValueOnce(
        respuesta(400, { message: 'Invalid item', statusCode: 400 }),
      )
      .mockResolvedValueOnce(respuesta(200, {}));
    await expect(servicio.crearOrden(credenciales, orden)).rejects.toThrow(
      'SAP: Invalid item',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('sin login no intenta crear la orden', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuesta(401, { message: 'Login failed' }));
    await expect(servicio.crearOrden(credenciales, orden)).rejects.toThrow(
      'SAP: Login failed',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
