import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultaTareasDiaDto } from './consulta-tareas-dia.dto';

// Mismas opciones que el ValidationPipe global de main.ts.
const convertir = (consulta: Record<string, string>) =>
  plainToInstance(ConsultaTareasDiaDto, consulta, {
    enableImplicitConversion: true,
  });

describe('ConsultaTareasDiaDto', () => {
  it('lee la lista de asignaciones separada por comas', async () => {
    const dto = convertir({ asignaciones: '3,8,21', fecha: '2026-10-19' });
    expect(dto.asignaciones).toEqual([3, 8, 21]);
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
  });

  it('rechaza ids inválidos, repetidos o más de 50', async () => {
    for (const asignaciones of [
      '3,abc',
      '3,3',
      '0',
      Array.from({ length: 51 }, (_, i) => i + 1).join(','),
    ]) {
      const errores = await validate(convertir({ asignaciones }));
      expect(errores.map((e) => e.property)).toContain('asignaciones');
    }
  });
});
