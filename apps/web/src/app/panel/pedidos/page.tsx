"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePanel } from "@/components/panel/contexto";
import { PedidosPanel } from "@/components/campo/pedidos-panel";
import { puedeUsarPedidos } from "@/utils/pedidos";

// shortcut: Pedidos fijo para Admin TI y usuarios de prueba; quitar al pasarlo a Acceso por empresa.
export default function PedidosPage() {
  const router = useRouter();
  const { usuario } = usePanel();
  const habilitado = puedeUsarPedidos(usuario);

  useEffect(() => {
    if (!habilitado) router.replace("/panel");
  }, [habilitado, router]);

  return habilitado ? <PedidosPanel /> : null;
}
