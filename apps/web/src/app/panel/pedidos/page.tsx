"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePanel } from "@/components/panel/contexto";
import { PedidosPanel } from "@/components/campo/pedidos-panel";

// shortcut: Pedidos fijo para Admin TI mientras se arma; quitar al pasarlo a Acceso por empresa.
export default function PedidosPage() {
  const router = useRouter();
  const { usuario } = usePanel();

  useEffect(() => {
    if (!usuario.esAdminTi) router.replace("/panel");
  }, [usuario.esAdminTi, router]);

  return usuario.esAdminTi ? <PedidosPanel /> : null;
}
