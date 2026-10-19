"use client";

import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { IconoMegafono, IconoContacto, IconoCheck } from "./ui/iconos-campo";
import { GaleriaAdjuntosCampo } from "./galeria-adjuntos-campo";
import { formatearFechaAviso as formatearFecha } from "@/utils/aviso";
import type { AvisoEnviadoItem, AvisoRecibidoItem } from "@/types/campo";

/** Avisos que mandó el líder, con cuántos destinatarios ya los leyeron. */
export function BandejaAvisosEnviados({
  enviados,
  onRedactar,
}: {
  enviados: AvisoEnviadoItem[];
  onRedactar: () => void;
}) {
  return (
    <div className="space-y-4">
      {enviados.length === 0 ? (
        <div
          className="rounded-xl border p-5 text-center sm:p-12"
          style={{
            backgroundColor: TOKENS.canvas,
            borderColor: TOKENS.line,
          }}
        >
          <p className="text-base font-bold text-foreground mb-1">
            No hay avisos enviados aún
          </p>
          <p className="text-xs text-muted mb-4">
            Envía el primer comunicado a tu equipo de impulsadores de
            campo.
          </p>
          <button
            type="button"
            onClick={onRedactar}
            aria-label="Crear comunicado"
            title="Crear comunicado"
            className="inline-grid h-11 w-11 place-items-center rounded-lg text-background"
            style={{ backgroundColor: TOKENS.ink }}
          >
            <span aria-hidden="true" className="text-xl">
              +
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {enviados.map((aviso) => {
            const total = aviso.total ?? 1;
            const leidos = aviso.leidoPor ?? (aviso.leido ? 1 : 0);
            const todoLeido = total > 0 && leidos >= total;
            const parcialLeido = leidos > 0 && leidos < total;

            return (
              <div
                key={aviso.id}
                className="min-w-0 rounded-xl border p-3 transition-all hover:shadow-sm sm:p-4"
                style={{
                  backgroundColor: TOKENS.canvas,
                  borderColor: TOKENS.line,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor:
                          aviso.tipo === "EQUIPO"
                            ? "var(--accent-soft)"
                            : TOKENS.bone,
                        color:
                          aviso.tipo === "EQUIPO"
                            ? TOKENS.frio
                            : TOKENS.carne,
                      }}
                    >
                      {aviso.tipo === "EQUIPO" ? (
                        <>
                          <IconoMegafono className="w-3 h-3" />
                          <span>TODO EL EQUIPO</span>
                        </>
                      ) : (
                        <>
                          <IconoContacto className="w-3 h-3" />
                          <span className="min-w-0 truncate">
                            {aviso.tipo === "SELECCION"
                              ? `${aviso.total ?? 0} DESTINATARIOS`
                              : `DIRECTO A ${aviso.destinatario?.nombre ?? "COLABORADOR"}`}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {formatearFecha(aviso.creadoAt)}
                    </span>
                  </div>

                  {/* Status Stamp de lectura */}
                  <StatusStamp
                    tone={
                      todoLeido
                        ? "fresco"
                        : parcialLeido
                          ? "alerta"
                          : "critico"
                    }
                    size="sm"
                  >
                    {aviso.tipo !== "INDIVIDUAL"
                      ? `${leidos}/${total} LEÍDOS`
                      : aviso.leido
                        ? "LEÍDO"
                        : "PENDIENTE"}
                  </StatusStamp>
                </div>

                <p className="mb-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {aviso.mensaje}
                </p>

                <GaleriaAdjuntosCampo adjuntos={aviso.adjuntos} />

                <div
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted"
                  style={{ borderColor: TOKENS.line }}
                >
                  <span className="min-w-0 break-words font-mono text-[11px]">
                    {aviso.tipo === "EQUIPO"
                      ? `Alcance: ${total} colaboradores asignados`
                      : aviso.tipo === "SELECCION"
                        ? `Destinatarios: ${aviso.destinatarios?.map((persona) => `${persona.nombre} ${persona.apellido}`).join(", ") || `${total} colaboradores`}`
                        : `Destinatario: ${aviso.destinatario?.nombre} ${aviso.destinatario?.apellido || ""}`}
                  </span>

                  {aviso.tipo === "INDIVIDUAL" && aviso.leidoAt && (
                    <span className="min-w-0 break-words font-mono text-[11px] text-accent-ink">
                      Leído el {formatearFecha(aviso.leidoAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Avisos recibidos, con el acuse de lectura. */
export function BandejaAvisosRecibidos({
  recibidos,
  onMarcarLeido,
}: {
  recibidos: AvisoRecibidoItem[];
  onMarcarLeido: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {recibidos.length === 0 ? (
        <div
          className="rounded-xl border p-5 text-center sm:p-12"
          style={{
            backgroundColor: TOKENS.canvas,
            borderColor: TOKENS.line,
          }}
        >
          <p className="text-base font-bold text-foreground mb-1">
            Bandeja de avisos al día
          </p>
          <p className="text-xs text-muted">
            No tienes comunicados pendientes en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {recibidos.map((aviso) => {
            const noLeido = !aviso.leido;

            return (
              <div
                key={aviso.id}
                className={`min-w-0 rounded-xl border p-3 transition-all sm:p-4 ${
                  noLeido
                    ? "bg-surface-raised shadow-sm ring-1 ring-[#C1752B]/40"
                    : "opacity-90"
                }`}
                style={{
                  backgroundColor: TOKENS.canvas,
                  borderColor: noLeido ? TOKENS.alerta : TOKENS.line,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor:
                          aviso.tipo === "EQUIPO"
                            ? "var(--accent-soft)"
                            : TOKENS.bone,
                        color:
                          aviso.tipo === "EQUIPO"
                            ? TOKENS.frio
                            : TOKENS.carne,
                      }}
                    >
                      {aviso.tipo === "EQUIPO" ? (
                        <>
                          <IconoMegafono className="w-3 h-3" />
                          <span>COMUNICADO GENERAL</span>
                        </>
                      ) : (
                        <>
                          <IconoContacto className="w-3 h-3" />
                          <span>MENSAJE DIRECTO</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {formatearFecha(aviso.creadoAt)}
                    </span>
                  </div>

                  <StatusStamp
                    tone={noLeido ? "alerta" : "fresco"}
                    size="sm"
                  >
                    {noLeido ? "NO LEÍDO" : "LEÍDO"}
                  </StatusStamp>
                </div>

                <div className="mb-2">
                  <span className="text-xs font-bold text-muted">
                    De: {aviso.emisor.nombre}{" "}
                    {aviso.emisor.apellido || ""}
                  </span>
                </div>

                <p className="mb-4 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground">
                  {aviso.mensaje}
                </p>

                <GaleriaAdjuntosCampo adjuntos={aviso.adjuntos} />

                <div
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2.5"
                  style={{ borderColor: TOKENS.line }}
                >
                  <span className="min-w-0 break-words font-mono text-xs text-muted">
                    {aviso.leido && aviso.leidoAt
                      ? `Confirmado: ${formatearFecha(aviso.leidoAt)}`
                      : "Pendiente de acuse de recibo"}
                  </span>

                  {noLeido && (
                    <button
                      type="button"
                      onClick={() => onMarcarLeido(aviso.id)}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-100"
                    >
                      <IconoCheck className="w-3.5 h-3.5" />
                      <span>Marcar leído</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
