// Validación del RUC paraguayo con dígito verificador (módulo 11, algoritmo de
// la SET). Mantener sincronizado con apps/api/src/common/utils/ruc.ts.

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

// Acepta con o sin guion: "12345679" se normaliza a "1234567-9"
export function normalizarRucPy(ruc: string): string {
  const limpio = ruc.trim();
  if (/^\d{4,9}$/.test(limpio)) {
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
  }
  return limpio;
}

export function esRucParaguayoValido(ruc: string): boolean {
  const match = /^(\d{3,8})-(\d)$/.exec(normalizarRucPy(ruc));
  if (!match) {
    return false;
  }
  return calcularDvRucPy(match[1]) === Number(match[2]);
}

// Pista en vivo para el formulario: qué le pasa al RUC que se está escribiendo
export function pistaRucPy(ruc: string): {
  estado: "vacio" | "incompleto" | "valido" | "dv-incorrecto" | "formato";
  mensaje: string;
} {
  const limpio = ruc.trim();
  if (!limpio) {
    return { estado: "vacio", mensaje: "" };
  }
  const normalizado = normalizarRucPy(limpio);
  const match = /^(\d{3,8})-(\d)$/.exec(normalizado);
  if (match) {
    const dvCorrecto = calcularDvRucPy(match[1]);
    if (dvCorrecto === Number(match[2])) {
      return { estado: "valido", mensaje: "✓ RUC válido" };
    }
    return {
      estado: "dv-incorrecto",
      mensaje: `El dígito verificador de ${match[1]} es ${dvCorrecto}, no ${match[2]}`,
    };
  }
  if (/^\d{1,3}$/.test(limpio)) {
    return { estado: "incompleto", mensaje: "" };
  }
  return {
    estado: "formato",
    mensaje: "Formato: 1234567-9 (número y dígito verificador; el guion es opcional)",
  };
}
