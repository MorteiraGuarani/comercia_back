"use client";
import { SelectorPaginado } from "@/components/selector-paginado";
import type { ClienteCampo } from "@/types/campo";

interface Props {
  valorId: number | null | undefined;
  clienteSeleccionado?: {
    id: number;
    nombre: string;
    logoUrl?: string | null;
    ruc?: string;
  } | null;
  alSeleccionar: (cliente: ClienteCampo) => void;
  alLimpiar?: () => void;
  clientesIniciales?: ClienteCampo[];
  placeholder?: string;
  requerido?: boolean;
  disabled?: boolean;
  /** Versión para barras de filtros (sin etiqueta visible, 44 px). */
  compacto?: boolean;
}
export function SelectorClienteCombobox({
  valorId,
  clienteSeleccionado,
  alSeleccionar,
  alLimpiar,
  placeholder = "Seleccioná un cliente",
  requerido = false,
  disabled = false,
  compacto = false,
}: Props) {
  return (
    <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
      <SelectorPaginado
        url="/campo/clientes"
        etiqueta="Cliente"
        buscable
        compacto={compacto}
        placeholder={compacto ? placeholder : undefined}
        value={valorId ?? ""}
        seleccionActual={clienteSeleccionado?.nombre}
        vacio={placeholder}
        required={requerido}
        onChange={(id) => {
          if (id === "") alLimpiar?.();
        }}
        onSeleccionar={(opcion) => alSeleccionar(opcion as ClienteCampo)}
      />
    </fieldset>
  );
}
