import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  HorarioCampoDto,
  TareaCampoDto,
  UbicacionLocalCampoDto,
} from './campo.dto';

function horario(extra: Record<string, unknown> = {}) {
  return plainToInstance(HorarioCampoDto, {
    frecuencia: 'SEMANAL',
    intervalo: 1,
    diasSemana: [1, 2, 3, 4, 5],
    diasMes: [],
    entrada: '08:00',
    salida: '17:00',
    fechaDesde: '2026-09-20',
    ...extra,
  });
}

describe('UbicacionLocalCampoDto', () => {
  it('acepta coordenadas válidas y rechaza las fuera de rango', async () => {
    const valida = { latitud: -25.3, longitud: -57.6 };
    expect(
      await validate(plainToInstance(UbicacionLocalCampoDto, valida)),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(UbicacionLocalCampoDto, { ...valida, latitud: 91 }),
      ),
    ).not.toEqual([]);
  });
});

describe('VigenciaCampoDto', () => {
  it('convierte una fecha final vacía en null para un horario sin vencimiento', async () => {
    const dto = horario({ fechaHasta: '' });
    expect(dto.fechaHasta).toBeNull();
    expect(await validate(dto)).toEqual([]);
  });

  it('acepta fechaHasta en blanco o ISO largo al desactivar una vigencia', async () => {
    const blanco = horario({ fechaHasta: '   ' });
    expect(blanco.fechaHasta).toBeNull();
    expect(await validate(blanco)).toEqual([]);

    const iso = horario({ fechaHasta: '2026-09-21T00:00:00.000Z' });
    expect(iso.fechaHasta).toBe('2026-09-21');
    expect(await validate(iso)).toEqual([]);
  });

  it('acepta una tarea sin fechaHasta al marcarla inactiva', async () => {
    const dto = plainToInstance(TareaCampoDto, {
      nombre: 'Reposición',
      descripcion: '',
      todosLocales: true,
      localIds: [],
      activo: false,
      requiereFotos: false,
      fotosObligatorias: false,
      fechaDesde: '2026-09-01',
      fechaHasta: '',
    });
    expect(dto.fechaHasta).toBeNull();
    expect(await validate(dto)).toEqual([]);
  });
});
