"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePanel } from "@/components/panel/contexto";
import { IconoFlechaDer } from "@/components/campo/ui/iconos-campo";
import { apiFetch } from "@/lib/api";
import { fechaEnZonaIso } from "@/utils/fechas";
import type { AgendaCampo, SupervisionResumenData } from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

export default function PanelInicioPage() {
  const { usuario, modulos } = usePanel();
  const tieneGestionCampo = modulos.some((m) => m.ruta === "gestion-campo");
  const tieneMiJornada = modulos.some((m) => m.ruta === "mi-jornada");

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 p-4 text-foreground sm:p-6 lg:p-8">
      <header className="border-b border-line pb-6">
        <p className="text-sm text-muted">{usuario.empresa.nombre}</p>
        <h1 className="ft-display mt-2 text-3xl font-semibold sm:text-4xl">
          Hola, {usuario.nombre}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {tieneGestionCampo
            ? "Revisá el avance de tu equipo y atendé las novedades de la jornada."
            : tieneMiJornada
              ? "Consultá tu ruta, registrá tus visitas y completá las tareas del día."
              : "Accedé a los módulos de tu empresa desde el menú."}
        </p>
      </header>

      {!usuario.rol && !usuario.esSuperadmin && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Tu cuenta está pendiente de rol. Un administrador debe asignártelo para habilitar módulos.
        </p>
      )}

      {(tieneGestionCampo || tieneMiJornada) && (
        modulos.filter((m) => m.ruta === "gestion-campo" || m.ruta === "mi-jornada").map((modulo) => (
          <InicioResumen key={`${usuario.id}:${modulo.ruta}:${modulo.paginas.map((p) => p.ruta).join(",")}`} modulo={modulo} />
        ))
      )}

      {modulos.map((modulo) => (
        <section key={modulo.id} aria-labelledby={`inicio-modulo-${modulo.id}`}>
          <h2 id={`inicio-modulo-${modulo.id}`} className="ft-display mb-3 text-2xl font-semibold">
            {modulo.nombre}
          </h2>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {modulo.paginas.map((pagina) => (
              <Acceso
                key={pagina.id}
                href={`/panel/${modulo.ruta}/${pagina.ruta}`}
                titulo={pagina.nombre}
                descripcion={descripcionPagina(modulo.ruta, pagina.ruta)}
              />
            ))}
          </div>
        </section>
      ))}

      {modulos.length === 0 && (
        <p className="rounded-lg border border-line bg-surface-raised p-6 text-sm text-muted">
          Todavía no hay módulos asignados a tu empresa.
        </p>
      )}
    </div>
  );
}

function InicioResumen({ modulo }: { modulo: import("@/types/plataforma").ModuloMenu }) {
  const equipo = modulo.ruta === "gestion-campo";
  const tiene = (pagina: string) => modulo.paginas.some((p) => p.ruta === pagina);
  const visitas = equipo && tiene("visitas");
  const rutaPagina = tiene("locales") ? "locales" : tiene("agenda") ? "agenda" : "tareas";
  const jornada = !equipo && (tiene("locales") || tiene("agenda") || tiene("tareas"));
  const tareas = !equipo && tiene("tareas");
  const novedades = tiene("novedades");
  const avisos = tiene("avisos");
  const [resumen, setResumen] = useState<SupervisionResumenData | null>(null);
  const [locales, setLocales] = useState<number | null>(null);
  const [visitasHoy, setVisitasHoy] = useState<number | null>(null);
  const [abierta, setAbierta] = useState<import("@/types/campo").VisitaCampo | null>(null);
  const [tareasActivas, setTareasActivas] = useState<number | null>(null);
  const [avisosRecientes, setAvisosRecientes] = useState<import("@/types/campo").AvisoRecibidoItem[] | null>(null);
  const [novedadesAbiertas, setNovedadesAbiertas] = useState<number | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [terminada, setTerminada] = useState(-1);
  const cargando = terminada !== revision;

  useEffect(() => {
    const controller = new AbortController();
    const fecha = fechaEnZonaIso(new Date());
    const opciones = { signal: controller.signal };
    const fallos: string[] = [];
    async function consultar<T>(nombre: string, url: string, guardar: (datos: T) => void) {
      try {
        const datos = await apiFetch<T>(url, opciones);
        if (!controller.signal.aborted) guardar(datos);
      } catch {
        if (!controller.signal.aborted) fallos.push(nombre);
      }
    }
    async function cargar() {
      const solicitudes: Promise<void>[] = [];
      if (visitas) solicitudes.push(consultar<SupervisionResumenData>("Equipo", `/campo/supervision/resumen?fecha=${fecha}`, setResumen));
      if (novedades) solicitudes.push(consultar<{ total: number }>("Novedades", "/campo/novedades?estado=ABIERTA&page=1&limit=1", (d) => setNovedadesAbiertas(d.total)));
      if (avisos) solicitudes.push(consultar<RespuestaPaginada<import("@/types/campo").AvisoRecibidoItem>>("Avisos", "/campo/avisos/recibidos?page=1&limit=7", (d) => setAvisosRecientes(d.items)));
      if (jornada) {
        solicitudes.push(consultar<RespuestaPaginada<AgendaCampo>>("Locales", `/campo/jornada?fecha=${fecha}&page=1&limit=1`, (d) => setLocales(d.total)));
        solicitudes.push(consultar<{ total: number }>("Visitas", `/campo/jornada/visitas?fecha=${fecha}&page=1&limit=1`, (d) => setVisitasHoy(d.total)));
        solicitudes.push((async () => {
          try {
            const activa = await apiFetch<import("@/types/campo").VisitaCampo | null>("/campo/jornada/abierta", opciones);
            if (controller.signal.aborted) return;
            setAbierta(activa);
            if (activa && tareas && activa.fecha.slice(0, 10) === fecha) {
              await consultar<{ total: number }>("Tareas de la visita", `/campo/jornada/asignaciones/${activa.asignacionId}/tareas?fecha=${fecha}&page=1&limit=1`, (d) => setTareasActivas(d.total));
            }
          } catch {
            if (!controller.signal.aborted) fallos.push("Visita activa");
          }
        })());
      }
      await Promise.all(solicitudes);
      if (!controller.signal.aborted) {
        setErrores(fallos);
        setTerminada(revision);
      }
    }
    void cargar();
    return () => controller.abort();
  }, [visitas, novedades, avisos, jornada, tareas, revision]);

  const href = (pagina: string) => `/panel/${modulo.ruta}/${pagina}`;
  if (!visitas && !jornada && !avisos && !novedades) return null;
  return (
    <section aria-label={equipo ? "Resumen del equipo" : "Resumen de tu jornada"} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-accent-ink">Hoy · {fechaEnZonaIso(new Date())}</p>
          <h2 className="ft-display text-2xl font-semibold">{equipo ? "Tu equipo hoy" : "Tu jornada hoy"}</h2>
        </div>
        <button type="button" disabled={cargando} onClick={() => setRevision((n) => n + 1)} className="min-h-11 rounded-lg border border-line px-3 text-xs hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">Actualizar</button>
      </div>
      {cargando ? <p role="status" className="py-4 text-sm text-muted">Cargando resumen…</p> : (
        <>
          {errores.length > 0 && <p role="alert" className="text-sm text-muted">No se pudo actualizar: {errores.join(", ")}. Podés reintentar con Actualizar.</p>}
          {jornada && abierta && !errores.includes("Visita activa") && (
            <Link href={href(rutaPagina)} className="block rounded-lg border border-accent-ink bg-surface-raised p-3 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus">
              <p className="text-xs font-semibold text-accent-ink">Visita abierta{abierta.fecha.slice(0, 10) !== fechaEnZonaIso(new Date()) ? " de una jornada anterior" : ""}</p>
              <p className="mt-1 text-sm font-semibold">{abierta.local.nombre}</p>
              <p className="mt-1 text-xs text-muted">Continuá tu visita o registrá la salida.</p>
            </Link>
          )}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {visitas && <>
              <KpiInicio href={href("visitas")} label="En ruta" value={errores.includes("Equipo") ? "—" : resumen?.presentismo.enRuta ?? "—"} detail={resumen ? `${resumen.presentismo.totalEquipo} colaboradores` : "Equipo de hoy"} />
              <KpiInicio href={href("visitas")} label="Sin iniciar" value={errores.includes("Equipo") ? "—" : resumen?.presentismo.sinIniciar ?? "—"} detail="Sin entrada registrada" tone="alerta" />
              <KpiInicio href={href("visitas")} label="Rutas" value={!errores.includes("Equipo") && resumen ? `${resumen.rutas.pct}%` : "—"} detail={resumen ? `${resumen.rutas.completadas}/${resumen.rutas.total} paradas` : "Avance del día"} tone="frio" />
              <KpiInicio href={href("visitas")} label="Tareas" value={!errores.includes("Equipo") && resumen ? `${resumen.tareas.pct}%` : "—"} detail={resumen ? `${resumen.tareas.obligatoriasPendientes} obligatorias pendientes` : "Cumplimiento del equipo"} tone="fresco" />
            </>}
            {jornada && <>
              <KpiInicio href={href(rutaPagina)} label="Locales hoy" value={errores.includes("Locales") ? "—" : locales ?? "—"} detail="Asignaciones de tu jornada" />
              <KpiInicio href={href(rutaPagina)} label="Visitas hoy" value={errores.includes("Visitas") ? "—" : visitasHoy ?? "—"} detail="Entradas registradas" tone="fresco" />
            </>}
            {tareas && <KpiInicio href={href("tareas")} label="Tareas de visita" value={errores.includes("Tareas de la visita") || errores.includes("Visita activa") || !abierta || abierta.fecha.slice(0, 10) !== fechaEnZonaIso(new Date()) ? "—" : tareasActivas ?? "—"} detail={abierta ? "Asignadas al local activo" : "Abrí Mis tareas para ver tu agenda"} tone="frio" />}
            {novedades && <KpiInicio href={href("novedades")} label="Novedades abiertas" value={errores.includes("Novedades") ? "—" : novedadesAbiertas ?? "—"} detail={equipo ? "Pendientes de resolución" : "Reportes en seguimiento"} tone="alerta" />}
          </div>
          {avisos && avisosRecientes && !errores.includes("Avisos") && (
            <Link href={href("avisos")} className="block rounded-lg border border-line bg-surface-raised p-3 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus">
              <p className="text-sm font-semibold">Avisos recibidos</p>
              <p className="mt-1 text-sm text-muted">{avisosRecientes.length === 0 ? "Todavía no recibiste avisos." : `${avisosRecientes.filter((a) => !a.leido).length} sin leer entre los últimos ${avisosRecientes.length} avisos.`}</p>
              {avisosRecientes[0] && <p className="mt-2 line-clamp-2 text-sm">{avisosRecientes[0].mensaje}</p>}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function KpiInicio({
  href,
  label,
  value,
  detail,
  tone = "ink",
}: {
  href: string;
  label: string;
  value: number | string;
  detail: string;
  tone?: "ink" | "frio" | "fresco" | "alerta";
}) {
  const valorClase = {
    ink: "text-foreground",
    frio: "text-blue-700 dark:text-blue-300",
    fresco: "text-emerald-700 dark:text-emerald-300",
    alerta: "text-amber-700 dark:text-amber-300",
  }[tone];

  return (
    <Link
      href={href}
      className="group min-w-0 rounded-xl border border-line bg-surface-raised p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-accent-ink hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 sm:p-4"
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 ft-display text-3xl font-semibold leading-none ${valorClase}`}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted group-hover:text-foreground">{detail}</p>
    </Link>
  );
}

function Acceso({ href, titulo, descripcion }: { href: string; titulo: string; descripcion: string }) {
  return (
    <Link href={href} className="group flex min-h-16 min-w-0 items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-soft focus-visible:relative sm:px-5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold group-hover:text-accent-ink">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{descripcion}</p>
      </div>
      <IconoFlechaDer className="h-5 w-5 shrink-0 text-muted group-hover:text-accent-ink" />
    </Link>
  );
}

function descripcionPagina(modulo: string, pagina: string) {
  const descripciones: Record<string, string> = {
    "gestion-campo/visitas": "Asistencia, avance de rutas y tareas por colaborador.",
    "gestion-campo/novedades": "Reportes pendientes y resolución de incidencias.",
    "gestion-campo/avisos": "Indicaciones operativas y confirmación de lectura.",
    "gestion-campo/clientes": "Cuentas comerciales y cobertura geográfica.",
    "gestion-campo/locales": "Puntos de venta, rutas y planificación operativa.",
    "gestion-campo/tareas": "Protocolos y tareas asignadas al equipo.",
    "mi-jornada/locales": "Locales asignados y registro de entrada y salida.",
    "mi-jornada/tareas": "Actividades por local y registro de fotos.",
    "mi-jornada/novedades": "Reportá un imprevisto y consultá la respuesta.",
    "mi-jornada/avisos": "Indicaciones recibidas de tu team leader.",
    "mi-jornada/agenda": "Agenda diaria, visitas y reemplazos.",
  };
  return descripciones[`${modulo}/${pagina}`] ?? "Abrí este módulo para consultar su información.";
}
