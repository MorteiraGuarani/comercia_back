"use client";

import { useState } from "react";
import { Paginacion } from "@/components/paginacion";
import type { ColaboradorResumenItem, SupervisionResumenData } from "@/types/campo";
import styles from "./presentismo.module.css";
import InfoColumna from '../InfoColumna';
import { PRESENTISMO } from "@/utils/estado-jornada";
import type { EstadoPresentismo } from "@/types/estado-jornada";

const ESTADOS = Object.keys(PRESENTISMO) as EstadoPresentismo[];

export function ResumenPresentismo({ resumen, onPendientes }: {
  resumen: SupervisionResumenData;
  onPendientes: () => void;
}) {
  const { presentismo: p } = resumen;
  const marcaciones = resumen.colaboradores.filter(c => c.inicioJornada !== null).length;
  const sinEntrada = p.totalEquipo - marcaciones;
  const porcentaje = p.totalEquipo ? Math.round(marcaciones / p.totalEquipo * 100) : null;
  return <aside className={styles.balance} aria-label="Balance del equipo">
    <section className={styles.summary}>
      <div className={styles.sectionHead}><h2>Tu equipo</h2><span>{p.totalEquipo} personas</span></div>
      <div className={styles.headline}><strong>{porcentaje === null ? "—" : porcentaje}<small>{porcentaje !== null ? "%" : ""}</small></strong>
        <div><b>Con marcación</b><span>{marcaciones} de {p.totalEquipo} en el período</span></div></div>
      <div className={styles.counts}>
        {ESTADOS.map(e => <div key={e} data-tone={e}><b>{p.estados[e]}</b><span>{PRESENTISMO[e].etiqueta}</span></div>)}
      </div>
      <div className={styles.distribution} role="img" aria-label={ESTADOS.map(e => `${p.estados[e]} ${PRESENTISMO[e].etiqueta}`).join(", ")}>
        {ESTADOS.filter(e => p.estados[e] > 0).map(e => <i key={e} data-tone={e} style={{ flexGrow: p.estados[e] }} />)}
      </div>
      {sinEntrada > 0 ? <button type="button" className={styles.notice} onClick={onPendientes}>
        <span><b>{sinEntrada} sin entrada registrada</b><small>Revisá a quién contactar</small></span><span aria-hidden="true">→</span>
      </button> : <p className={styles.calm}>{p.totalEquipo ? "Todo el equipo tiene una marcación." : "Sin equipo asignado en este período."}</p>}
    </section>
    <p className={styles.helper}>Al vencer el turno: sin marcas es Ausente; una entrada sin salida es Incompleto. Sin horario no se deduce ausencia ni tardanza. En períodos de varios días se priorizan las incidencias.</p>
  </aside>;
}

export function AvancePresentismo({ resumen }: { resumen: SupervisionResumenData }) {
  const { rutas, tareas, liderazgo } = resumen;
  return <aside className={styles.secondary} aria-label="Avance operativo y liderazgo">
    <section className={styles.progressSection} aria-label="Avance operativo">
      <h2>Avance del período</h2>
      <div className={styles.progressItem}><div><span>Visitas a locales</span><b>{rutas.completadas}/{rutas.total}</b></div>
        <progress value={rutas.completadas} max={rutas.total || 1} aria-label="Visitas completadas" />
        <small>{rutas.enCurso} en curso · {rutas.incompletas} incompletas · {rutas.ausentes} ausentes · {rutas.pendientes} pendientes</small></div>
      <div className={styles.progressItem}><div><span>Tareas completadas</span><b>{tareas.completadas}/{tareas.total}</b></div>
        <progress value={tareas.completadas} max={tareas.total || 1} aria-label="Tareas completadas" />
        <small>{tareas.obligatoriasPendientes} obligatorias pendientes</small></div>
    </section>
    {liderazgo?.totalTeamLeaders > 0 && <section className={styles.progressSection} aria-label="Seguimiento de TeamLeaders">
      <div className={styles.sectionHead}><h2>TeamLeaders</h2><span>{liderazgo.totalTeamLeaders} a cargo</span></div>
      <p className={styles.helper}>{liderazgo.enRuta} en ruta · {liderazgo.finalizados} finalizaron · {liderazgo.incompletos} incompletos · {liderazgo.ausentes} ausentes · {liderazgo.sinIniciar} sin iniciar</p>
      <div className={styles.progressItem}><div><span>Visitas de supervisión</span><b>{liderazgo.visitasCompletadas}/{liderazgo.visitasTotales}</b></div>
        <progress value={liderazgo.visitasCompletadas} max={liderazgo.visitasTotales || 1} aria-label="Visitas de supervisión completadas" /></div>
    </section>}
  </aside>;
}

export function EquipoPresentismo({ colaboradores, metric = "presentismo", filtro, onFiltro, onOpen }: {
  colaboradores: ColaboradorResumenItem[];
  metric?: "presentismo" | "ruta" | "tareas";
  filtro: string;
  onFiltro: (valor: string) => void;
  onOpen: (id: number) => void;
}) {
  const [buscar, setBuscar] = useState("");
  const [paginado, setPaginado] = useState({ clave: "", page: 1 });
  const [limit, setLimit] = useState(7);
  const clave = `${filtro}:${buscar}:${limit}:${metric}`;
  const texto = buscar.trim().toLocaleLowerCase("es");
  // El endpoint existente devuelve una instantánea completa del equipo. Filtrar
  // esa misma instantánea conserva los totales y evita una segunda consulta.
  const filtrados = colaboradores.filter(c => (filtro === "todos" || c.estadoPresentismo === filtro || (filtro === "sin_iniciar" && c.inicioJornada === null))
    && (!texto || `${c.nombre} ${c.zona}`.toLocaleLowerCase("es").includes(texto)))
    .sort((a, b) => PRESENTISMO[a.estadoPresentismo].orden - PRESENTISMO[b.estadoPresentismo].orden || a.nombre.localeCompare(b.nombre, "es"));
  const totalPages = Math.max(1, Math.ceil(filtrados.length / limit));
  const page = Math.min(paginado.clave === clave ? paginado.page : 1, totalPages);
  const items = filtrados.slice((page - 1) * limit, page * limit);
  const detalle = (c: ColaboradorResumenItem) => metric === "ruta" ? `${c.ruta.completadas}/${c.ruta.total} visitas · ${c.ruta.enCurso} en curso · ${c.ruta.incompletas} incompletas`
    : metric === "tareas" ? `${c.tareas.completadas}/${c.tareas.total} tareas · ${c.tareas.obligPendientes} obligatorias pendientes`
      : `Entrada ${c.inicioJornada ?? "—"} · Salida ${c.finJornada ?? "—"}`;
  return <section className={styles.team} aria-label="Colaboradores del equipo">
    <div className={styles.sectionHead}><h2>{metric === "ruta" ? "Locales por persona" : metric === "tareas" ? "Tareas por persona" : "Personas del equipo"}</h2>
      <span>{filtrados.length} {filtrados.length === 1 ? "persona" : "personas"}</span></div>
    <div className={styles.filters} role="group" aria-label="Filtrar equipo por estado">
      {[["todos", "Todos"], ...ESTADOS.map(e => [e, PRESENTISMO[e].etiqueta]), ["sin_iniciar", "Sin entrada"]].map(([valor, etiqueta]) =>
        <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => onFiltro(valor)}>{etiqueta}</button>)}
    </div>
    <label className={styles.search}><span>Buscar en el equipo</span><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre o zona" /></label>
    {items.length ? <>
      <ul className={styles.people} aria-label="Equipo en vista móvil">{items.map(c => <li key={c.id}>
        <button className={styles.person} type="button" onClick={() => onOpen(c.id)} aria-label={`Ver detalle de ${c.nombre}`}>
          <span className={styles.avatar} data-tone={c.estadoPresentismo} aria-hidden="true">{c.iniciales}</span>
          <span className={styles.identity}><strong>{c.nombre}</strong><span>{c.zona || "Sin zona"}</span><small>{detalle(c)}</small></span>
          <span className={styles.status} data-tone={c.estadoPresentismo}>{PRESENTISMO[c.estadoPresentismo].etiqueta}</span>
        </button>
      </li>)}</ul>
      <div className={styles.table}><table><caption className="sr-only">Estado y avance de los colaboradores</caption>
        <thead><tr>{[
          ['Persona / zona', 'Persona del equipo y su zona asignada. Ver ficha permite consultar sus marcaciones y datos del dispositivo.'],
          ['Estado', 'Presente: entrada a tiempo. Tarde: entrada después del inicio. Incompleto: turno vencido sin salida o salida anticipada. Ausente: turno vencido sin marcas. Sin registro: aún sin marcas. En períodos se prioriza Incompleto, Ausente, Tarde y Presente.'],
          ['Entrada', 'Primera entrada registrada en el período. La pestaña Marcaciones de la ficha muestra cada visita y sus señales técnicas.'],
          ['Salida', 'Salida del último registro del período cuando las visitas están finalizadas. Consultá Marcaciones en la ficha para ver cada visita.'],
          ['Visitas', 'Visitas completadas sobre el total del período y cantidad de visitas en curso.'],
          ['Tareas', 'Tareas completadas sobre el total y cantidad de tareas obligatorias pendientes.'],
        ].map(([titulo, texto]) => <th key={titulo}>{titulo}<InfoColumna titulo={titulo} texto={texto} /></th>)}<th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{items.map(c => <tr key={c.id}><td><div className={styles.tablePerson}>
          <span className={styles.avatar} data-tone={c.estadoPresentismo} aria-hidden="true">{c.iniciales}</span>
          <div><strong>{c.nombre}</strong><small>{c.zona || "Sin zona"}</small></div></div></td>
          <td><span className={styles.status} data-tone={c.estadoPresentismo}>{PRESENTISMO[c.estadoPresentismo].etiqueta}</span></td>
          <td className={styles.hours}>{c.inicioJornada ?? "—"}</td><td className={styles.hours}>{c.finJornada ?? "—"}</td>
          <td><span className={styles.tableMetric}><b>{c.ruta.completadas}</b> / {c.ruta.total}</span><small>{c.ruta.enCurso} en curso</small></td>
          <td><span className={styles.tableMetric}><b>{c.tareas.completadas}</b> / {c.tareas.total}</span><small>{c.tareas.obligPendientes} obligatorias pendientes</small></td>
          <td><button type="button" className={styles.detailButton} aria-label={`Ver detalle de ${c.nombre}`} onClick={() => onOpen(c.id)}>Ver ficha <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
      </table></div>
    </> : <p className={styles.empty}>{colaboradores.length ? "No hay personas con estos filtros." : "No hay colaboradores asignados en el período seleccionado."}</p>}
    <Paginacion page={page} totalPages={totalPages} total={filtrados.length} limit={limit}
      onPageChange={valor => setPaginado({ clave, page: valor })} onLimitChange={setLimit} desplazarAlInicio={false} />
  </section>;
}
