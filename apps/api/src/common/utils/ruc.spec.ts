import { calcularDvRucPy, esRucParaguayoValido } from './ruc';

describe('RUC paraguayo', () => {
  it('acepta un RUC cuyo dígito verificador coincide con el calculado', () => {
    for (const base of ['80012345', '1234567', '4895', '999999']) {
      const dv = calcularDvRucPy(base);
      expect(esRucParaguayoValido(`${base}-${dv}`)).toBe(true);
    }
  });

  it('rechaza un dígito verificador incorrecto', () => {
    const base = '80012345';
    const dv = calcularDvRucPy(base);
    const dvMalo = (dv + 1) % 10;
    expect(esRucParaguayoValido(`${base}-${dvMalo}`)).toBe(false);
  });

  it('acepta el RUC sin guion normalizándolo (el último dígito es el DV)', () => {
    // el DV de 1234567 es 9 → "12345679" equivale a "1234567-9"
    expect(esRucParaguayoValido('12345679')).toBe(true);
    expect(esRucParaguayoValido('1234567-9')).toBe(true);
    // el ejemplo del placeholder del formulario debe ser válido
    expect(esRucParaguayoValido('80012345-0')).toBe(true);
    expect(esRucParaguayoValido('800123450')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(esRucParaguayoValido('')).toBe(false);
    expect(esRucParaguayoValido('sin-numeros')).toBe(false);
    expect(esRucParaguayoValido('1234567-0')).toBe(false); // DV incorrecto (es 9)
    expect(esRucParaguayoValido('1234567890')).toBe(false); // base muy larga
    expect(esRucParaguayoValido('12-3')).toBe(false); // base muy corta
  });

  it('el DV siempre está entre 0 y 9', () => {
    for (let i = 0; i < 50; i++) {
      const base = String(1000 + i * 137);
      const dv = calcularDvRucPy(base);
      expect(dv).toBeGreaterThanOrEqual(0);
      expect(dv).toBeLessThanOrEqual(9);
    }
  });
});
