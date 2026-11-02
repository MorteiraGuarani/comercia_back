"use client";

import { useState } from "react";
import { SelectorPaginado } from "@/components/selector-paginado";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { apiFetch } from "@/lib/api";
import { borrarCacheSesion } from "@/lib/cache-sesion";
import { mensajeError } from "@/utils/error";
import type { EquipoCampo } from "@/types/rol";

/**
 * Jefaturas (jefe de canal, back office de canal, gerencia): con qué equipo
 * trabajan ahora. "Todos" sirve para consultar; administrar exige elegir uno.
 */
export function SelectorEquipoGestion({
  equipo,
  enLinea = false,
}: {
  equipo: EquipoCampo | null;
  /** Dentro de una barra de filtros (Inicio de jefatura) en vez de la franja superior. */
  enLinea?: boolean;
}) {
  const [guardando, setGuardando] = useState(false);

  async function elegir(id: number | "") {
    if (guardando || (id || null) === (equipo?.id ?? null)) return;
    setGuardando(true);
    try {
      await apiFetch("/campo/equipos-gestion/activo", {
        method: "PUT",
        body: JSON.stringify({ equipoId: id === "" ? null : id }),
      });
      // La sesión y cada pantalla leen el equipo elegido al cargar; lo
      // guardado del equipo anterior no se muestra ni un instante.
      borrarCacheSesion();
      window.location.reload();
    } catch (e) {
      mostrarToast(
        "error",
        mensajeError(e, "Probá de nuevo."),
        "No se cambió el equipo",
      );
      setGuardando(false);
    }
  }

  const selector = (
    <SelectorPaginado<number>
      url="/campo/equipos-gestion"
      etiqueta="Equipo"
      value={equipo?.id ?? ""}
      seleccionActual={equipo?.nombre}
      placeholder="Todos"
      buscable
      compacto={!enLinea}
      // Escribir para buscar emite "" sin elegir: solo cuentan las opciones tocadas.
      onChange={() => undefined}
      onSeleccionar={(opcion) => void elegir(opcion.id)}
      opcionVacia={{ texto: "Todos", onElegir: () => void elegir("") }}
    />
  );
  if (enLinea)
    return (
      <div className="min-w-0">
        <PantallaCarga visible={guardando} mensaje="Cambiando de equipo" />
        {selector}
      </div>
    );
  return (
    <div className="border-b border-line bg-surface-soft px-3 py-2 sm:px-5 lg:px-6">
      <PantallaCarga visible={guardando} mensaje="Cambiando de equipo" />
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <p className="shrink-0 text-xs font-semibold text-muted">Equipo</p>
        <div className="min-w-0 sm:w-72">{selector}</div>
      </div>
    </div>
  );
}
