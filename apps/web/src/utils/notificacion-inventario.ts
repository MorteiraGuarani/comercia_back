export function fechaInventarioLegible(fecha: string) {
  return fecha.split("-").reverse().join("/");
}

export function estadoVencimiento(dias: number) {
  if (dias === 0) return "Vence hoy";
  const cantidad = Math.abs(dias);
  const plazo = `${cantidad} ${cantidad === 1 ? "día" : "días"}`;
  return dias < 0 ? `Vencido hace ${plazo}` : `Vence en ${plazo}`;
}
