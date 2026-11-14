import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CargaInventarioDto } from './inventario-local.dto';

const errores = (cantidad: unknown) =>
  validateSync(
    plainToInstance(CargaInventarioDto, {
      itemcode: 'LAC-1001',
      cantidad,
      vencimiento: '2026-12-01',
    }),
  ).length;

describe('CargaInventarioDto.cantidad', () => {
  it('acepta enteros y hasta dos decimales', () => {
    for (const ok of [0, 5, 2.5, 0.25, '1.75', 1_000_000])
      expect(errores(ok)).toBe(0);
  });

  it('rechaza negativos, más de dos decimales y valores fuera de rango', () => {
    for (const mal of [-1, 0.125, 1_000_000.01, 'abc'])
      expect(errores(mal)).toBeGreaterThan(0);
  });
});
