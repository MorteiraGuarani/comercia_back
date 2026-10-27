export function formatoDuracionMinutos(minutos: number | null): string {
  if (minutos === null) return "En curso";
  if (minutos < 1) return "Menos de 1 min";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

export function formatoDuracionSegundos(segundos: number): string {
  return formatoDuracionMinutos(segundos / 60);
}

/** Minutos entre dos horas "HH:MM" del mismo día; null si falta alguna o el fin es anterior. */
export function minutosEntreHoras(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const diferencia = minutos(hasta) - minutos(desde);
  return Number.isFinite(diferencia) && diferencia >= 0 ? diferencia : null;
}
