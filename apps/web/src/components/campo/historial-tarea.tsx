"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import type { RespuestaPaginada } from "@/types/paginacion";
import type { VersionTarea } from "@/types/historial-tarea";

export function HistorialTarea({
  tareaId,
  nombre,
  cerrar,
}: {
  tareaId: number;
  nombre: string;
  cerrar: () => void;
}) {
  const [datos, setDatos] = useState<RespuestaPaginada<VersionTarea> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    void apiFetch<RespuestaPaginada<VersionTarea>>(
      `/campo/tareas/${tareaId}/versiones?page=${page}&limit=${limit}`,
    )
      .then((r) => {
        if (vigente) {
          setDatos(r);
          setError("");
        }
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el historial",
          );
      });
    return () => {
      vigente = false;
    };
  }, [tareaId, page, limit]);
  return (
    <Modal
      abierto
      titulo={`Historial · ${nombre}`}
      onCerrar={cerrar}
      ancho="lg"
    >
      <p className="mb-3 text-sm text-muted">
        Las versiones y las evidencias se conservan aunque la tarea se archive.
      </p>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-line">
        {datos?.items.map((v) => (
          <li key={v.version} className="py-3 text-sm text-foreground">
            <details>
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 rounded-md hover:bg-surface-soft">
                <strong>Versión {v.version}</strong>
                <span className="text-xs text-muted">
                  {new Date(v.creadaEn).toLocaleString("es-PY")}
                </span>
              </summary>
              <h3 className="mt-2 font-semibold">
                {v.contenido.nombre ?? nombre}
              </h3>
              <p className="whitespace-pre-wrap break-words">
                {v.contenido.descripcion || "Sin instrucciones adicionales"}
              </p>
              <p className="mt-2 text-xs text-muted">
                {v.contenido.archivadaEn || v.contenido.archivada_en
                  ? "Archivada"
                  : v.contenido.activo
                    ? "Activa"
                    : "Inactiva"}{" "}
                ·{" "}
                {(v.contenido.todosLocales ?? v.contenido.todos_locales)
                  ? "Todos los locales"
                  : `${v.contenido.localIds?.length ?? v.contenido.locales?.length ?? 0} locales seleccionados`}
              </p>
              <p className="text-xs text-muted">
                {(v.contenido.requiereFotos ?? v.contenido.requiere_fotos)
                  ? (v.contenido.fotosObligatorias ??
                    v.contenido.fotos_obligatorias)
                    ? "Fotos obligatorias"
                    : "Fotos opcionales"
                  : "Sin fotos"}
              </p>
            </details>
          </li>
        ))}
      </ul>
      {!datos && !error ? <p role="status">Cargando versiones…</p> : null}
      <Paginacion
        page={page}
        limit={limit}
        total={datos?.total ?? 0}
        totalPages={datos?.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </Modal>
  );
}
