import { diasParaVencer } from '../../common/utils/vencimiento';
import { textoAvisoVencimiento } from './vencimiento';

describe('vencimiento', () => {
  it('cuenta días enteros entre hoy y el vencimiento, negativos si ya venció', () => {
    expect(diasParaVencer('2026-10-27', '2026-10-22')).toBe(5);
    expect(diasParaVencer(new Date('2026-10-22T00:00:00Z'), '2026-10-22')).toBe(
      0,
    );
    expect(diasParaVencer('2026-10-20', '2026-10-22')).toBe(-2);
  });

  it('arma el aviso según los días que faltan', () => {
    const venc = new Date('2026-10-27T00:00:00Z');
    expect(
      textoAvisoVencimiento('Nuggets', 'Día Martínez', venc, 12, '2026-10-22'),
    ).toEqual({
      titulo: 'Vence en 5 días: Nuggets',
      mensaje:
        'Nuggets en Día Martínez vence el 27/10/2026. Cantidad cargada: 12.',
    });
    expect(
      textoAvisoVencimiento('Nuggets', 'X', venc, 1, '2026-10-28').titulo,
    ).toBe('Vencido: Nuggets');
    expect(
      textoAvisoVencimiento('x'.repeat(300), 'X', venc, 1, '2026-10-22').titulo,
    ).toHaveLength(100);
  });
});
