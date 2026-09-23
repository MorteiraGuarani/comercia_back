import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntradaCampoDto, MarcaCampoDto } from '../dto/campo.dto';
import { comprobarMarcaEnLocal } from './marcacion';

const ahora = new Date('2026-09-23T15:00:00.000Z');
const local = { latitud: -25.3, longitud: -57.6, radioMetros: 100 };
const marca = {
  latitud: local.latitud,
  longitud: local.longitud,
  precisionMetros: 20,
  capturadaEn: ahora.toISOString(),
  nota: '',
};

describe('GPS de las marcaciones de campo', () => {
  it('acepta una posición dentro del radio y rechaza una fuera', () => {
    expect(comprobarMarcaEnLocal(marca, local, ahora)).toBe(0);
    expect(() =>
      comprobarMarcaEnLocal(
        { ...marca, latitud: local.latitud + 0.00089 },
        local,
        ahora,
      ),
    ).not.toThrow();
    expect(() =>
      comprobarMarcaEnLocal(
        { ...marca, latitud: local.latitud + 0.0009 },
        local,
        ahora,
      ),
    ).toThrow('fuera del radio permitido de 100 m');
  });

  it.each([
    { precisionMetros: 51 },
    { precisionMetros: -1 },
    { capturadaEn: '2026-09-23T14:58:00.000Z' },
    { capturadaEn: '2026-09-23T15:01:00.000Z' },
  ])('rechaza precisión u hora inválida: %j', (cambio) => {
    expect(() =>
      comprobarMarcaEnLocal({ ...marca, ...cambio }, local, ahora),
    ).toThrow();
  });

  it('exige GPS completo en entrada y salida', async () => {
    expect(
      await validate(plainToInstance(MarcaCampoDto, { nota: 'sin GPS' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(EntradaCampoDto, {
          asignacionId: 1,
          ...marca,
        }),
      ),
    ).toHaveLength(0);
  });
});
