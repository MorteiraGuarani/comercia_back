// Mapa de íconos de módulos/páginas. La config guarda un nombre ("ventas",
// "clientes"...) y acá se resuelve al SVG; si no está, usa un ícono genérico.

type Props = { className?: string };

function Base({ children, className }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-5 w-5 shrink-0"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONOS: Record<string, (p: Props) => React.ReactNode> = {
  inicio: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3H9v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
        clipRule="evenodd"
      />
    </Base>
  ),
  ventas: (p) => (
    <Base {...p}>
      <path d="M12 9a1 1 0 01-1-1V3c0-.552.45-1.007.997-.93a7.004 7.004 0 015.933 5.933c.078.547-.378.997-.93.997h-5z" />
      <path d="M8.003 4.07C8.55 3.994 9 4.449 9 5v5a1 1 0 001 1h5c.552 0 1.007.45.93.997A7.001 7.001 0 012 11a7.002 7.002 0 016.003-6.93z" />
    </Base>
  ),
  clientes: (p) => (
    <Base {...p}>
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </Base>
  ),
  pedidos: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm1 8a.75.75 0 000 1.5h6a.75.75 0 000-1.5H7zm0 3a.75.75 0 000 1.5h6a.75.75 0 000-1.5H7z"
        clipRule="evenodd"
      />
    </Base>
  ),
  reportes: (p) => (
    <Base {...p}>
      <path d="M15.5 2A1.5 1.5 0 0017 3.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13A1.5 1.5 0 014.5 2h11zM7 14a1 1 0 10-2 0v1a1 1 0 102 0v-1zm4-3a1 1 0 10-2 0v4a1 1 0 102 0v-4zm4-3a1 1 0 10-2 0v7a1 1 0 102 0V8z" />
    </Base>
  ),
  inventario: (p) => (
    <Base {...p}>
      <path d="M10.362 1.093a1 1 0 00-.724 0L2.523 3.998A1 1 0 002 4.93v9.14a1 1 0 00.523.877l7.115 2.905a1 1 0 00.724 0l7.115-2.905A1 1 0 0018 14.07V4.93a1 1 0 00-.523-.877L10.362 1.093z" />
    </Base>
  ),
  mapa: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 003 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
        clipRule="evenodd"
      />
    </Base>
  ),
  locales: (p) => (
    <Base {...p}>
      <path d="M3 2.75A.75.75 0 013.75 2h12.5a.75.75 0 01.75.75V5H3V2.75zM2 6.5A.5.5 0 012.5 6h15a.5.5 0 01.5.5v1a2.5 2.5 0 01-1.5 2.291V17a1 1 0 01-1 1h-3.75a.75.75 0 01-.75-.75V13H9v4.25a.75.75 0 01-.75.75H4.5a1 1 0 01-1-1V9.791A2.5 2.5 0 012 7.5v-1z" />
    </Base>
  ),
  visitas: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M6.5 2A1.5 1.5 0 005 3.5V4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1v-.5A1.5 1.5 0 0013.5 2h-7zM7 4v-.5h6V4H7zm6.78 4.22a.75.75 0 00-1.06 0L9 11.94 7.28 10.22a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z"
        clipRule="evenodd"
      />
    </Base>
  ),
  tareas: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M6.5 2A1.5 1.5 0 005 3.5V4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1v-.5A1.5 1.5 0 0013.5 2h-7zM7 4v-.5h6V4H7zm7.03 4.47a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L9 12.44l3.97-3.97a.75.75 0 011.06 0z"
        clipRule="evenodd"
      />
    </Base>
  ),
  equipo: (p) => (
    <Base {...p}>
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </Base>
  ),
  calendario: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.414 0-.75.336-.75.75v7c0 .414.336.75.75.75h10.5c.414 0 .75-.336.75-.75v-7c0-.414-.336-.75-.75-.75H4.75z"
        clipRule="evenodd"
      />
    </Base>
  ),
  ruta: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M8.157 2.176a1.5 1.5 0 00-1.147.242L2.61 5.418A1.5 1.5 0 002 6.64v8.868a1.5 1.5 0 001.843 1.46l4.3-1.076 3.868 2.062a1.5 1.5 0 001.428-.027l4.39-2.634A1.5 1.5 0 0018 13.99V5.122a1.5 1.5 0 00-1.843-1.46l-4.3 1.076L7.989 2.676a1.5 1.5 0 00-.832-.5zM3.5 6.64l4-2.667v8.914l-4 1v-7.247zm5.5-2.288l3 1.6v8.948l-3-1.6V4.352zm4.5 2.378l3-1.8v7.247l-3 .75V6.73z"
        clipRule="evenodd"
      />
    </Base>
  ),
  novedades: (p) => (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </Base>
  ),
  avisos: (p) => (
    <Base {...p}>
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </Base>
  ),
};

function Generico(p: Props) {
  return (
    <Base {...p}>
      <path
        fillRule="evenodd"
        d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoModulo({
  nombre,
  className,
}: {
  nombre: string | null;
  className?: string;
}) {
  const Comp = (nombre && ICONOS[nombre]) || Generico;
  return <Comp className={className} />;
}

export function resolverIconoPagina({
  moduloRuta,
  moduloIcono,
  paginaRuta,
  paginaIcono,
}: {
  moduloRuta: string;
  moduloIcono: string | null;
  paginaRuta: string;
  paginaIcono: string | null;
}): string {
  // 1. Si la página tiene un ícono explícito configurado y registrado
  if (paginaIcono && paginaIcono in ICONOS) return paginaIcono;

  // 2. Personalización para módulo de Team Leader (Gestión de campo)
  if (moduloRuta === "gestion-campo") {
    switch (paginaRuta) {
      case "clientes":
        return "clientes";
      case "locales":
        return "locales";
      case "tareas":
        return "tareas";
      case "visitas":
        return "equipo";
      case "novedades":
        return "novedades";
      case "avisos":
        return "avisos";
    }
  }

  // 3. Personalización para módulo de Impulsador (Mi jornada)
  if (moduloRuta === "mi-jornada") {
    switch (paginaRuta) {
      case "locales":
        return "ruta";
      case "tareas":
        return "visitas";
      case "novedades":
        return "novedades";
      case "avisos":
        return "avisos";
    }
  }

  // 4. Si la ruta de la página coincide directamente con un icono disponible
  if (paginaRuta in ICONOS) return paginaRuta;

  // 5. Si el icono del módulo está registrado
  if (moduloIcono && moduloIcono in ICONOS) return moduloIcono;

  return paginaIcono ?? moduloIcono ?? paginaRuta ?? "generico";
}
