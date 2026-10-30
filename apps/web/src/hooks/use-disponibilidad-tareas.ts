"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { hayTareasAsignadas } from "@/lib/disponibilidad-tareas";
import { useFechaCampo } from "./use-fecha-campo";
import { EVENTO_PLATAFORMA_ACTUALIZADA } from "@/lib/eventos-plataforma";
import type { ModuloMenu } from "@/types/plataforma";
import type { SupervisionResumenData } from "@/types/campo";
import type { DisponibilidadTareas } from "@/types/disponibilidad-tareas";

const SIN_DATOS: DisponibilidadTareas = {};

export function useDisponibilidadTareas(usuarioId: number | undefined, modulos: ModuloMenu[], pathname: string) {
  const hoy = useFechaCampo();
  const [estado, setEstado] = useState<{ clave: string; valor: DisponibilidadTareas }>({ clave: "", valor: {} });
  const [revision, setRevision] = useState(0);
  // La autorización se deduce del menú, nunca del nombre del rol.
  const jornada = modulos.some((m) => m.ruta === "mi-jornada" && m.paginas.some((p) => p.ruta === "tareas"));
  // Sin Visitas (back office) «Tareas» es el ABM donde se crean: siempre habilitado, aunque esté vacío.
  const gestion =
    modulos.some((m) => m.ruta === "gestion-campo" && m.paginas.some((p) => p.ruta === "tareas")) &&
    modulos.some((m) => m.ruta === "gestion-campo" && m.paginas.some((p) => p.ruta === "visitas"));
  const clave = `${usuarioId}|${hoy}|${jornada}|${gestion}`;

  useEffect(() => {
    const actualizar = () => setRevision((n) => n + 1);
    window.addEventListener(EVENTO_PLATAFORMA_ACTUALIZADA, actualizar);
    return () => window.removeEventListener(EVENTO_PLATAFORMA_ACTUALIZADA, actualizar);
  }, []);

  useEffect(() => {
    if (!usuarioId) return;
    const controller = new AbortController();
    const guardar = (modulo: string, disponible: boolean) => {
      if (!controller.signal.aborted)
        setEstado((previo) => ({ clave, valor: { ...(previo.clave === clave ? previo.valor : {}), [modulo]: disponible } }));
    };
    if (jornada)
      void hayTareasAsignadas(`fecha=${hoy}`, controller.signal)
        .then((valor) => guardar("mi-jornada", valor)).catch(() => undefined);
    if (gestion)
      void apiFetch<SupervisionResumenData>(`/campo/supervision/resumen?fecha=${hoy}`, { signal: controller.signal })
        .then((r) => guardar("gestion-campo", r.tareas.total > 0)).catch(() => undefined);
    return () => controller.abort();
  }, [usuarioId, hoy, jornada, gestion, clave, pathname, revision]);

  // Una falla de red no equivale a no tener tareas.
  return estado.clave === clave ? estado.valor : SIN_DATOS;
}
