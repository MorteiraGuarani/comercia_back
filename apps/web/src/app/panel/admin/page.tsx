"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePanel } from "@/components/panel/contexto";
import { ModulosPanel } from "@/components/admin/modulos-panel";
import { EmpresasPanel } from "@/components/admin/empresas-panel";
import { EmpresasAbmPanel } from "@/components/admin/empresas-abm-panel";
import { RolesPanel } from "@/components/admin/roles-panel";
import { UsuariosPanel } from "@/components/usuarios/usuarios-panel";

type Tab = "usuarios" | "roles" | "empresas" | "modulos" | "accesos";

export default function AdminPage() {
  const router = useRouter();
  const { usuario } = usePanel();
  const [tab, setTab] = useState<Tab>("usuarios");

  // Doble candado: el guard del back protege los datos; esto evita mostrar la
  // pantalla a un no-superadmin que llegue por URL.
  useEffect(() => {
    if (!usuario.esSuperadmin) {
      router.replace("/panel");
    }
  }, [usuario.esSuperadmin, router]);

  if (!usuario.esSuperadmin) {
    return null;
  }

  const tabClase = (t: Tab) =>
    `border-b-2 px-4 py-2.5 text-sm font-medium transition ${
      tab === t
        ? "border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-300"
        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl font-bold tracking-tight">Administración</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Gestioná usuarios, roles, empresas y el acceso a la plataforma.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("usuarios")}
          className={`${tabClase("usuarios")} whitespace-nowrap`}
        >
          Usuarios
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`${tabClase("roles")} whitespace-nowrap`}
        >
          Roles
        </button>
        <button
          type="button"
          onClick={() => setTab("empresas")}
          className={`${tabClase("empresas")} whitespace-nowrap`}
        >
          Empresas
        </button>
        <button
          type="button"
          onClick={() => setTab("modulos")}
          className={`${tabClase("modulos")} whitespace-nowrap`}
        >
          Módulos y páginas
        </button>
        <button
          type="button"
          onClick={() => setTab("accesos")}
          className={`${tabClase("accesos")} whitespace-nowrap`}
        >
          Acceso por empresa
        </button>
      </div>

      <div className="mt-6">
        {tab === "usuarios" && <UsuariosPanel soloSuperadmin />}
        {tab === "roles" && <RolesPanel />}
        {tab === "empresas" && <EmpresasAbmPanel />}
        {tab === "modulos" && <ModulosPanel />}
        {tab === "accesos" && <EmpresasPanel />}
      </div>
    </div>
  );
}
