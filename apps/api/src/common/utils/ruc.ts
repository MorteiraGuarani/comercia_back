// Validación del RUC paraguayo con su dígito verificador (módulo 11, algoritmo
// de la SET). Mantener sincronizado con apps/web/src/lib/ruc.ts.

export function calcularDvRucPy(base: string): number {
  let k = 2;
  let total = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    total += Number(base[i]) * k;
    k = k === 11 ? 2 : k + 1;
  }
  const resto = total % 11;
  return resto > 1 ? 11 - resto : 0;
}

// Acepta el RUC con o sin guion ("1234567-9" o "12345679"): si vienen solo
// dígitos, el último es el verificador y se normaliza insertando el guion.
export function normalizarRucPy(ruc: string): string {
  const limpio = ruc.trim();
  if (/^\d{4,9}$/.test(limpio)) {
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
  }
  return limpio;
}

// Formato aceptado: base de 3 a 8 dígitos, guion, dígito verificador. Ej: 80012345-0
export function esRucParaguayoValido(ruc: string): boolean {
  const match = /^(\d{3,8})-(\d)$/.exec(normalizarRucPy(ruc));
  if (!match) {
    return false;
  }
  return calcularDvRucPy(match[1]) === Number(match[2]);
}
