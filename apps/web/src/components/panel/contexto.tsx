"use client";

import { createContext, useContext } from "react";
import type { UsuarioSesion } from "@/types/usuario";
import type { ModuloMenu } from "@/types/plataforma";
import type { DisponibilidadTareas } from "@/types/disponibilidad-tareas";

export interface PanelData {
  usuario: UsuarioSesion;
  modulos: ModuloMenu[];
  tareasDisponibles: DisponibilidadTareas;
}

const PanelContext = createContext<PanelData | null>(null);

export function PanelProvider({
  value,
  children,
}: {
  value: PanelData;
  children: React.ReactNode;
}) {
  return <PanelContext value={value}>{children}</PanelContext>;
}

export function usePanel(): PanelData {
  const ctx = useContext(PanelContext);
  if (!ctx) {
    throw new Error("usePanel debe usarse dentro de PanelProvider");
  }
  return ctx;
}
