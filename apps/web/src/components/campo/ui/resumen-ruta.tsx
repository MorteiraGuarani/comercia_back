import { TOKENS } from "../tokens";

interface ResumenRutaProps {
  total: number | string;
  visitadas: number;
  enCurso: number;
  pendientes: number;
  incompletas?: number;
  ausentes?: number;
  porPagina?: boolean;
}

export function ResumenRuta({
  total,
  visitadas,
  enCurso,
  pendientes,
  incompletas = 0,
  ausentes = 0,
  porPagina = false,
}: ResumenRutaProps) {
  const metricas = [
    { etiqueta: "Locales", valor: total, color: TOKENS.ink },
    { etiqueta: "Presentes", valor: visitadas, color: TOKENS.fresco },
    { etiqueta: "En curso", valor: enCurso, color: TOKENS.frio },
    { etiqueta: "Pendientes", valor: pendientes, color: TOKENS.sub },
  ];
  return (
    <div className="campo-screen min-w-0 rounded-lg border border-line bg-surface-raised px-3 py-2 dark:border-line dark:bg-surface-raised">
      <dl
        aria-label="Resumen de la ruta"
        className="grid grid-cols-4 gap-x-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6"
      >
        {metricas.map((m, i) => (
          <div
            key={m.etiqueta}
            className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
          >
            <dt
              className="ft-body text-[11px] leading-tight text-muted sm:text-xs"
              title={
                porPagina && i > 0 ? `${m.etiqueta} en esta página` : m.etiqueta
              }
            >
              {m.etiqueta}
              {porPagina && i > 0 ? (
                <span className="sr-only"> en esta página</span>
              ) : null}
            </dt>
            <dd
              className="ft-display text-xl font-semibold leading-none tabular-nums"
              style={{ color: m.color }}
            >
              {m.valor}
            </dd>
          </div>
        ))}
      </dl>
      {incompletas > 0 || ausentes > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-xs dark:border-line">
          {incompletas > 0 ? (
            <span style={{ color: TOKENS.alerta }}>
              {incompletas} incompletas
            </span>
          ) : null}
          {ausentes > 0 ? (
            <span style={{ color: TOKENS.critico }}>{ausentes} ausentes</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
