import type {
  ToleranciaHorario,
  ValoresTolerancia,
  ColorHorario,
} from '../interfaces/tolerancia-horario.interface';

export const TOLERANCIA_INICIAL: ToleranciaHorario = {
  anticipoEntrada: 60,
  toleranciaEntrada: 14,
  limiteEntrada: 30,
  toleranciaSalidaAntes: 14,
  toleranciaSalidaDespues: 14,
  limiteSalida: 59,
};
export const CAMPOS_TOLERANCIA = Object.keys(
  TOLERANCIA_INICIAL,
) as (keyof ToleranciaHorario)[];
export function valoresTolerancia(valor: unknown): ValoresTolerancia {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const objeto = valor as Record<string, unknown>;
  const resultado: ValoresTolerancia = {};
  for (const campo of CAMPOS_TOLERANCIA) {
    const v = objeto[campo];
    if (
      v === null ||
      (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1440)
    )
      resultado[campo] = v;
  }
  return resultado;
}
export function combinarTolerancias(...niveles: unknown[]): ToleranciaHorario {
  const resultado = { ...TOLERANCIA_INICIAL };
  for (const nivel of niveles) {
    const valores = valoresTolerancia(nivel);
    for (const campo of CAMPOS_TOLERANCIA)
      if (valores[campo] != null) resultado[campo] = valores[campo];
  }
  return resultado;
}
export function heredarTolerancias(...niveles: unknown[]): ToleranciaHorario {
  const t = combinarTolerancias(...niveles);
  // Un cambio en un padre nunca vuelve rojo un minuto que otro nivel admite en verde.
  return {
    ...t,
    limiteEntrada: Math.max(t.limiteEntrada, t.toleranciaEntrada),
    limiteSalida: Math.max(t.limiteSalida, t.toleranciaSalidaDespues),
  };
}
export function toleranciasCoherentes(t: ToleranciaHorario) {
  return (
    t.limiteEntrada >= t.toleranciaEntrada &&
    t.limiteSalida >= t.toleranciaSalidaDespues
  );
}
function reloj(en: Date, zona: string) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(en);
  const p = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  );
}
function minutoHora(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
function limites(fecha: string, desde: string, hasta: string) {
  const dia = Date.parse(fecha + 'T00:00:00.000Z');
  const inicio = dia + minutoHora(desde) * 60000;
  const fin = dia + minutoHora(hasta) * 60000 + (hasta <= desde ? 86400000 : 0);
  return { inicio, fin };
}
export function evaluarMarcaHorario(
  tipo: 'ENTRADA' | 'SALIDA',
  en: Date,
  fecha: string,
  desde: string,
  hasta: string,
  zona: string,
  t: ToleranciaHorario,
): { color: ColorHorario; desvioMinutos: number } {
  const { inicio, fin } = limites(fecha, desde, hasta);
  const desvioMinutos =
    (reloj(en, zona) - (tipo === 'ENTRADA' ? inicio : fin)) / 60000;
  let color: ColorHorario;
  if (tipo === 'ENTRADA')
    color =
      desvioMinutos < -t.anticipoEntrada
        ? 'ROJO'
        : desvioMinutos <= t.toleranciaEntrada
          ? 'VERDE'
          : desvioMinutos <= t.limiteEntrada
            ? 'AMARILLO'
            : 'ROJO';
  else
    color =
      desvioMinutos < -t.toleranciaSalidaAntes
        ? 'ROJO'
        : desvioMinutos <= t.toleranciaSalidaDespues
          ? 'VERDE'
          : desvioMinutos <= t.limiteSalida
            ? 'AMARILLO'
            : 'ROJO';
  return { color, desvioMinutos };
}
export function minutosDentroHorario(
  entrada: Date,
  salida: Date,
  fecha: string,
  desde: string,
  hasta: string,
  zona: string,
) {
  const { inicio, fin } = limites(fecha, desde, hasta);
  const aInstante = (local: number) => {
    let instante = local;
    for (let i = 0; i < 3; i++)
      instante += local - reloj(new Date(instante), zona);
    return instante;
  };
  return Math.max(
    0,
    Math.floor(
      (Math.min(salida.getTime(), aInstante(fin)) -
        Math.max(entrada.getTime(), aInstante(inicio))) /
        60000,
    ),
  );
}
