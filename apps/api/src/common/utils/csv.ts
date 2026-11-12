type Celda = string | number | null | undefined;

const celda = (valor: Celda) => {
  let texto = valor == null ? '' : String(valor);
  // Excel ejecuta como fórmula lo que empieza con = + - @: se anula con un apóstrofo.
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/**
 * CSV que Excel abre directo en español: separador «;», saltos CRLF y BOM para
 * que respete los acentos.
 */
export function aCsv(encabezados: string[], filas: Celda[][]): string {
  return (
    '﻿' +
    [encabezados, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') +
    '\r\n'
  );
}
