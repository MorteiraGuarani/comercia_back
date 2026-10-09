import type { ValorSenal } from '../interfaces/detalle-marcacion.interface';

export const BOOLEANOS_CONTEXTO = [
  'modoAhorroBateria',
  'serviciosUbicacionActivos',
  'ubicacionSimulada',
  'horaAutomatica',
  'precisionSospechosa',
  'relojDesfasado',
  'sincronizadaSinConexion',
  'redConectada',
  'internetAlcanzable',
  'modoAvion',
  'esDispositivoFisico',
] as const;
export const TEXTOS_CONTEXTO = [
  'bateriaEstado',
  'redTipo',
  'fabricanteDispositivo',
  'marcaDispositivo',
  'modeloDispositivo',
  'tipoDispositivo',
  'sistemaOperativo',
  'versionSistemaOperativo',
  'versionAplicacion',
  'buildAplicacion',
] as const;
export const NUMEROS_CONTEXTO = [
  'bateriaNivelPorcentaje',
  'desfaseRelojMs',
] as const;

// El JSON de integraciones nunca se entrega crudo. Solo señales conocidas,
// de su tipo correcto; no IDs internos, correos, credenciales o claves futuras.
export function contextoTecnico(valor: unknown): Record<string, ValorSenal> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const fuente = valor as Record<string, unknown>;
  const resultado: Record<string, ValorSenal> = {};
  for (const campo of BOOLEANOS_CONTEXTO)
    if (typeof fuente[campo] === 'boolean') resultado[campo] = fuente[campo];
  for (const campo of TEXTOS_CONTEXTO)
    if (typeof fuente[campo] === 'string' && fuente[campo].trim())
      resultado[campo] = fuente[campo].trim().slice(0, 200);
  for (const campo of NUMEROS_CONTEXTO) {
    const n = fuente[campo];
    if (
      typeof n === 'number' &&
      Number.isFinite(n) &&
      (campo !== 'bateriaNivelPorcentaje' || (n >= 0 && n <= 100))
    )
      resultado[campo] = n;
  }
  return resultado;
}
