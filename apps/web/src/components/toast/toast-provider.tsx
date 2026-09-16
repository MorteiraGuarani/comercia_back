"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  TipoToast,
  ToastContexto,
  ToastEntrada,
  ToastItem,
} from "@/types/toast";
import { registrarListenerToast } from "./toast-controller";

const DURACION_EXITO_MS = 7_000;
const ContextoToast = createContext<ToastContexto | null>(null);

const estilos: Record<
  TipoToast,
  { contenedor: string; icono: string; titulo: string }
> = {
  exito: {
    contenedor:
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50",
    icono:
      "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
    titulo: "Listo",
  },
  error: {
    contenedor:
      "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-50",
    icono: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950",
    titulo: "No se pudo completar",
  },
  alerta: {
    contenedor:
      "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
    icono: "bg-amber-500 text-amber-950 dark:bg-amber-400",
    titulo: "Atención",
  },
  info: {
    contenedor:
      "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-50",
    icono: "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
    titulo: "Información",
  },
};

function IconoToast({ tipo }: { tipo: TipoToast }) {
  if (tipo === "exito") {
    return (
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    );
  }

  if (tipo === "info") {
    return (
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 10-1.5 0 .75.75 0 001.5 0zM10 8.5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 8.5z"
        clipRule="evenodd"
      />
    );
  }

  return (
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l5.58 9.92C18.073 14.352 17.11 16 15.58 16H4.42c-1.532 0-2.493-1.648-1.743-2.981l5.58-9.92zM10 6.75a.75.75 0 01.75.75v2.75a.75.75 0 01-1.5 0V7.5a.75.75 0 01.75-.75zm0 6.5a.875.875 0 100-1.75.875.875 0 000 1.75z"
      clipRule="evenodd"
    />
  );
}

function Toast({
  toast,
  onCerrar,
}: {
  toast: ToastItem;
  onCerrar: (id: number) => void;
}) {
  const estilo = estilos[toast.tipo];
  const esUrgente = toast.tipo === "error" || toast.tipo === "alerta";

  return (
    <div
      role={esUrgente ? "alert" : "status"}
      aria-live={esUrgente ? "assertive" : "polite"}
      aria-atomic="true"
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-3.5 shadow-[0_18px_55px_rgba(var(--warm-shadow),0.24)] sm:p-4 ${estilo.contenedor}`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${estilo.icono}`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden
        >
          <IconoToast tipo={toast.tipo} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">
          {toast.titulo ?? estilo.titulo}
        </p>
        <p className="mt-0.5 break-words text-sm leading-relaxed opacity-90">
          {toast.mensaje}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onCerrar(toast.id)}
        aria-label="Cerrar mensaje"
        title="Cerrar"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl opacity-70 transition hover:bg-black/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M5.22 5.22a.75.75 0 011.06 0L10 8.94l3.72-3.72a.75.75 0 111.06 1.06L11.06 10l3.72 3.72a.75.75 0 11-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 01-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const siguienteId = useRef(0);
  const temporizadores = useRef(new Map<number, number>());
  const idsPorClave = useRef(new Map<string, number>());
  const clavesPorId = useRef(new Map<number, string>());

  const cerrarToast = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador !== undefined) {
      window.clearTimeout(temporizador);
      temporizadores.current.delete(id);
    }
    const clave = clavesPorId.current.get(id);
    if (clave && idsPorClave.current.get(clave) === id) {
      idsPorClave.current.delete(clave);
    }
    clavesPorId.current.delete(id);
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (entrada: ToastEntrada) => {
      if (entrada.clave) {
        const anterior = idsPorClave.current.get(entrada.clave);
        if (anterior !== undefined) cerrarToast(anterior);
      }
      siguienteId.current += 1;
      const id = siguienteId.current;
      setToasts((actuales) => [...actuales, { ...entrada, id }]);
      if (entrada.clave) {
        idsPorClave.current.set(entrada.clave, id);
        clavesPorId.current.set(id, entrada.clave);
      }

      if (entrada.tipo === "exito") {
        const temporizador = window.setTimeout(
          () => cerrarToast(id),
          DURACION_EXITO_MS,
        );
        temporizadores.current.set(id, temporizador);
      }

      return id;
    },
    [cerrarToast],
  );

  const cerrarToastPorClave = useCallback(
    (clave: string) => {
      const id = idsPorClave.current.get(clave);
      if (id !== undefined) cerrarToast(id);
    },
    [cerrarToast],
  );

  useEffect(() => {
    const activos = temporizadores.current;
    return () => {
      activos.forEach((temporizador) => window.clearTimeout(temporizador));
      activos.clear();
    };
  }, []);

  useEffect(() => {
    return registrarListenerToast((t) => {
      mostrarToast(t);
    });
  }, [mostrarToast]);

  const valor = useMemo(
    () => ({ mostrarToast, cerrarToast, cerrarToastPorClave }),
    [cerrarToast, cerrarToastPorClave, mostrarToast],
  );

  return (
    <ContextoToast.Provider value={valor}>
      {children}
      <div
        aria-label="Mensajes del sistema"
        className="pointer-events-none fixed inset-x-3 top-3 z-[6000] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:top-5 sm:w-full sm:max-w-md"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onCerrar={cerrarToast} />
        ))}
      </div>
    </ContextoToast.Provider>
  );
}

export function useToast(): ToastContexto {
  const contexto = useContext(ContextoToast);
  if (!contexto) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return contexto;
}
