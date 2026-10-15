"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AlcanceTolerancia, ConfiguracionTolerancia, ValoresTolerancia } from '@/types/tolerancia-horario';
import { PantallaCarga } from '@/components/pantalla-carga';
const CAMPOS: { clave: keyof ValoresTolerancia; etiqueta: string; ayuda: string }[] = [{"clave":"anticipoEntrada","etiqueta":"Anticipo de entrada","ayuda":"Antes del inicio, en verde"},{"clave":"toleranciaEntrada","etiqueta":"Tolerancia de entrada","ayuda":"Después del inicio, en verde"},{"clave":"limiteEntrada","etiqueta":"Límite de entrada","ayuda":"Hasta aquí, amarillo; luego rojo"},{"clave":"toleranciaSalidaAntes","etiqueta":"Salida anticipada","ayuda":"Antes del fin, en verde"},{"clave":"toleranciaSalidaDespues","etiqueta":"Salida posterior","ayuda":"Después del fin, en verde"},{"clave":"limiteSalida","etiqueta":"Límite de salida","ayuda":"Hasta aquí, amarillo; luego rojo"}];
export function ToleranciasHorario({ alcance, id, empresaId, titulo = 'Tolerancias del horario' }: { alcance: AlcanceTolerancia; id: number; empresaId?: number; titulo?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<ConfiguracionTolerancia | null>(null);
  const [valores, setValores] = useState<ConfiguracionTolerancia['valores']>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [revision, setRevision] = useState(0);
  const ruta = '/campo/tolerancias/' + alcance + '/' + id + (empresaId ? '?empresaId=' + empresaId : '');
  useEffect(() => {
    if (!abierto) return;
    const control = new AbortController();
    apiFetch<ConfiguracionTolerancia>(ruta, { signal: control.signal }).then(d => { if (!control.signal.aborted) { setDatos(d); setValores(d.valores); } }).catch(e => { if (!control.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración'); }).finally(() => { if (!control.signal.aborted) setCargando(false); });
    return () => control.abort();
  }, [abierto, ruta, revision]);
  async function guardar() {
    setCargando(true); setError(''); setAviso('');
    try {
      const d = await apiFetch<ConfiguracionTolerancia>(ruta, { method: 'PUT', body: JSON.stringify(valores) });
      setDatos(d); setValores(d.valores); setAviso('Tolerancias guardadas. Se aplican a nuevas entradas.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar las tolerancias'); }
    finally { setCargando(false); }
  }
  return <details className="my-3 min-w-0 rounded border border-line bg-surface-raised p-3 text-foreground dark:border-line dark:bg-surface-raised dark:text-foreground" open={abierto} onToggle={e => { const abrir = e.currentTarget.open; setAbierto(abrir); if (abrir) { setCargando(true); setDatos(null); setError(''); setAviso(''); } }}>
    <summary className="cursor-pointer rounded py-2 text-sm font-semibold hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus">{titulo}</summary>
    {abierto ? <section aria-label={titulo} aria-busy={cargando}>
      <p className="my-2 text-xs text-muted dark:text-muted">Minutos. Un campo vacío hereda; 0 elimina esa tolerancia. Prioridad: usuario, horario, empresa y global.</p>
      {alcance === 'usuario' ? <p className="my-2 text-xs text-muted dark:text-muted">Los valores propios del usuario prevalecen en todos sus horarios. El valor heredado mostrado es el de su empresa; cada horario puede aportar otros valores.</p> : null}
      {cargando ? <p role="status">Consultando o guardando tolerancias…</p> : null}
      {error ? <p role="alert">{error} {!datos ? <button type="button" disabled={cargando} onClick={() => { setCargando(true); setError(''); setRevision(v => v + 1); }}>Reintentar</button> : null}</p> : null}
      {datos ? <>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {CAMPOS.map(c => <label key={c.clave} className="flex min-w-0 flex-col gap-1 text-sm">
            {c.etiqueta} (min)
            <input type="number" min={0} max={1440} step={1} disabled={cargando} value={valores[c.clave] ?? ''} placeholder={'Heredado: ' + datos.heredados[c.clave]}
              onChange={e => { setAviso(''); setValores(v => ({ ...v, [c.clave]: e.target.value === '' ? null : Number(e.target.value) })); }}
              className="min-h-11 w-full rounded border border-control-line bg-surface px-3 text-foreground dark:border-control-line dark:bg-surface dark:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50" />
            <small className="text-xs text-muted dark:text-muted">{c.ayuda}. Heredado: {datos.heredados[c.clave]} min.</small>
          </label>)}
        </div>
        <p className="my-3 text-xs text-muted dark:text-muted">Se conserva la hora real. El tiempo anterior al inicio y posterior al fin se informa aparte y no aumenta la jornada computable. Las visitas ya iniciadas conservan su configuración.</p>
        <div className="my-3 flex flex-wrap gap-2">
          <button type="button" disabled={cargando} onClick={() => void guardar()} className="min-h-11 cursor-pointer rounded bg-brand-600 px-3 text-sm font-semibold text-white dark:bg-brand-600 dark:text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50">Guardar tolerancias</button>
          <button type="button" disabled={cargando} onClick={() => { setValores({}); setAviso('Herencia preparada; guardá para aplicarla.'); }} className="min-h-11 cursor-pointer rounded border border-line px-3 text-sm hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50">Heredar todos</button>
          <button type="button" disabled={cargando} onClick={() => { setValores(datos.valores); setAviso(''); setError(''); }} className="min-h-11 cursor-pointer rounded border border-line px-3 text-sm hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50">Descartar cambios</button>
        </div>
      </> : null}
      {aviso ? <p role="status">{aviso}</p> : null}
    </section> : null}
    <PantallaCarga visible={abierto && cargando} mensaje="Procesando tolerancias del horario" />
  </details>;
}
