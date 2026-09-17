"use client";

import Link from "next/link";
import { usePanel } from "@/components/panel/contexto";
import { IconoFlechaDer } from "@/components/campo/ui/iconos-campo";

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

      {tieneGestionCampo && (
        <section aria-labelledby="inicio-equipo">
          <h2 id="inicio-equipo" className="ft-display mb-3 text-2xl font-semibold">Mi equipo</h2>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
            <Acceso href="/panel/gestion-campo/visitas" titulo="Resumen y asistencia" descripcion="Asistencia, avance de rutas y tareas por colaborador." />
            <Acceso href="/panel/gestion-campo/novedades" titulo="Novedades del equipo" descripcion="Consultá los reportes pendientes y registrá su resolución." />
            <Acceso href="/panel/gestion-campo/avisos" titulo="Avisos" descripcion="Enviá indicaciones y consultá quiénes las leyeron." />
          </div>
        </section>
      )}

      {tieneMiJornada && (
        <section aria-labelledby="inicio-jornada">
          <h2 id="inicio-jornada" className="ft-display mb-3 text-2xl font-semibold">Mi jornada</h2>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
            <Acceso href="/panel/mi-jornada/locales" titulo="Mi ruta" descripcion="Locales asignados y registro de entrada y salida." />
            <Acceso href="/panel/mi-jornada/tareas" titulo="Mis tareas" descripcion="Actividades por local y registro de fotos." />
            <Acceso href="/panel/mi-jornada/novedades" titulo="Mis novedades" descripcion="Reportá un imprevisto y consultá la respuesta de tu supervisor." />
            <Acceso href="/panel/mi-jornada/avisos" titulo="Avisos recibidos" descripcion="Leé las indicaciones de tu team leader." />
          </div>
        </section>
      )}

      {modulos.length === 0 && (
        <p className="rounded-lg border border-line bg-surface-raised p-6 text-sm text-muted">
          Todavía no hay módulos asignados a tu empresa.
        </p>
      )}
    </div>
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
