import { useId, useState } from 'react';
import type { DetalleMarcacion } from '../types/marcacion';
import { GRUPOS_MARCACION, valorMarcacion } from '../utils/marcacion';
import './marcaciones.css';

export default function ComparacionMarcaciones({ detalle }: { detalle: DetalleMarcacion }) {
  const [ayuda, setAyuda] = useState<string | null>(null);
  const prefijo = useId();
  return <div className="senales-marcacion">
    <p className="senales-nota"><strong>{detalle.local?.nombre ?? 'Jornada general'}</strong> · {detalle.fecha}</p>
    <p className="senales-nota">Datos capturados al marcar · {detalle.zonaHoraria}</p>
    {!detalle.salida ? <p role="status" className="senales-nota">Salida pendiente.</p> : null}
    <div className="senales-columnas" aria-hidden="true"><span>Campo</span><b>Entrada</b><b>Salida</b></div>
    {GRUPOS_MARCACION.map(grupo => <section key={grupo.titulo} aria-label={grupo.titulo}><h3>{grupo.titulo}</h3><dl>
      {grupo.campos.map(campo => <div className="senales-fila" key={campo.clave}>
        <dt><span>{campo.etiqueta}</span><button type="button" className="senales-info" title={campo.ayuda}
          aria-label={`Información sobre ${campo.etiqueta}`} aria-expanded={ayuda === campo.clave}
          aria-controls={`${prefijo}-${campo.clave}`} onClick={() => setAyuda(ayuda === campo.clave ? null : campo.clave)}><span aria-hidden="true">i</span></button></dt>
        <dd><span className="sr-only">Entrada: </span>{valorMarcacion(detalle.entrada, campo, detalle.zonaHoraria)}</dd>
        <dd><span className="sr-only">Salida: </span>{valorMarcacion(detalle.salida, campo, detalle.zonaHoraria)}</dd>
        <dd id={`${prefijo}-${campo.clave}`} className="senales-ayuda" hidden={ayuda !== campo.clave}>{campo.ayuda}</dd>
      </div>)}
    </dl></section>)}
  </div>;
}
