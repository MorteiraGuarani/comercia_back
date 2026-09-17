"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { apiFetch } from "@/lib/api";
import type { UsuarioSesion } from "@/types/usuario";
import type { ModuloMenu } from "@/types/plataforma";
import { BrandMark } from "@/components/auth-shell";
import { BotonTema } from "@/components/boton-tema";
import { BadgeNotificaciones } from "@/components/campo/badge-notificaciones";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { PanelProvider } from "@/components/panel/contexto";
import { IconoModulo, resolverIconoPagina } from "@/components/panel/iconos";
import { btnGhost } from "@/components/ui";
import { EVENTO_PLATAFORMA_ACTUALIZADA } from "@/lib/eventos-plataforma";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [modulos, setModulos] = useState<ModuloMenu[]>([]);
  const [cargando, setCargando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosAbierto, setDatosAbierto] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ usuario: UsuarioSesion }>("/auth/me"),
      apiFetch<{ modulos: ModuloMenu[] }>("/mi-plataforma").catch(() => ({
        modulos: [],
      })),
    ])
      .then(([me, menu]) => {
        setUsuario(me.usuario);
        setModulos(menu.modulos);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setCargando(false));
  }, [router]);

  useEffect(() => {
    let vigente = true;
    const actualizarMenu = () => {
      void apiFetch<{ modulos: ModuloMenu[] }>("/mi-plataforma")
        .then((menu) => {
          if (vigente) setModulos(menu.modulos);
        })
        .catch(() => undefined);
    };
    window.addEventListener(EVENTO_PLATAFORMA_ACTUALIZADA, actualizarMenu);
    return () => {
      vigente = false;
      window.removeEventListener(EVENTO_PLATAFORMA_ACTUALIZADA, actualizarMenu);
    };
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    function fuera(e: MouseEvent | TouchEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
    };
  }, [menuAbierto]);

  async function cerrarSesion() {
    if (cerrandoSesion) return;
    setCerrandoSesion(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
      router.replace("/login");
    } finally {
      setCerrandoSesion(false);
    }
  }

  // Value estable del contexto: solo cambia cuando cambian usuario o módulos
  const valorPanel = useMemo(
    () => (usuario ? { usuario, modulos } : null),
    [usuario, modulos],
  );

  if (cargando || !usuario || !valorPanel) {
    return <PantallaCarga visible mensaje="Cargando tu panel" />;
  }

  const iniciales =
    `${usuario.nombre[0] ?? ""}${usuario.apellido[0] ?? ""}`.toUpperCase();
  const itemMenu =
    "flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-none";

  const enlaces = [
    { href: "/panel", nombre: "Inicio", icono: "inicio" },
    ...modulos.flatMap((m) =>
      m.paginas.map((p) => ({
        href: `/panel/${m.ruta}/${p.ruta}`,
        nombre: p.nombre,
        icono: resolverIconoPagina({
          moduloRuta: m.ruta,
          moduloIcono: m.icono,
          paginaRuta: p.ruta,
          paginaIcono: p.icono,
        }),
      })),
    ),
  ];
  const activo = (href: string) =>
    href === "/panel" ? pathname === "/panel" : pathname === href;

  return (
    <PanelProvider value={valorPanel}>
      <div className="relative isolate flex min-h-dvh w-full max-w-full flex-col overflow-x-clip bg-background">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_94%_4%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_27rem)]"
        />
        {/* Barra superior */}
        <header className="sticky top-0 z-40 flex w-full min-w-0 items-center justify-between gap-2 border-b border-line bg-surface-raised px-3 py-2.5 shadow-[0_8px_28px_rgba(var(--warm-shadow),0.09)] sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarVisible((v) => !v)}
              aria-label={sidebarVisible ? "Ocultar menú" : "Mostrar menú"}
              aria-expanded={sidebarVisible}
              className="hidden h-10 w-10 place-items-center rounded-xl border border-transparent text-muted transition hover:border-line hover:bg-surface-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-600/40 lg:grid"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <Link href="/panel" aria-label="Inicio" className="shrink-0">
              <BrandMark />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <BadgeNotificaciones />
            <BotonTema />
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                className="flex min-h-11 items-center gap-1 rounded-xl px-1 py-1 transition hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600/40 sm:gap-2.5 sm:px-2 sm:py-1.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full border border-brand-700/10 bg-brand-100 text-sm font-extrabold text-brand-900 dark:bg-brand-950 dark:text-brand-100">
                  {iniciales}
                </span>
                <span className="hidden min-w-0 max-w-44 text-left sm:block">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {usuario.nombre} {usuario.apellido}
                  </span>
                  <span className="block text-xs text-muted">
                    {usuario.esSuperadmin
                      ? "Superadmin"
                      : (usuario.rol?.descripcion ?? "Sin rol asignado")}
                  </span>
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 text-muted transition-transform ${menuAbierto ? "rotate-180" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <AnimatePresence>
                {menuAbierto && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -4 }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                    style={{ transformOrigin: "top right" }}
                    role="menu"
                    className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface-raised py-1.5 shadow-[0_20px_55px_rgba(var(--warm-shadow),0.18)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAbierto(false);
                        setDatosAbierto(true);
                      }}
                      className={itemMenu}
                    >
                      <IconoPersona /> Mis Datos
                    </button>
                    {usuario.puedeAdministrarUsuarios && (
                      <Link
                        role="menuitem"
                        href="/panel/usuarios"
                        onClick={() => setMenuAbierto(false)}
                        className={itemMenu}
                      >
                        <IconoPersona /> Usuarios
                      </Link>
                    )}
                    {usuario.esSuperadmin && (
                      <Link
                        role="menuitem"
                        href="/panel/admin"
                        onClick={() => setMenuAbierto(false)}
                        className={itemMenu}
                      >
                        <IconoEngranaje /> Administración
                      </Link>
                    )}
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={cerrarSesion}
                      className={`${itemMenu} text-red-600 dark:text-red-400`}
                    >
                      <IconoSalir /> Cerrar sesión
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex min-w-0 flex-1">
          {/* Menú lateral (escritorio) */}
          <AnimatePresence initial={false}>
            {sidebarVisible && (
              <motion.aside
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="hidden w-60 shrink-0 border-r border-[#315247] bg-commercial-ink p-3.5 text-white shadow-[12px_0_32px_rgba(13,31,25,0.08)] lg:block"
              >
                <nav className="flex flex-col gap-1">
                  {enlaces.map((e) => (
                    <Link
                      key={e.href}
                      href={e.href}
                      className={`relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-[#dea06a]/60 ${activo(e.href)
                        ? "bg-commercial-ink-soft font-bold text-white shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[#dea06a]"
                        : "text-[#d2ddd8] hover:bg-[#203d34] hover:text-white"
                        }`}
                    >
                      <IconoModulo nombre={e.icono} />
                      {e.nombre}
                    </Link>
                  ))}
                </nav>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Contenido */}
          <main className="min-w-0 w-full flex-1 p-0">
            {children}
          </main>
        </div>

        {/* Bottom navbar (mobile) — máximo 5 accesos */}
        <nav
          aria-label="Módulos"
          className="fixed inset-x-0 bottom-0 z-40 w-full max-w-[100vw] border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-10px_34px_rgba(var(--warm-shadow),0.14)] lg:hidden"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(enlaces.length, 5)}, minmax(0, 1fr))`,
            }}
          >
            {enlaces.slice(0, 5).map((e) => {
              const esActivo = activo(e.href);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  title={e.nombre}
                  aria-current={esActivo ? "page" : undefined}
                  className={`relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${esActivo
                    ? "text-brand-800 dark:text-brand-200"
                    : "text-muted hover:bg-surface-soft"
                    }`}
                >
                  {esActivo ? (
                    <span className="absolute inset-x-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-accent" />
                  ) : null}
                  <span
                    className={`grid h-8 w-10 place-items-center rounded-xl transition ${esActivo
                      ? "bg-brand-100 shadow-sm dark:bg-brand-950"
                      : "bg-surface-soft"
                      }`}
                  >
                    <IconoModulo nombre={e.icono} />
                  </span>
                  <span className="w-full truncate px-0.5 text-center text-[11px] font-semibold leading-tight">
                    {e.nombre}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Modal Mis Datos: se cierra solo con X, Escape o el botón Cerrar */}
        <Modal
          titulo="Mis Datos"
          abierto={datosAbierto}
          onCerrar={() => setDatosAbierto(false)}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-base font-extrabold text-brand-900 dark:bg-brand-950 dark:text-brand-100">
              {iniciales}
            </span>
            <div>
              <p className="font-semibold">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-sm text-muted">{usuario.empresa.nombre}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
            <dt className="text-muted">Usuario</dt>
            <dd className="break-all">{usuario.nombreLogin}</dd>
            <dt className="text-muted">Correo</dt>
            <dd className="break-all">{usuario.correo}</dd>
            <dt className="text-muted">RUC</dt>
            <dd>{usuario.ruc}</dd>
            <dt className="text-muted">Celular</dt>
            <dd>{usuario.celular}</dd>
            <dt className="text-muted">Rol</dt>
            <dd>
              {usuario.rol?.descripcion ?? (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Pendiente de asignación
                </span>
              )}
            </dd>
          </dl>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setDatosAbierto(false)}
              className={btnGhost}
            >
              Cerrar
            </button>
          </div>
        </Modal>
        <PantallaCarga
          visible={cerrandoSesion}
          mensaje="Cerrando sesión"
          detalle="Finalizamos tu sesión de forma segura."
        />
      </div>
    </PanelProvider>
  );
}

function IconoPersona() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 text-zinc-400"
      aria-hidden
    >
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

function IconoEngranaje() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 text-zinc-400"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoSalir() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}
