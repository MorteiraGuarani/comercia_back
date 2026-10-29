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
}: {
  equipo: EquipoCampo | null;
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

  return (
    <div className="border-b border-line bg-surface-soft px-3 py-2 sm:px-5 lg:px-6">
      <PantallaCarga visible={guardando} mensaje="Cambiando de equipo" />
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <p className="shrink-0 text-xs font-semibold text-muted">
          Equipo con el que trabajás
        </p>
        <div className="min-w-0 sm:w-72">
          <SelectorPaginado<number>
            url="/campo/equipos-gestion"
            etiqueta="Equipo con el que trabajás"
            value={equipo?.id ?? ""}
            seleccionActual={equipo?.nombre}
            vacio="Todos mis equipos"
            placeholder="Todos mis equipos"
            buscable
            compacto
            onChange={(id) => void elegir(id)}
          />
        </div>
      </div>
    </div>
  );
}
