import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HorarioCampoDto } from './campo.dto';

describe('VigenciaCampoDto', () => {
  it('convierte una fecha final vacía en null para un horario sin vencimiento', async () => {
    const dto = plainToInstance(HorarioCampoDto, {
      frecuencia: 'SEMANAL',
      intervalo: 1,
      diasSemana: [1, 2, 3, 4, 5],
      diasMes: [],
      entrada: '08:00',
      salida: '17:00',
      fechaDesde: '2026-09-20',
      fechaHasta: '',
    });

    expect(dto.fechaHasta).toBeNull();
    expect(await validate(dto)).toEqual([]);
  });
});
