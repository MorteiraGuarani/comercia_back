import { BadRequestException } from '@nestjs/common';
import type { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import { UcheckSincronizacionService } from '../ucheck/ucheck-sincronizacion.service';
import type { IntegracionesUcheckService } from './integraciones-ucheck.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { SincronizacionMarcacionesService } from './sincronizacion-marcaciones.service';

const payload = {
  eventoId: 'evento-000001',
  tipo: 'ENTRADA',
  ucheckJornadaId: 7,
  correoUsuario: 'ana@x.com',
  asignacionId: 3,
  localId: 'C001',
  fecha: '2026-10-26',
  registradaEn: '2026-10-26T12:00:00.000Z',
  capturadaEn: '2026-10-26T12:00:00.000Z',
  latitud: -25.3,
  longitud: -57.6,
  precisionMetros: 10,
  distanciaMetros: 5,
  centroLatitud: -25.3,
  centroLongitud: -57.6,
  radioMetros: 100,
  fueraHorario: false,
  fueraAtencion: false,
  ubicacionSimulada: false,
};

describe('Sincronización de marcaciones por GET', () => {
  it('guarda la copia de cada pendiente y le confirma a Ucheck lo guardado y lo fallido', async () => {
    const pedir = jest
      .fn()
      .mockResolvedValueOnce({
        eventos: [
          { id: 'ev-1', payload },
          { id: 'ev-2', payload: { ...payload, eventoId: 'evento-000002' } },
          { id: 'ev-3', payload: { basura: true } },
        ],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ eventos: [] });
    const registrarMarcacion = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, visitaId: 55 })
      .mockRejectedValueOnce(new BadRequestException('Local no disponible'));
    const aviso = new UcheckSincronizacionService();
    const servicio = new SincronizacionMarcacionesService(
      { configurado: () => true, pedir } as unknown as UcheckClienteService,
      aviso,
      { registrarMarcacion } as unknown as IntegracionesUcheckService,
    );
    servicio.onModuleInit();
    servicio.onModuleDestroy();

    // Marcar desde Comercia pide la sincronización por el aviso compartido.
    await aviso.ahora();

    expect(registrarMarcacion).toHaveBeenCalledTimes(2);
    expect(pedir).toHaveBeenNthCalledWith(
      2,
      '/comercia-integracion/marcaciones/confirmaciones',
      {
        method: 'POST',
        body: {
          resultados: [
            { id: 'ev-1', visitaId: 55 },
            { id: 'ev-2', error: 'Local no disponible' },
            {
              id: 'ev-3',
              error: expect.stringContaining(
                'property basura should not exist',
              ) as unknown,
            },
          ],
        },
      },
    );
    expect(pedir).toHaveBeenCalledTimes(3);
  });
});
