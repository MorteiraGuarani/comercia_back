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

