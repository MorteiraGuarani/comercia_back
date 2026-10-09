import type { Prisma } from '../../../generated/prisma/client';
import type { DetalleMarcacion } from '../../common/interfaces/detalle-marcacion.interface';
import { contextoTecnico } from '../../common/utils/contexto-tecnico';

export function selectorMarcaciones(empresaId: number, usuarioId: number) {
  return {
    id: true,
    fecha: true,
    entrada: true,
    salida: true,
    entradaLat: true,
    entradaLng: true,
    entradaPrecision: true,
    entradaDistancia: true,
    entradaFueraHorario: true,
    entradaFueraAtencion: true,
    salidaLat: true,
    salidaLng: true,
    salidaPrecision: true,
    salidaDistancia: true,
    salidaFueraHorario: true,
    salidaFueraAtencion: true,
    usuario: { select: { id: true, nombre: true, apellido: true } },
    local: { select: { id: true, nombre: true, zonaHoraria: true } },
    eventosUcheck: {
      where: { empresaId, usuarioId },
      take: 2,
      orderBy: { tipo: 'asc' },
      select: {
        tipo: true,
        registradaEn: true,
        capturadaEn: true,
        recibidaEn: true,
        latitud: true,
        longitud: true,
        precisionMetros: true,
        distanciaMetros: true,
        centroLatitud: true,
        centroLongitud: true,
        radioMetros: true,
        fueraHorario: true,
        fueraAtencion: true,
        ubicacionSimulada: true,
        contextoDispositivo: true,
      },
    },
  } as const satisfies Prisma.VisitaCampoSelect;
}

export function detalleVisita(
  v: Prisma.VisitaCampoGetPayload<{
    select: ReturnType<typeof selectorMarcaciones>;
  }>,
): DetalleMarcacion {
  function marca(tipo: 'ENTRADA' | 'SALIDA', registrada: Date) {
    const e = v.eventosUcheck.find((e) => e.tipo === tipo);
    const entrada = tipo === 'ENTRADA';
    return {
      registradaEn: registrada.toISOString(),
      capturadaEn: e?.capturadaEn.toISOString() ?? null,
      recibidaEn: e?.recibidaEn.toISOString() ?? null,
      latitud: e?.latitud ?? (entrada ? v.entradaLat : v.salidaLat),
      longitud: e?.longitud ?? (entrada ? v.entradaLng : v.salidaLng),
      precisionMetros:
        e?.precisionMetros ??
        (entrada ? v.entradaPrecision : v.salidaPrecision),
      distanciaMetros:
        e?.distanciaMetros ??
        (entrada ? v.entradaDistancia : v.salidaDistancia),
      centroLatitud: e?.centroLatitud ?? null,
      centroLongitud: e?.centroLongitud ?? null,
      radioMetros: e?.radioMetros ?? null,
      fueraHorario:
        e?.fueraHorario ??
        (entrada ? v.entradaFueraHorario : v.salidaFueraHorario),
      fueraAtencion:
        e?.fueraAtencion ??
        (entrada ? v.entradaFueraAtencion : v.salidaFueraAtencion),
      contexto: {
        ...contextoTecnico(e?.contextoDispositivo),
        ...(e ? { ubicacionSimulada: e.ubicacionSimulada } : {}),
      },
    };
  }
  return {
    id: v.id,
    usuario: {
      id: v.usuario.id,
      nombre: `${v.usuario.nombre} ${v.usuario.apellido}`.trim(),
    },
    local: { id: v.local.id, nombre: v.local.nombre },
    fecha: v.fecha.toISOString().slice(0, 10),
    zonaHoraria: v.local.zonaHoraria,
    entrada: marca('ENTRADA', v.entrada),
    salida: v.salida ? marca('SALIDA', v.salida) : null,
  };
}
