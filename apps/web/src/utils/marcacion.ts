import type { CampoMarcacion, DatosMarcacion } from '../types/marcacion';

export const GRUPOS_MARCACION: { titulo: string; campos: CampoMarcacion[] }[] = [
  { titulo: 'Registro y ubicación', campos: [
    { clave: 'registradaEn', etiqueta: 'Hora registrada', formato: 'fecha', ayuda: 'Fecha y hora aceptadas para la marcación, en la zona horaria indicada.' },
    { clave: 'capturadaEn', etiqueta: 'Hora del teléfono', formato: 'fecha', ayuda: 'Hora declarada por el teléfono al capturar la marca. Puede diferir de la hora aceptada o de la recepción.' },
    { clave: 'recibidaEn', etiqueta: 'Datos recibidos', formato: 'fecha', ayuda: 'Momento en que el servidor guardó los datos técnicos. No representa necesariamente el momento de marcar.' },
    { clave: 'serviciosUbicacionActivos', etiqueta: 'GPS / ubicación', ayuda: 'Indica si los servicios de ubicación del teléfono estaban habilitados al marcar. No garantiza por sí solo una posición precisa.' },
    { clave: 'latitud', etiqueta: 'Latitud', formato: 'coordenada', ayuda: 'Coordenada norte/sur informada por el teléfono al marcar, en grados.' },
    { clave: 'longitud', etiqueta: 'Longitud', formato: 'coordenada', ayuda: 'Coordenada este/oeste informada por el teléfono al marcar, en grados.' },
    { clave: 'precisionMetros', etiqueta: 'Precisión', formato: 'metros', ayuda: 'Margen de error estimado de la ubicación, en metros. Un valor menor indica mayor precisión estimada.' },
    { clave: 'distanciaMetros', etiqueta: 'Distancia al local', formato: 'metros', ayuda: 'Distancia calculada entre la posición de la marca y el centro del local usado en la validación.' },
    { clave: 'centroLatitud', etiqueta: 'Centro · latitud', formato: 'coordenada', ayuda: 'Latitud del centro del local conservada para comprobar esta visita; no es la ubicación del usuario.' },
    { clave: 'centroLongitud', etiqueta: 'Centro · longitud', formato: 'coordenada', ayuda: 'Longitud del centro del local conservada para comprobar esta visita; no es la ubicación del usuario.' },
    { clave: 'radioMetros', etiqueta: 'Radio permitido', formato: 'metros', ayuda: 'Radio alrededor del centro del local utilizado para validar la marcación.' },
    { clave: 'ubicacionSimulada', etiqueta: 'Ubicación simulada', ayuda: 'Señal reportada por el dispositivo sobre una ubicación simulada. No es una conclusión automática de fraude.' },
    { clave: 'precisionSospechosa', etiqueta: 'Precisión atípica', ayuda: 'Señal técnica de una precisión inferior a un metro. Requiere contexto; no confirma una irregularidad.' },
    { clave: 'fueraHorario', etiqueta: 'Fuera de turno', ayuda: 'Indica si esta entrada o salida quedó fuera del horario previsto para la visita.' },
    { clave: 'fueraAtencion', etiqueta: 'Fuera de atención', ayuda: 'Indica si la marca quedó fuera del horario de atención del local utilizado en la validación.' },
  ] },
  { titulo: 'Batería y conexión', campos: [
    { clave: 'bateriaNivelPorcentaje', etiqueta: 'Batería', formato: 'porcentaje', ayuda: 'Porcentaje de batería disponible al marcar. Un dato ausente no significa batería descargada.' },
    { clave: 'bateriaEstado', etiqueta: 'Estado de batería', ayuda: 'Estado de carga informado por el teléfono: cargando, descargando, carga completa u otro estado.' },
    { clave: 'modoAhorroBateria', etiqueta: 'Ahorro de batería', ayuda: 'Indica si el modo de ahorro estaba activo. Puede limitar la ubicación y las tareas de la app en segundo plano.' },
    { clave: 'redTipo', etiqueta: 'Tipo de red', ayuda: 'Conexión informada al marcar, por ejemplo Wi-Fi, celular o sin red.' },
    { clave: 'redConectada', etiqueta: 'Red conectada', ayuda: 'Indica conexión a una red. Estar conectado no garantiza acceso a Internet.' },
    { clave: 'internetAlcanzable', etiqueta: 'Internet accesible', ayuda: 'Resultado de la comprobación de acceso a Internet en el teléfono al marcar.' },
    { clave: 'modoAvion', etiqueta: 'Modo avión', ayuda: 'Indica si el modo avión del teléfono estaba activo, cuando el sistema permitió consultarlo.' },
    { clave: 'sincronizadaSinConexion', etiqueta: 'Sincronizada después', ayuda: 'Indica que se aceptó una marca capturada sin conexión y enviada posteriormente. No se deduce solo del tipo de red.' },
  ] },
  { titulo: 'Reloj', campos: [
    { clave: 'horaAutomatica', etiqueta: 'Hora automática', ayuda: 'Indica si el teléfono obtenía la fecha y hora automáticamente del sistema o de la red.' },
    { clave: 'desfaseRelojMs', etiqueta: 'Desfase del reloj', formato: 'ms', ayuda: 'Diferencia de reloj medida durante la validación, expresada en milisegundos.' },
    { clave: 'relojDesfasado', etiqueta: 'Reloj desfasado', ayuda: 'Indica si el desfase superó el umbral de validación. No equivale a una llegada tarde.' },
  ] },
  { titulo: 'Dispositivo y aplicación', campos: [
    { clave: 'esDispositivoFisico', etiqueta: 'Dispositivo físico', ayuda: 'Indica si la app reportó un equipo físico. No informado significa que no se pudo obtener esa señal.' },
    { clave: 'fabricanteDispositivo', etiqueta: 'Fabricante', ayuda: 'Fabricante del dispositivo informado por el sistema operativo.' },
    { clave: 'marcaDispositivo', etiqueta: 'Marca', ayuda: 'Marca comercial del equipo informado por el sistema operativo.' },
    { clave: 'modeloDispositivo', etiqueta: 'Modelo', ayuda: 'Modelo del equipo con el que se registró esta marca.' },
    { clave: 'tipoDispositivo', etiqueta: 'Tipo de equipo', ayuda: 'Clasificación del equipo: teléfono, tablet, escritorio u otro.' },
    { clave: 'sistemaOperativo', etiqueta: 'Sistema operativo', ayuda: 'Sistema operativo del equipo utilizado al marcar.' },
    { clave: 'versionSistemaOperativo', etiqueta: 'Versión del sistema', ayuda: 'Versión del sistema operativo registrada con esta marca.' },
    { clave: 'versionAplicacion', etiqueta: 'Versión de la app', ayuda: 'Versión de la aplicación instalada al registrar la entrada o salida.' },
    { clave: 'buildAplicacion', etiqueta: 'Compilación', ayuda: 'Número de compilación de la app. Permite distinguir versiones que comparten el mismo nombre.' },
  ] },
];
const ETIQUETAS: Record<string, string> = {
  DESCONOCIDO: 'Desconocido', DESCONOCIDA: 'Desconocida', DESCARGANDO: 'Descargando',
  CARGANDO: 'Cargando', CARGA_COMPLETA: 'Carga completa', CONECTADO_SIN_CARGAR: 'Conectado sin cargar',
  SIN_RED: 'Sin red', CELULAR: 'Celular', WIFI: 'Wi-Fi', BLUETOOTH: 'Bluetooth', ETHERNET: 'Ethernet',
  OTRA: 'Otra', TELEFONO: 'Teléfono', TABLET: 'Tablet', ESCRITORIO: 'Escritorio',
};
export function valorMarcacion(datos: DatosMarcacion | null, campo: CampoMarcacion, zona: string): string {
  if (!datos) return 'Pendiente';
  const valor = Object.hasOwn(datos, campo.clave)
    ? datos[campo.clave as keyof DatosMarcacion] : datos.contexto[campo.clave];
  if (valor == null || valor === '') return 'No informado';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (campo.formato === 'fecha' && typeof valor === 'string') {
    const fecha = new Date(valor);
    if (!Number.isFinite(fecha.getTime())) return 'No informado';
    try { return new Intl.DateTimeFormat('es-PY', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(fecha); }
    catch { return fecha.toISOString(); }
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return 'No informado';
    const n = new Intl.NumberFormat('es-PY', { maximumFractionDigits: campo.formato === 'coordenada' ? 6 : 1 }).format(valor);
    return campo.formato === 'porcentaje' ? `${n} %` : campo.formato === 'metros' ? `${n} m` : campo.formato === 'ms' ? `${n} ms` : n;
  }
  return typeof valor === 'string' ? (ETIQUETAS[valor] ?? valor) : 'No informado';
}
