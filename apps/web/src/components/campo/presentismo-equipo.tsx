"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Paginacion } from "@/components/paginacion";
import type { ColaboradorResumenItem, SupervisionResumenData } from "@/types/campo";
import styles from "./presentismo.module.css";
import InfoColumna from '../InfoColumna';
import { PRESENTISMO } from "@/utils/estado-jornada";
import type { EstadoPresentismo } from "@/types/estado-jornada";

const ESTADOS = Object.keys(PRESENTISMO) as EstadoPresentismo[];
const FILTROS = [["todos", "Todos"], ...ESTADOS.map(e => [e, PRESENTISMO[e].etiqueta]), ["sin_iniciar", "Sin entrada"]] as const;

// Cada estado del resumen filtra la lista del equipo: en celular el resumen y
// la lista quedan lejos, así que tocar un número lleva directo a esas personas.
export function ResumenPresentismo({ resumen, onFiltrar, accion }: {
  resumen: SupervisionResumenData;
  onFiltrar: (filtro: string) => void;
  /** Botón de actualizar, al lado de la cantidad de personas. */
  accion?: ReactNode;
}) {
  const { presentismo: p } = resumen;
  const marcaciones = resumen.colaboradores.filter(c => c.inicioJornada !== null).length;
  const sinEntrada = p.totalEquipo - marcaciones;
  const porcentaje = p.totalEquipo ? Math.round(marcaciones / p.totalEquipo * 100) : null;
  return <aside className={styles.balance} aria-label="Balance del equipo">
    <section className={styles.summary}>
      <div className={styles.sectionHead}><h2>Tu equipo</h2><span className="flex items-center gap-2">{p.totalEquipo} {p.totalEquipo === 1 ? "persona" : "personas"}{accion}</span></div>
      <div className={styles.headline}><strong>{porcentaje ?? "—"}{porcentaje !== null && <small>%</small>}</strong>
        <div><b>Con marcación</b><span>{marcaciones} de {p.totalEquipo} en el período</span></div></div>
      <div className={styles.distribution} role="img" aria-label={ESTADOS.map(e => `${p.estados[e]} ${PRESENTISMO[e].etiqueta}`).join(", ")}>
        {ESTADOS.filter(e => p.estados[e] > 0).map(e => <i key={e} data-tone={e} style={{ flexGrow: p.estados[e] }} />)}
      </div>
      <ul className={styles.counts} aria-label="Personas por estado">
        {ESTADOS.map(e => <li key={e} data-tone={e} data-vacio={p.estados[e] === 0 || undefined}>
          <button type="button" onClick={() => onFiltrar(e)} aria-label={`${PRESENTISMO[e].etiqueta}: ${p.estados[e]} de ${p.totalEquipo}. Ver en la lista`}>
            <b>{p.estados[e]}<small>/{p.totalEquipo}</small></b>
            <span>{PRESENTISMO[e].etiqueta}<small>{p.totalEquipo ? Math.round((p.estados[e] / p.totalEquipo) * 100) : 0}%</small></span>
          </button>
        </li>)}
      </ul>
      {sinEntrada > 0 ? <button type="button" className={styles.notice} onClick={() => onFiltrar("sin_iniciar")}>
        <span><b>{sinEntrada} sin entrada registrada</b><small>Revisá a quién contactar</small></span><span aria-hidden="true">→</span>
      </button> : <p className={styles.calm}>{p.totalEquipo ? "Todo el equipo tiene una marcación." : "No tenés personas a cargo. Revisá el Organigrama."}</p>}
    </section>
    <details className={styles.howto}>
      <summary>¿Cómo se calcula cada estado?</summary>
      <p>Presente: tuvo entrada y salida. En curso: tiene entrada y todavía no salió, y la jornada del local no terminó. Incompleto: tiene entrada sin salida y la jornada del local ya terminó. Ausente: no tuvo entrada y la jornada terminó. Pendiente: todavía no marcó y la jornada no terminó. La hora de llegada no cambia el estado. Sin horario no se deduce ausencia. En períodos de varios días manda lo que está en curso y después las incidencias.</p>
    </details>
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
  const filtrosRef = useRef<HTMLDivElement>(null);
  // En celular los filtros son una fila con desplazamiento horizontal: si el
  // filtro activo llega desde el resumen, se centra para que quede a la vista.
  useEffect(() => {
    const grupo = filtrosRef.current;
    const activo = grupo?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!grupo || !activo || grupo.scrollWidth <= grupo.clientWidth) return;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    grupo.scrollTo({ left: activo.offsetLeft - (grupo.clientWidth - activo.offsetWidth) / 2, behavior: quieto ? "instant" : "smooth" });
  }, [filtro]);
  const conteos: Record<string, number> = { todos: colaboradores.length, sin_iniciar: 0 };
  for (const c of colaboradores) {
    conteos[c.estadoPresentismo] = (conteos[c.estadoPresentismo] ?? 0) + 1;
    if (c.inicioJornada === null) conteos.sin_iniciar++;
  }
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
    <div className={styles.teamTools}>
      <label className={styles.search}>
        <span className="sr-only">Buscar en el equipo</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o zona" />
      </label>
      <div ref={filtrosRef} className={styles.filters} role="group" aria-label="Filtrar equipo por estado">
        {FILTROS.map(([valor, etiqueta]) =>
          <button key={valor} type="button" aria-pressed={filtro === valor} data-tone={valor === "todos" ? undefined : valor} onClick={() => onFiltro(valor)}>
            {etiqueta}<span className={styles.chipCount}>{conteos[valor] ?? 0}</span>
          </button>)}
      </div>
    </div>
    {items.length ? <>
      <ul className={styles.people} aria-label="Equipo en vista móvil">{items.map(c => <li key={c.id}>
        <button className={styles.person} type="button" onClick={() => onOpen(c.id)} aria-label={`Ver detalle de ${c.nombre}`}>
          <span className={styles.avatar} data-tone={c.estadoPresentismo} aria-hidden="true">{c.iniciales}</span>
          <span className={styles.identity}><strong>{c.nombre}</strong><span>{c.zona || "Sin zona"}</span><small>{detalle(c)}</small></span>
          <span className={styles.status} data-tone={c.estadoPresentismo}>{PRESENTISMO[c.estadoPresentismo].etiqueta}</span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </button>
      </li>)}</ul>
      <div className={styles.table}><table><caption className="sr-only">Estado y avance de los colaboradores</caption>
        <thead><tr>{[
          ['Persona / zona', 'Persona del equipo y su zona asignada. Ver ficha permite consultar sus marcaciones y datos del dispositivo.'],
          ['Estado', 'Presente: entrada y salida. En curso: entrada sin salida y la jornada del local no terminó. Incompleto: entrada sin salida y la jornada ya terminó. Ausente: sin entrada y la jornada terminó. Pendiente: todavía sin marcas. En períodos manda lo que está en curso y después Incompleto, Ausente y Presente.'],
          ['Entrada', 'Primera entrada registrada en el período. La pestaña Marcaciones de la ficha muestra cada visita y sus señales técnicas.'],
          ['Salida', 'Salida del último registro del período cuando las visitas están finalizadas. Consultá Marcaciones en la ficha para ver cada visita.'],
          ['Visitas', 'Visitas completadas sobre el total del período y cantidad de visitas en curso.'],
          ['Tareas', 'Tareas completadas sobre el total y cantidad de tareas obligatorias pendientes.'],
        ].map(([titulo, texto]) => <th key={titulo}><span className={styles.th}>{titulo}<InfoColumna titulo={titulo} texto={texto} /></span></th>)}<th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{items.map(c => <tr key={c.id}><td><div className={styles.tablePerson}>
          <span className={styles.avatar} data-tone={c.estadoPresentismo} aria-hidden="true">{c.iniciales}</span>
          <div><strong>{c.nombre}</strong><small>{c.zona || "Sin zona"}</small></div></div></td>
          <td><span className={styles.status} data-tone={c.estadoPresentismo}>{PRESENTISMO[c.estadoPresentismo].etiqueta}</span></td>
          <td className={styles.hours}>{c.inicioJornada ?? "—"}</td><td className={styles.hours}>{c.finJornada ?? "—"}</td>
          <td><span className={styles.tableMetric}><b>{c.ruta.completadas}</b> / {c.ruta.total}</span><small>{c.ruta.enCurso} en curso</small></td>
          <td><span className={styles.tableMetric}><b>{c.tareas.completadas}</b> / {c.tareas.total}</span><small>{c.tareas.obligPendientes} obligatorias pendientes</small></td>
          <td><button type="button" className={styles.detailButton} aria-label={`Ver detalle de ${c.nombre}`} onClick={() => onOpen(c.id)}>Ver ficha <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
      </table></div>
    </> : <p className={styles.empty}>{colaboradores.length ? "No hay personas con estos filtros." : "No tenés personas a cargo: nadie te tiene como superior. Revisá el Organigrama; el superior de cada persona se define en Usuarios."}</p>}
    <Paginacion page={page} totalPages={totalPages} total={filtrados.length} limit={limit}
      onPageChange={valor => setPaginado({ clave, page: valor })} onLimitChange={setLimit} desplazarAlInicio={false} />
  </section>;
}
