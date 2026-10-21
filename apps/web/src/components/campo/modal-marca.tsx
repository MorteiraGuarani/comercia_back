"use client";
import { EstadoTelefono } from "./estado-telefono";
import type { MarcacionPendiente } from "@/types/seguimiento";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, errorBox } from "@/components/ui";
import { BotonesFormulario, CampoTexto } from "./form-campo";
import type { MarcaCampo } from "@/types/campo";
import { obtenerPosicionPrecisa } from "@/lib/gps-preciso";

// Modal para marcar entrada o salida en un local de la ruta.

export function ModalMarca({
  nombre,
  radioMetros,
  salida,
  usarTelefonoUcheck,
  cerrar,
  guardar,
  alConfirmarPendiente,
}: {
  nombre: string;
  radioMetros: number;
  salida: boolean;
  usarTelefonoUcheck: boolean;
  cerrar: () => void;
  guardar: (
    datos: MarcaCampo | { nota: string },
  ) => Promise<void | MarcacionPendiente>;
  alConfirmarPendiente: () => void;
}) {
  const op = useOperacionCampo();
  const [coords, setCoords] = useState<Omit<MarcaCampo, "nota"> | null>(null);
  const [nota, setNota] = useState("");
  const [pendiente, setPendiente] = useState<MarcacionPendiente | null>(null);
  // La API exige ±50 m o mejor (o el radio del local): se escucha el GPS
  // hasta 10 s y se manda la lectura más precisa, no la primera.
  async function obtenerGps(): Promise<Omit<MarcaCampo, "nota">> {
    const p = await obtenerPosicionPrecisa({ objetivoMetros: 15, maxMs: 10_000 });
    return {
      latitud: p.coords.latitude,
      longitud: p.coords.longitude,
      precisionMetros: p.coords.accuracy,
      capturadaEn: new Date(p.timestamp).toISOString(),
    };
  }
  async function ubicar() {
    await op.ejecutar("Obteniendo ubicación", async () => {
      setCoords(await obtenerGps());
    });
  }
  return (
    <Modal
      titulo={`${salida ? "Salida" : "Entrada"} · ${nombre}`}
      abierto
      onCerrar={() => {
        if (!op.mensaje) cerrar();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pendiente) {
            await op.ejecutar(
              "Consultando la confirmación de la marcación",
              async () => {
                const estado = await apiFetch<{
                  estado: string;
                  mensaje: string;
                }>(
                  `/campo/jornada/repositor/operaciones/${pendiente.operacionId}`,
                );
                if (estado.estado === "CONFIRMADA") alConfirmarPendiente();
                else setPendiente({ ...pendiente, mensaje: estado.mensaje });
              },
            );
            return;
          }
          await op.ejecutar(
            usarTelefonoUcheck
              ? "Consultando el teléfono en Ucheck y registrando la visita…"
              : "Obteniendo ubicación y registrando presencia…",
            async () => {
              if (usarTelefonoUcheck) {
                const resultado = await guardar({ nota });
                if (resultado?.estado === "PENDIENTE") setPendiente(resultado);
                return;
              }
              const posicion = await obtenerGps();
              setCoords(posicion);
              await guardar({ ...posicion, nota });
            },
          );
        }}
      >
        {!usarTelefonoUcheck ? (
          <button
            type="button"
            className={`${btnGhost} w-full`}
            onClick={() => void ubicar()}
          >
            Obtener mi ubicación
          </button>
        ) : null}
        {usarTelefonoUcheck ? (
          <div className="rounded-xl border border-line bg-surface-soft p-4 text-sm text-foreground">
            <EstadoTelefono />
            <p className="font-semibold">Antes de confirmar en Comercia</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Abrí Ucheck en el teléfono con tu cuenta de repositor.</li>
              <li>
                Esperá el estado “Ubicación confirmada”. Si está pendiente, tocá
                “Actualizar ubicación”.
              </li>
              <li>
                Mantené Ucheck abierta en segundo plano durante la visita.
              </li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {coords
              ? `Ubicación obtenida: ${coords.latitud.toFixed(5)}, ${coords.longitud.toFixed(5)} · precisión ±${Math.round(coords.precisionMetros)} m`
              : "Se necesita GPS para marcar. Al confirmar se obtendrá una ubicación nueva."}
          </p>
        )}
        <p className="text-sm text-muted">
          Radio permitido: {radioMetros} m desde el local.
        </p>
        <CampoTexto
          titulo="Observación (opcional)"
          maxLength={250}
          value={nota}
          onChange={setNota}
        />
        {op.error ? (
          <p role="alert" className={errorBox}>
            {op.error}
          </p>
        ) : null}
        {pendiente ? (
          <p
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            {pendiente.mensaje}
          </p>
        ) : null}
        <BotonesFormulario ocupado={!!op.mensaje} cancelar={cerrar}>
          {pendiente
            ? "Consultar confirmación"
            : `Confirmar ${salida ? "salida" : "entrada"}`}
        </BotonesFormulario>
      </form>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
