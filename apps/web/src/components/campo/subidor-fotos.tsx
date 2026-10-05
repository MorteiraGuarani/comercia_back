"use client";

import { useEffect, useRef, useState } from "react";
import { usePanel } from "@/components/panel/contexto";
import {
  enviarAccionTarea,
  listarPendientes,
  observarPendientes,
} from "@/lib/pendientes-tareas";
import { eliminarFoto, obtenerFotos, obtenerUrlFoto } from "@/lib/api-tareas";
import type { MomentoFoto, FotosTareaResponse, FotoTarea } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";
import { PantallaCarga } from "@/components/pantalla-carga";
import { prepararImagen } from "@/utils/preparar-imagen";
import { CapturadorCamara } from "./capturador-camara";
import { IconoCamara, IconoGaleria } from "./ui/iconos-campo";

interface SubidorFotosProps {
  visitaId: number;
  tareaId: number;
  obligatorio: boolean;
  onFotosActualizadas: () => void;
}

export function SubidorFotos({
  visitaId,
  tareaId,
  obligatorio,
  onFotosActualizadas,
}: SubidorFotosProps) {
  const { usuario } = usePanel();
  const [fotos, setFotos] = useState<FotosTareaResponse | null>(null);
  const [previews, setPreviews] = useState<
    Partial<Record<MomentoFoto, string>>
  >({});
  const ruta = `/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/fotos`;
  const previewsRef = useRef<Partial<Record<MomentoFoto, string>>>({});
  useEffect(() => {
    let vigente = true,
      revision = 0,
      tuvoPendientes = false;
    const cargar = async () => {
      const intento = ++revision;
      const acciones = (await listarPendientes(usuario.id)).filter(
        (a) => a.ruta === ruta,
      );
      if (!vigente || intento !== revision) return;
      const nuevas: Partial<Record<MomentoFoto, string>> = {};
      for (const a of acciones) {
        const momento = a.campos?.find((c) => c.nombre === "momento")?.valor;
        const blob = a.campos?.find((c) => c.nombre === "foto")?.valor;
        if (
          (momento === "ANTES" || momento === "DESPUES") &&
          blob instanceof Blob
        ) {
          if (nuevas[momento]) URL.revokeObjectURL(nuevas[momento]!);
          nuevas[momento] = URL.createObjectURL(blob);
        }
      }
      Object.values(previewsRef.current).forEach(URL.revokeObjectURL);
      previewsRef.current = nuevas;
      setPreviews(nuevas);
      if (acciones.length) tuvoPendientes = true;
      else if (tuvoPendientes && navigator.onLine) {
        tuvoPendientes = false;
        const fotos = await obtenerFotos(visitaId, tareaId);
        if (vigente && intento === revision) setFotos(fotos);
      }
    };
    void cargar().catch(() => undefined);
    const dejar = observarPendientes(
      () => void cargar().catch(() => undefined),
    );
    return () => {
      vigente = false;
      dejar();
      Object.values(previewsRef.current).forEach(URL.revokeObjectURL);
    };
  }, [usuario.id, ruta, visitaId, tareaId]);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [operacion, setOperacion] = useState("");
  const galeriaRef = useRef<Record<MomentoFoto, HTMLInputElement | null>>({
    ANTES: null,
    DESPUES: null,
  });
  const [camaraMomento, setCamaraMomento] = useState<MomentoFoto | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerFotos(visitaId, tareaId)
      .then((resultado) => {
        if (vigente) {
          setFotos(resultado);
          setError("");
        }
      })
      .catch((problema: unknown) => {
        if (vigente) {
          setFotos({});
          setError(
            problema instanceof Error
              ? problema.message
              : "No se pudieron cargar las fotos",
          );
        }
      });
    return () => {
      vigente = false;
    };
  }, [visitaId, tareaId, intento]);

  async function actualizar(momento: MomentoFoto, archivo?: File) {
    if (operacion) return;
    if (!archivo && !confirm("¿Eliminar esta foto?")) return;
    setOperacion(archivo ? "Preparando foto" : "Eliminando foto");
    setError("");
    try {
      if (archivo) {
        const preparada = await prepararImagen(archivo);
        setOperacion("Subiendo foto");
        const cuerpo = new FormData();
        cuerpo.append("momento", momento);
        cuerpo.append("foto", preparada);
        const resultado = await enviarAccionTarea<FotoTarea>(
          usuario.id,
          ruta,
          `Foto ${momento.toLowerCase()} de tarea`,
          cuerpo,
        );
        if (resultado.pendiente) {
          const anterior = previewsRef.current[momento];
          if (anterior) URL.revokeObjectURL(anterior);
          const url = URL.createObjectURL(preparada);
          previewsRef.current = { ...previewsRef.current, [momento]: url };
          setPreviews({ ...previewsRef.current });
          mostrarToast(
            "exito",
            "Foto guardada en este dispositivo, pendiente de envío",
          );
          return;
        }
        const foto = resultado.resultado;
        if (!foto) throw new Error("No se recibió la confirmación de la foto");
        setFotos((actuales) => ({
          ...actuales,
          [momento === "ANTES" ? "antes" : "despues"]: foto,
        }));
      } else {
        await eliminarFoto(visitaId, tareaId, momento);
        setFotos((actuales) => ({
          ...actuales,
          [momento === "ANTES" ? "antes" : "despues"]: undefined,
        }));
      }
      mostrarToast("exito", archivo ? "Foto guardada" : "Foto eliminada");
      onFotosActualizadas();
    } catch (problema) {
      setError(
        problema instanceof Error
          ? problema.message
          : "No se pudo guardar el cambio",
      );
    } finally {
      setOperacion("");
    }
  }

  return (
    <div className="space-y-3 text-foreground">
      <PantallaCarga visible={!!operacion} mensaje={operacion} />
      {camaraMomento && (
        <CapturadorCamara
          onCapturar={(archivo) => void actualizar(camaraMomento, archivo)}
          onCerrar={() => setCamaraMomento(null)}
        />
      )}
      <p className="text-sm text-muted">
        {obligatorio
          ? "Subí ambas fotos antes de completar la tarea."
          : "Podés adjuntar fotos del antes y del después."}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
      {!fotos ? (
        error ? (
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line px-4 hover:bg-surface-soft"
            onClick={() => setIntento((n) => n + 1)}
          >
            Reintentar
          </button>
        ) : (
          <p role="status" className="py-6 text-sm text-muted">
            Cargando fotos…
          </p>
        )
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-3">
          {(["ANTES", "DESPUES"] as const).map((momento) => {
            const foto = momento === "ANTES" ? fotos.antes : fotos.despues;
            const nombre = momento === "ANTES" ? "Antes" : "Después";
            return (
              <div
                key={momento}
                className="min-w-0 rounded-lg border border-line bg-surface-raised p-2 sm:p-3"
              >
                <h3 className="mb-2 text-sm font-semibold">{nombre}</h3>
                {previews[momento] ? (
                  <div className="space-y-1">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Pendiente de envío
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previews[momento]}
                      alt={`Foto ${nombre.toLowerCase()} guardada en este dispositivo`}
                      className="h-32 w-full rounded object-cover sm:h-44"
                    />
                  </div>
                ) : foto ? (
                  // Las fotos privadas se sirven con la cookie de sesión.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      obtenerUrlFoto(foto.id) +
                      "?v=" +
                      encodeURIComponent(foto.creadoAt)
                    }
                    alt={"Foto " + nombre.toLowerCase()}
                    className="h-32 w-full rounded object-cover sm:h-44"
                  />
                ) : (
                  <div className="grid h-32 place-items-center rounded bg-surface-soft text-xs text-muted sm:h-44">
                    Sin foto
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    ref={(elemento) => {
                      galeriaRef.current[momento] = elemento;
                    }}
                    type="file"
                    accept="image/*"
                    aria-label={`Elegir foto ${nombre.toLowerCase()} de la galería`}
                    disabled={!!operacion}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) void actualizar(momento, archivo);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Elegir foto ${nombre.toLowerCase()} de la galería`}
                    title="Galería"
                    disabled={!!operacion}
                    onClick={() => galeriaRef.current[momento]?.click()}
                    className="grid h-11 min-w-0 place-items-center rounded-md border border-line bg-surface-raised text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <IconoGaleria className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Tomar foto ${nombre.toLowerCase()} con la cámara`}
                    title="Cámara"
                    disabled={!!operacion}
                    onClick={() => setCamaraMomento(momento)}
                    className="grid h-11 min-w-0 place-items-center rounded-md border border-line bg-surface-raised text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <IconoCamara className="h-5 w-5" />
                  </button>
                </div>
                {foto && !obligatorio && (
                  <button
                    type="button"
                    disabled={!!operacion}
                    className="mt-1 min-h-11 w-full rounded-md text-sm text-red-700 hover:bg-surface-soft dark:text-red-300"
                    onClick={() => void actualizar(momento)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
