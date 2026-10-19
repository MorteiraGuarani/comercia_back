"use client";
import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { leerCatalogo, sincronizarCatalogo } from "@/lib/inventario-db";
import { useToast } from "@/components/toast/toast-provider";
import { catalogoDesactualizado } from "@/utils/inventario";
import { mensajeError } from "@/utils/error";
import { useEnLinea } from "@/hooks/use-en-linea";
import type { CatalogoInventarioLocal } from "@/types/inventario";

const TOAST_CATALOGO = "inventario-catalogo";
const TOAST_CONEXION = "inventario-conexion";

interface LecturaCatalogo {
  catalogo: CatalogoInventarioLocal | null;
  error: string | null;
}

// Copia local del catálogo de la empresa: se descarga si falta o si es de otro día,
// apenas hay conexión, y también a pedido del usuario. El estado se informa
// con toasts para no ocupar lugar en la página.
export function useCatalogoInventario(empresaId: number) {
  const enLinea = useEnLinea();
  const { mostrarToast, cerrarToastPorClave } = useToast();
  const lectura = useLiveQuery<LecturaCatalogo>(async () => {
    try {
      return { catalogo: await leerCatalogo(empresaId), error: null };
    } catch (error) {
      return {
        catalogo: null,
        error: mensajeError(error, "Este navegador no permite guardar datos sin conexión"),
      };
    }
  }, [empresaId]);
  const [actualizando, setActualizando] = useState(false);
  const [bloqueante, setBloqueante] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizar = useCallback(
    async (aPedido = false) => {
      setActualizando(true);
      setBloqueante(aPedido);
      setError(null);
      const anterior = await leerCatalogo(empresaId).catch(() => null);
      try {
        const catalogo = await sincronizarCatalogo(empresaId);
        // La renovación diaria en segundo plano no interrumpe si sale bien.
        if (aPedido || !anterior)
          mostrarToast({
            tipo: "exito",
            clave: TOAST_CATALOGO,
            titulo: "Artículos actualizados",
            mensaje: `${catalogo.articulos.toLocaleString("es-PY")} artículos y ${catalogo.total.toLocaleString("es-PY")} precios por lista guardados en este equipo.`,
          });
      } catch (problema) {
        const mensaje = mensajeError(problema, "No se pudieron actualizar los artículos");
        setError(mensaje);
        mostrarToast({
          tipo: anterior ? "alerta" : "error",
          clave: TOAST_CATALOGO,
          titulo: "No se pudieron actualizar los artículos",
          mensaje: anterior ? `${mensaje}. Seguís usando la copia guardada.` : mensaje,
        });
      } finally {
        setActualizando(false);
        setBloqueante(false);
      }
    },
    [empresaId, mostrarToast],
  );

  const errorAlmacenamiento = lectura?.error ?? null;
  const leida = lectura !== undefined && errorAlmacenamiento === null;
  const sincronizadoEn = lectura?.catalogo?.sincronizadoEn;
  useEffect(() => {
    // Un fallo no reintenta en bucle: vuelve a probar al recuperar la conexión.
    if (!leida || !enLinea || !catalogoDesactualizado(sincronizadoEn, Date.now()))
      return;
    const temporizador = setTimeout(() => void actualizar(), 0);
    return () => clearTimeout(temporizador);
  }, [leida, enLinea, sincronizadoEn, actualizar]);

  useEffect(() => {
    if (enLinea) return;
    mostrarToast({
      tipo: "alerta",
      clave: TOAST_CONEXION,
      titulo: "Sin conexión",
      mensaje: "Usás los artículos guardados en este equipo.",
    });
    return () => cerrarToastPorClave(TOAST_CONEXION);
  }, [enLinea, mostrarToast, cerrarToastPorClave]);

  useEffect(() => {
    if (!errorAlmacenamiento) return;
    mostrarToast({
      tipo: "error",
      clave: TOAST_CATALOGO,
      titulo: "No se pueden guardar artículos",
      mensaje: `Este navegador no permite guardar datos sin conexión: ${errorAlmacenamiento}`,
    });
  }, [errorAlmacenamiento, mostrarToast]);

  return {
    catalogo: lectura?.catalogo ?? null,
    leyendo: lectura === undefined,
    errorAlmacenamiento,
    enLinea,
    actualizando,
    bloqueante,
    error,
    actualizar,
  };
}
