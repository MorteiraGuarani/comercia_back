"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { mensajeError } from '@/utils/error';
import { queryFechasCampo } from '@/utils/fechas';
import { valorMarcacion } from '@/utils/marcacion';
import type { DetalleMarcacion } from '@/types/marcacion';
import type { RespuestaPaginada } from '@/types/paginacion';
import type { PeriodoFiltro } from './ui/selector-fecha-filtro';
import ComparacionMarcaciones from '../ComparacionMarcaciones';
import InfoColumna from '../InfoColumna';
import { Modal } from '../modal';
import { Paginacion } from '../paginacion';
import { PantallaCarga } from '../pantalla-carga';

export default function MarcacionesColaborador({ colaboradorId, periodo }: { colaboradorId: number; periodo: PeriodoFiltro }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [revision, setRevision] = useState(0);
  const fechas = queryFechasCampo(periodo);
  const ruta = `/campo/supervision/colaboradores/${colaboradorId}/marcaciones?${fechas ? `${fechas}&` : ''}page=${page}&limit=${limit}`;
  const clave = `${ruta}:${revision}`;
  const [consulta, setConsulta] = useState<{clave: string; datos: RespuestaPaginada<DetalleMarcacion> | null; error: string | null}>({clave: '', datos: null, error: null});
  const [detalle, setDetalle] = useState<DetalleMarcacion | null>(null);
  useEffect(() => {
    const control = new AbortController();
    void apiFetch<RespuestaPaginada<DetalleMarcacion>>(ruta, { signal: control.signal }).then(datos => {
      if (!control.signal.aborted) setConsulta({clave, datos, error: null});
    }).catch(e => { if (!control.signal.aborted) setConsulta({clave, datos: null, error: mensajeError(e, 'No se pudieron consultar las marcaciones')}); });
    return () => control.abort();
  }, [ruta, clave]);
  const cargando = consulta.clave !== clave;
  const datos = !cargando ? consulta.datos : null;
  return <section aria-label="Marcaciones del colaborador" className="min-w-0 space-y-3" aria-busy={cargando}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Marcaciones</h2><span className="text-xs text-muted">Entrada / salida por visita</span></div>
    {!cargando && consulta.error ? <p role="alert" className="text-sm">{consulta.error} <button type="button" className="min-h-11 rounded-lg border border-control-line px-3 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-focus" onClick={() => setRevision(n => n + 1)}>Reintentar</button></p> : null}
    <ul className="space-y-2">{datos?.items.map(m => <li key={m.id} className="min-w-0 rounded-lg border border-line bg-surface-raised p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{m.local?.nombre ?? 'Visita'}</h3><p className="text-xs text-muted">{m.fecha}</p></div>
        <button type="button" className="min-h-11 shrink-0 rounded-lg border border-control-line px-3 text-sm hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-focus" aria-label={`Datos de marcación de ${m.local?.nombre ?? 'la visita'}, ${m.fecha}`} onClick={() => setDetalle(m)}>Ver datos</button></div>
      <div className="mt-2 grid grid-cols-2 gap-2"><div><span className="text-xs text-muted">Entrada<InfoColumna titulo="Entrada" texto="Fecha y hora de entrada aceptadas para esta visita. Ver datos permite comparar la batería, ubicación, conexión y dispositivo de cada marca." /></span><p className="break-words text-xs tabular-nums">{valorMarcacion(m.entrada, {clave: 'registradaEn', etiqueta: 'Entrada', ayuda: '', formato: 'fecha'}, m.zonaHoraria)}</p></div>
        <div><span className="text-xs text-muted">Salida<InfoColumna titulo="Salida" texto="Fecha y hora de salida aceptadas para esta visita. Pendiente indica que no hay salida registrada; No informado indica una señal que no se capturó." /></span><p className="break-words text-xs tabular-nums">{valorMarcacion(m.salida, {clave: 'registradaEn', etiqueta: 'Salida', ayuda: '', formato: 'fecha'}, m.zonaHoraria)}</p></div></div>
    </li>)}</ul>
    {datos && !datos.items.length ? <p className="py-4 text-sm text-muted">Sin marcaciones en el período.</p> : null}
    {datos ? <Paginacion page={datos.page} totalPages={datos.totalPages} total={datos.total} limit={datos.limit} onPageChange={setPage}
      onLimitChange={n => { setLimit(n); setPage(1); }} desplazarAlInicio={false} /> : null}
    <Modal abierto={!!detalle} titulo={`Datos de marcación · ${detalle?.local?.nombre ?? 'Visita'}`} onCerrar={() => setDetalle(null)} ancho="lg">
      {detalle ? <ComparacionMarcaciones detalle={detalle} /> : null}
      <div className="mt-4 flex justify-end"><button type="button" className="min-h-11 rounded-lg border border-control-line px-4 text-sm hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-focus" onClick={() => setDetalle(null)}>Cancelar</button></div>
    </Modal>
    <PantallaCarga visible={cargando} mensaje="Consultando marcaciones…" />
  </section>;
}
