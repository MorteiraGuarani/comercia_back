"use client";

import { useEffect, useState } from "react";
import { subirFoto, eliminarFoto, obtenerFotos, obtenerUrlFoto } from "@/lib/api-tareas";
import type { MomentoFoto, FotosTareaResponse } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";
import { PantallaCarga } from "@/components/pantalla-carga";

interface SubidorFotosProps {
  visitaId: number;
  tareaId: number;
  obligatorio: boolean;
  onFotosActualizadas: () => void;
}

export function SubidorFotos({ visitaId, tareaId, obligatorio, onFotosActualizadas }: SubidorFotosProps) {
  const [fotos, setFotos] = useState<FotosTareaResponse | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [operacion, setOperacion] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerFotos(visitaId, tareaId).then((resultado) => {
      if (vigente) { setFotos(resultado); setError(""); }
    }).catch((problema: unknown) => {
      if (vigente) setError(problema instanceof Error ? problema.message : "No se pudieron cargar las fotos");
    });
    return () => { vigente = false; };
  }, [visitaId, tareaId, intento]);

  async function actualizar(momento: MomentoFoto, archivo?: File) {
    if (operacion) return;
    if (archivo && archivo.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB");
      return;
    }
    if (archivo && !["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
      setError("Solo se permiten imágenes JPG, PNG o WebP");
      return;
    }
    if (!archivo && !confirm("¿Eliminar esta foto?")) return;
    setOperacion(archivo ? "Subiendo foto" : "Eliminando foto");
    setError("");
    try {
      if (archivo) {
        const foto = await subirFoto(visitaId, tareaId, momento, archivo);
        setFotos((actuales) => ({ ...actuales, [momento === "ANTES" ? "antes" : "despues"]: foto }));
      } else {
        await eliminarFoto(visitaId, tareaId, momento);
        setFotos((actuales) => ({ ...actuales, [momento === "ANTES" ? "antes" : "despues"]: undefined }));
      }
      mostrarToast("exito", archivo ? "Foto guardada" : "Foto eliminada");
      onFotosActualizadas();
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : "No se pudo guardar el cambio");
    } finally {
      setOperacion("");
    }
  }

  return (
    <div className="space-y-3 text-foreground">
      <PantallaCarga visible={!!operacion} mensaje={operacion} />
      <p className="text-sm text-muted">{obligatorio ? "Subí ambas fotos antes de completar la tarea." : "Podés adjuntar fotos del antes y del después."}</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {!fotos ? (
        error ? <button type="button" className="min-h-11 rounded-lg border border-line px-4 hover:bg-surface-soft" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
          : <p role="status" className="py-6 text-sm text-muted">Cargando fotos…</p>
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-3">
          {(["ANTES", "DESPUES"] as const).map((momento) => {
            const foto = momento === "ANTES" ? fotos.antes : fotos.despues;
            const nombre = momento === "ANTES" ? "Antes" : "Después";
            return (
              <div key={momento} className="min-w-0 rounded-lg border border-line bg-surface-raised p-2 sm:p-3">
                <h3 className="mb-2 text-sm font-semibold">{nombre}</h3>
                {foto ? (
                  // Las fotos privadas se sirven con la cookie de sesión.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={obtenerUrlFoto(foto.id) + "?v=" + encodeURIComponent(foto.creadoAt)} alt={"Foto " + nombre.toLowerCase()} className="h-32 w-full rounded object-cover sm:h-44" />
                ) : <div className="grid h-32 place-items-center rounded bg-surface-soft text-xs text-muted sm:h-44">Sin foto</div>}
                <label className="relative mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line px-2 text-sm font-medium hover:bg-surface-soft focus-within:ring-2 focus-within:ring-brand-600">
                  {foto ? "Cambiar" : "Subir foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={(foto ? "Cambiar" : "Subir") + " foto " + nombre.toLowerCase()} disabled={!!operacion} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) void actualizar(momento, archivo);
                    e.target.value = "";
                  }} />
                </label>
                {foto && !obligatorio && <button type="button" disabled={!!operacion} className="mt-1 min-h-11 w-full rounded-md text-sm text-red-700 hover:bg-surface-soft dark:text-red-300" onClick={() => void actualizar(momento)}>Eliminar</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
