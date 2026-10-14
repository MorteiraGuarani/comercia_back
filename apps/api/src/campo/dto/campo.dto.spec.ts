import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HorarioCampoDto, LocalCampoDto, TareaCampoDto } from './campo.dto';
import { EliminarClienteCampoDto } from './eliminar-cliente.dto';

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

describe('Cliente opcional y confirmacion de borrado', () => {
  it('acepta un local sin cliente y rechaza asociarlo a varios clientes', async () => {
    const datos = { nombre: 'Sucursal', latitud: -25.3, longitud: -57.6 };
    expect(await validate(plainToInstance(LocalCampoDto, datos))).toEqual([]);
    expect(
      await validate(
        plainToInstance(LocalCampoDto, { ...datos, clienteId: null }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(LocalCampoDto, { ...datos, clienteId: 4 }),
      ),
    ).toEqual([]);
    const errores = await validate(
      plainToInstance(LocalCampoDto, { ...datos, clienteId: [4, 5] }),
    );
    expect(errores.some((error) => error.property === 'clienteId')).toBe(true);
  });

  it('exige un booleano explicito para borrar los locales del cliente', async () => {
    expect(plainToInstance(EliminarClienteCampoDto, {}).eliminarLocales).toBe(
      false,
    );
    expect(
      await validate(
        plainToInstance(EliminarClienteCampoDto, { eliminarLocales: true }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(EliminarClienteCampoDto, { eliminarLocales: 'false' }),
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
