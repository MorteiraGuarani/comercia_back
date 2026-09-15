"use client";

import { useState } from "react";
import { subirFoto, eliminarFoto, obtenerUrlFoto } from "@/lib/api-tareas";
import type { MomentoFoto, FotoTarea } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";

interface SubidorFotosProps {
  visitaId: number;
  tareaId: number;
  fotoAntes?: FotoTarea;
  fotoDespues?: FotoTarea;
  obligatorio: boolean;
  onFotosActualizadas: () => void;
}

export function SubidorFotos({
  visitaId,
  tareaId,
  fotoAntes,
  fotoDespues,
  obligatorio,
  onFotosActualizadas,
}: SubidorFotosProps) {
  const [subiendo, setSubiendo] = useState<MomentoFoto | null>(null);

  const handleSubir = async (momento: MomentoFoto, archivo: File) => {
    // Validar tamaño
    if (archivo.size > 5 * 1024 * 1024) {
      mostrarToast("error", "La imagen no puede superar 5 MB");
      return;
    }

    // Validar tipo
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
      mostrarToast("error", "Solo se permiten imágenes JPG, PNG o WebP");
      return;
    }

    setSubiendo(momento);
    try {
      await subirFoto(visitaId, tareaId, momento, archivo);
      mostrarToast("exito", `Foto ${momento.toLowerCase()} subida correctamente`);
      onFotosActualizadas();
    } catch (error) {
      mostrarToast("error", error instanceof Error ? error.message : "Error al subir foto");
    } finally {
      setSubiendo(null);
    }
  };

  const handleEliminar = async (momento: MomentoFoto) => {
    if (obligatorio) {
      mostrarToast("error", "No puedes eliminar fotos obligatorias");
      return;
    }

    if (!confirm(`¿Eliminar foto ${momento.toLowerCase()}?`)) return;

    try {
      await eliminarFoto(visitaId, tareaId, momento);
      mostrarToast("exito", "Foto eliminada");
      onFotosActualizadas();
    } catch (error) {
      mostrarToast("error", error instanceof Error ? error.message : "Error al eliminar foto");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Foto ANTES */}
      <TarjetaFoto
        momento="ANTES"
        foto={fotoAntes}
        subiendo={subiendo === "ANTES"}
        obligatorio={obligatorio}
        onSubir={(archivo) => handleSubir("ANTES", archivo)}
        onEliminar={() => handleEliminar("ANTES")}
      />

      {/* Foto DESPUÉS */}
      <TarjetaFoto
        momento="DESPUES"
        foto={fotoDespues}
        subiendo={subiendo === "DESPUES"}
        obligatorio={obligatorio}
        onSubir={(archivo) => handleSubir("DESPUES", archivo)}
        onEliminar={() => handleEliminar("DESPUES")}
      />
    </div>
  );
}

interface TarjetaFotoProps {
  momento: MomentoFoto;
  foto?: FotoTarea;
  subiendo: boolean;
  obligatorio: boolean;
  onSubir: (archivo: File) => void;
  onEliminar: () => void;
}

function TarjetaFoto({
  momento,
  foto,
  subiendo,
  obligatorio,
  onSubir,
  onEliminar,
}: TarjetaFotoProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      onSubir(archivo);
    }
    e.target.value = "";
  };

  const labelMomento = momento === "ANTES" ? "Antes" : "Después";

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Foto {labelMomento}
          {obligatorio && <span className="text-red-500 ml-1">*</span>}
        </h3>
        {foto && !obligatorio && (
          <button
            type="button"
            onClick={onEliminar}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
            aria-label={`Eliminar foto ${labelMomento.toLowerCase()}`}
          >
            Eliminar
          </button>
        )}
      </div>

      {foto ? (
        <div className="space-y-3">
          <img
            src={obtenerUrlFoto(foto.id)}
            alt={`Foto ${labelMomento.toLowerCase()}`}
            className="w-full h-48 object-cover rounded border border-gray-200 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(foto.creadoAt).toLocaleString("es-PY")}
            {" · "}
            {(foto.tamanioBytes / 1024).toFixed(0)} KB
          </p>
          <label className="block">
            <span className="sr-only">Cambiar foto {labelMomento.toLowerCase()}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChange}
              disabled={subiendo}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900 dark:file:text-blue-300
                hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
            {subiendo ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Subiendo...</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin foto</p>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Subir foto {labelMomento.toLowerCase()}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChange}
              disabled={subiendo}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900 dark:file:text-blue-300
                hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
