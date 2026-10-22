"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AlcanceTolerancia, ConfiguracionTolerancia, ValoresTolerancia } from '@/types/tolerancia-horario';
import { PantallaCarga } from '@/components/pantalla-carga';

type Campo = { clave: keyof ValoresTolerancia; etiqueta: string; ayuda: string };
// Dos grupos cortos; la ayuda larga queda en el title de cada campo.
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Entrada', campos: [
    { clave: 'anticipoEntrada', etiqueta: 'Antes del inicio', ayuda: 'Minutos antes del inicio que cuentan en verde' },
    { clave: 'toleranciaEntrada', etiqueta: 'Después del inicio', ayuda: 'Minutos después del inicio que cuentan en verde' },
    { clave: 'limiteEntrada', etiqueta: 'Límite', ayuda: 'Hasta aquí amarillo; después, rojo' },
  ] },
  { titulo: 'Salida', campos: [
    { clave: 'toleranciaSalidaAntes', etiqueta: 'Antes del fin', ayuda: 'Minutos antes del fin que cuentan en verde' },
    { clave: 'toleranciaSalidaDespues', etiqueta: 'Después del fin', ayuda: 'Minutos después del fin que cuentan en verde' },
    { clave: 'limiteSalida', etiqueta: 'Límite', ayuda: 'Hasta aquí amarillo; después, rojo' },
  ] },
];
const boton = 'min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50';

export function ToleranciasHorario({ alcance, id, empresaId, titulo = 'Tolerancias' }: { alcance: AlcanceTolerancia; id: number; empresaId?: number; titulo?: string }) {
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
      setDatos(d); setValores(d.valores); setAviso('Guardado. Se aplica a las próximas entradas.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar las tolerancias'); }
    finally { setCargando(false); }
  }
  const propias = datos ? Object.values(datos.valores).filter(v => v !== null && v !== undefined).length : 0;
  return <details className="min-w-0 rounded-lg border border-line bg-surface-raised text-foreground dark:border-line dark:bg-surface-raised dark:text-foreground" open={abierto} onToggle={e => { const abrir = e.currentTarget.open; setAbierto(abrir); if (abrir) { setCargando(true); setDatos(null); setError(''); setAviso(''); } }}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
      <span>{titulo}</span>
      <span className="text-xs font-normal text-muted">{abierto ? (datos ? (propias ? `${propias} propias` : 'Todas heredadas') : '') : 'Ajustar'} {abierto ? '▴' : '▾'}</span>
    </summary>
    {abierto ? <section aria-label={titulo} aria-busy={cargando} className="space-y-3 border-t border-line p-3">
      <p className="text-xs text-muted">En minutos. Vacío hereda (en gris, el valor heredado); 0 quita la tolerancia.{alcance === 'usuario' ? ' Los del usuario mandan en todas sus franjas.' : ''}</p>
      {cargando && !datos ? <p role="status" className="text-xs text-muted">Cargando…</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error} {!datos ? <button type="button" disabled={cargando} onClick={() => { setCargando(true); setError(''); setRevision(v => v + 1); }} className="underline">Reintentar</button> : null}</p> : null}
      {datos ? <>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {GRUPOS.map(g => <fieldset key={g.titulo} className="min-w-0 space-y-1.5">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{g.titulo}</legend>
            {g.campos.map(c => <label key={c.clave} title={c.ayuda} className="flex min-w-0 items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{c.etiqueta}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                <input type="number" min={0} max={1440} step={1} inputMode="numeric" disabled={cargando} aria-label={`${g.titulo}: ${c.etiqueta} (minutos)`} value={valores[c.clave] ?? ''} placeholder={String(datos.heredados[c.clave])}
                  onChange={e => { setAviso(''); setValores(v => ({ ...v, [c.clave]: e.target.value === '' ? null : Number(e.target.value) })); }}
                  className="min-h-11 w-20 rounded-lg border border-control-line bg-surface px-2 text-right text-sm text-foreground dark:border-control-line dark:bg-surface dark:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50" />
                min
              </span>
            </label>)}
          </fieldset>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={cargando} onClick={() => void guardar()} className={`${boton} bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400`}>Guardar</button>
          <button type="button" disabled={cargando} onClick={() => { setValores({}); setAviso('Todo heredado; guardá para aplicarlo.'); }} className={`${boton} border border-line hover:bg-surface-soft`}>Heredar todo</button>
          <button type="button" disabled={cargando} onClick={() => { setValores(datos.valores); setAviso(''); setError(''); }} className={`${boton} border border-line hover:bg-surface-soft`}>Descartar</button>
        </div>
      </> : null}
      {aviso ? <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{aviso}</p> : null}
    </section> : null}
    <PantallaCarga visible={abierto && cargando} mensaje="Procesando tolerancias" />
  </details>;
}
