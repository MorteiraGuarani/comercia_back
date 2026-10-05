"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PantallaCarga } from "@/components/pantalla-carga";
import type { VinculoUcheckAdmin } from "@/types/vinculo-ucheck";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";

export function VinculoUcheck({ usuarioId }: { usuarioId: number }) {
  const [datos, setDatos] = useState<VinculoUcheckAdmin | null>(null);
  const [error, setError] = useState("");
  const [operacion, setOperacion] = useState("Comprobando la cuenta de Ucheck");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    void apiFetch<VinculoUcheckAdmin>(`/admin/usuarios-ucheck/${usuarioId}`)
      .then((r) => {
        if (vigente) {
          setDatos(r);
          setError("");
        }
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error ? e.message : "No se pudo comprobar Ucheck",
          );
      })
      .finally(() => {
        if (vigente) setOperacion("");
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId, revision]);
  async function cambiar(vincular: boolean) {
    if (operacion) return;
    setOperacion(vincular ? "Vinculando las cuentas" : "Desvinculando Ucheck");
    setError("");
    try {
      await apiFetch(`/admin/usuarios-ucheck/${usuarioId}`, {
        method: vincular ? "POST" : "DELETE",
        ...(vincular
          ? { body: JSON.stringify({ ucheckUsuarioId: datos?.candidata?.id }) }
          : {}),
      });
      setRevision((r) => r + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el vínculo",
      );
    } finally {
      setOperacion("");
    }
  }
  return (
    <section className="space-y-2 rounded-xl border border-line bg-surface-soft p-3 text-sm text-foreground">
      <PantallaCarga visible={!!operacion} mensaje={operacion} />
      <h3 className="font-semibold">Vinculación con Ucheck</h3>
      <p className="text-xs text-muted">
        Guardá primero el correo correcto en ambas plataformas. Después comprobá
        y vinculá la cuenta. El vínculo utiliza un identificador estable.
      </p>
      <p>
        {datos?.vinculo
          ? `Vinculada con Ucheck #${datos.vinculo.ucheckUsuarioId}`
          : "Cuenta aún sin vínculo confirmado"}
      </p>
      {datos?.candidata ? (
        <div className="rounded-lg border border-line bg-surface-raised p-3">
          <p className="font-semibold">{datos.candidata.nombre}</p>
          <p className="break-all text-muted">{datos.candidata.correo}</p>
          <p className="text-xs text-muted">
            Empresa: {datos.candidata.empresa ?? "Sin empresa"} · ID:{" "}
            {datos.candidata.id}
          </p>
          <p className="text-xs text-muted">
            Programas:{" "}
            {datos.candidata.programas.join(", ") || "Sin programa de campo"}
          </p>
          <p>
            {datos.candidata.activa ? "Cuenta activa" : "Cuenta deshabilitada"}
          </p>
        </div>
      ) : null}
      {error || datos?.error ? (
        <p role="alert" className={errorBox}>
          {error || datos?.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!operacion}
          className={btnGhost}
          onClick={() => {
            setOperacion("Comprobando la cuenta de Ucheck");
            setRevision((r) => r + 1);
          }}
        >
          Comprobar
        </button>
        {!datos?.vinculo && datos?.candidata?.activa ? (
          <button
            type="button"
            disabled={!!operacion}
            className={btnPrimary}
            onClick={() => void cambiar(true)}
          >
            Vincular esta cuenta
          </button>
        ) : null}
        {datos?.vinculo ? (
          <button
            type="button"
            disabled={!!operacion}
            className={btnGhost}
            onClick={() => {
              if (
                confirm(
                  "¿Desvincular Ucheck? Las visitas deben estar cerradas. Un administrador deberá volver a vincular la cuenta.",
                )
              )
                void cambiar(false);
            }}
          >
            Desvincular
          </button>
        ) : null}
      </div>
    </section>
  );
}
