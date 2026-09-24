import { API_URL, apiFetch } from "./api";
import type { FormAvisoCampo, FormNovedadCampo } from "@/types/campo";

function agregarValor(
  formulario: FormData,
  campo: string,
  valor: string | number | undefined,
) {
  if (valor !== undefined) formulario.append(campo, String(valor));
}

function agregarFotos(formulario: FormData, fotos: File[]) {
  fotos.forEach((foto) => formulario.append("fotos", foto));
}

export function crearNovedadCampo(datos: FormNovedadCampo, fotos: File[] = []) {
  const formulario = new FormData();
  agregarValor(formulario, "localId", datos.localId);
  agregarValor(formulario, "tareaId", datos.tareaId);
  agregarValor(formulario, "visitaId", datos.visitaId);
  agregarValor(formulario, "tipo", datos.tipo);
  agregarValor(formulario, "prioridad", datos.prioridad);
  agregarValor(formulario, "titulo", datos.titulo);
  agregarValor(formulario, "descripcion", datos.descripcion);
  agregarFotos(formulario, fotos);

  return apiFetch("/campo/novedades", { method: "POST", body: formulario });
}

export function crearAvisoCampo(datos: FormAvisoCampo, fotos: File[] = []) {
  const formulario = new FormData();
  agregarValor(formulario, "tipo", datos.tipo);
  agregarValor(formulario, "destinatarioId", datos.destinatarioId);
  agregarValor(
    formulario,
    "destinatariosIds",
    datos.destinatariosIds?.join(","),
  );
  agregarValor(formulario, "mensaje", datos.mensaje);
  agregarValor(formulario, "frecuencia", datos.frecuencia);
  agregarValor(formulario, "fechaInicio", datos.fechaInicio);
  agregarValor(formulario, "hora", datos.hora);
  agregarValor(formulario, "intervaloHoras", datos.intervaloHoras);
  agregarValor(formulario, "diasSemana", datos.diasSemana?.join(","));
  agregarValor(formulario, "diaMes", datos.diaMes);
  agregarValor(formulario, "fechaFin", datos.fechaFin);
  agregarFotos(formulario, fotos);

  return apiFetch("/campo/avisos", { method: "POST", body: formulario });
}

export function obtenerUrlAdjuntoCampo(id: number): string {
  return `${API_URL}/campo/adjuntos/${id}`;
}
