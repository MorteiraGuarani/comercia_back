import { apiFetch, API_URL, ApiError } from "./api";
import type {
  ComentarioTarea,
  FormComentarioTarea,
  FotosTareaResponse,
  MomentoFoto,
  FotoTarea,
  Notificacion,
  ContadorNoLeidas,
} from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

// ========== COMENTARIOS ==========

export async function crearComentario(
  visitaId: number,
  tareaId: number,
  form: FormComentarioTarea,
): Promise<ComentarioTarea> {
  return apiFetch<ComentarioTarea>(
    `/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/comentarios`,
    {
      method: "POST",
      body: JSON.stringify(form),
    },
  );
}

export async function listarComentarios(
  visitaId: number,
  tareaId: number,
): Promise<ComentarioTarea[]> {
  return apiFetch<ComentarioTarea[]>(
    `/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/comentarios`,
  );
}

export async function marcarComentarioLeido(
  comentarioId: number,
): Promise<ComentarioTarea> {
  return apiFetch<ComentarioTarea>(
    `/campo/jornada/comentarios/${comentarioId}/marcar-leido`,
    {
      method: "PUT",
    },
  );
}

// ========== FOTOS ==========

export async function subirFoto(
  visitaId: number,
  tareaId: number,
  momento: MomentoFoto,
  archivo: File,
): Promise<FotoTarea> {
  const formData = new FormData();
  formData.append("momento", momento);
  formData.append("foto", archivo);

  const res = await fetch(
    `${API_URL}/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/fotos`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const mensaje =
      data?.message ?? `Error ${res.status} al subir la foto`;
    throw new ApiError(res.status, mensaje);
  }

  return res.json();
}

export async function obtenerFotos(
  visitaId: number,
  tareaId: number,
): Promise<FotosTareaResponse> {
  return apiFetch<FotosTareaResponse>(
    `/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/fotos`,
  );
}

export function obtenerUrlFoto(fotoId: number): string {
  return `${API_URL}/campo/fotos/${fotoId}`;
}

export async function eliminarFoto(
  visitaId: number,
  tareaId: number,
  momento: MomentoFoto,
): Promise<void> {
  return apiFetch<void>(
    `/campo/jornada/visitas/${visitaId}/tareas/${tareaId}/fotos/${momento}`,
    {
      method: "DELETE",
    },
  );
}

// ========== NOTIFICACIONES ==========

export async function listarNotificaciones(
  page = 1,
  limit = 7,
  leido?: boolean,
): Promise<RespuestaPaginada<Notificacion>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (leido !== undefined) {
    params.append("leido", String(leido));
  }
  return apiFetch<RespuestaPaginada<Notificacion>>(
    `/campo/notificaciones?${params}`,
  );
}

export async function marcarNotificacionLeida(
  notificacionId: number,
): Promise<Notificacion> {
  return apiFetch<Notificacion>(
    `/campo/notificaciones/${notificacionId}/marcar-leida`,
    {
      method: "PUT",
    },
  );
}

export async function marcarTodasNotificacionesLeidas(): Promise<{ marcadas: number }> {
  return apiFetch<{ marcadas: number }>(
    `/campo/notificaciones/marcar-todas-leidas`,
    {
      method: "PUT",
    },
  );
}

export async function obtenerContadorNoLeidas(): Promise<ContadorNoLeidas> {
  return apiFetch<ContadorNoLeidas>(
    `/campo/notificaciones/contador-no-leidas`,
  );
}
