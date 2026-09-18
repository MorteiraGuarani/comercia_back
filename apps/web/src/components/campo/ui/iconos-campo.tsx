import React from "react";

type Props = { className?: string };

function Base({ children, className }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-4 w-4 shrink-0"}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export function IconoTienda({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M3 2.75A.75.75 0 013.75 2h12.5a.75.75 0 01.75.75V5H3V2.75zM2 6.5A.5.5 0 012.5 6h15a.5.5 0 01.5.5v1a2.5 2.5 0 01-1.5 2.291V17a1 1 0 01-1 1h-3.75a.75.75 0 01-.75-.75V13H9v4.25a.75.75 0 01-.75.75H4.5a1 1 0 01-1-1V9.791A2.5 2.5 0 012 7.5v-1z" />
    </Base>
  );
}

export function IconoCliente({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </Base>
  );
}

export function IconoPin({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 003 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoMapa({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M8.157 2.176a1.5 1.5 0 00-1.147.242L2.61 5.418A1.5 1.5 0 002 6.64v8.868a1.5 1.5 0 001.843 1.46l4.3-1.076 3.868 2.062a1.5 1.5 0 001.428-.027l4.39-2.634A1.5 1.5 0 0018 13.99V5.122a1.5 1.5 0 00-1.843-1.46l-4.3 1.076L7.989 2.676a1.5 1.5 0 00-.832-.5zM3.5 6.64l4-2.667v8.914l-4 1v-7.247zm5.5-2.288l3 1.6v8.948l-3-1.6V4.352zm4.5 2.378l3-1.8v7.247l-3 .75V6.73z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoCalendario({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.414 0-.75.336-.75.75v7c0 .414.336.75.75.75h10.5c.414 0 .75-.336.75-.75v-7c0-.414-.336-.75-.75-.75H4.75z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoReloj({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoCheck({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoAlerta({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoEditar({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
      <path d="M3.5 5.75c0-.414.336-.75.75-.75H7a.75.75 0 000-1.5H4.25A2.25 2.25 0 002 5.75v10A2.25 2.25 0 004.25 18h10A2.25 2.25 0 0016.5 15.75V13a.75.75 0 00-1.5 0v2.75a.75.75 0 01-.75.75h-10a.75.75 0 01-.75-.75v-10z" />
    </Base>
  );
}

export function IconoEliminar({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoBuscar({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoMas({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </Base>
  );
}

export function IconoCruz({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </Base>
  );
}

export function IconoFlechaIzq({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoFlechaDer({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoChevronAbajo({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoTelefono({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A16.48 16.48 0 012 3.5z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoContacto({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </Base>
  );
}

export function IconoCamara({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M6 3a2 2 0 00-2 2v1h-.5A2.5 2.5 0 001 8.5v7A2.5 2.5 0 003.5 18h13a2.5 2.5 0 002.5-2.5v-7A2.5 2.5 0 0016.5 6H16V5a2 2 0 00-2-2H6zm4 11a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
    </Base>
  );
}

export function IconoMensaje({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9.879l2.31 2.31A1 1 0 0017 15.5V3.5A1.5 1.5 0 0015.5 2h-12zm3 4.5a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-7zm0 3a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoAvisos({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </Base>
  );
}

export function IconoMegafono({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10.28 2.22a.75.75 0 00-.78.07L4.673 5.5H2.5A1.5 1.5 0 001 7v6a1.5 1.5 0 001.5 1.5h2.173l4.827 3.21A.75.75 0 0010.75 17V3a.75.75 0 00-.47-.78zM14.53 4.47a.75.75 0 011.06 0 7.75 7.75 0 010 11.06.75.75 0 11-1.06-1.06 6.25 6.25 0 000-8.94.75.75 0 010-1.06zm-2 2a.75.75 0 011.06 0 4.75 4.75 0 010 6.72.75.75 0 11-1.06-1.06 3.25 3.25 0 000-4.6.75.75 0 010-1.06z" />
    </Base>
  );
}

export function IconoTareas({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M6.5 2A1.5 1.5 0 005 3.5V4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1v-.5A1.5 1.5 0 0013.5 2h-7zM7 4v-.5h6V4H7zm7.03 4.47a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L9 12.44l3.97-3.97a.75.75 0 011.06 0z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoPlanificacion({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M6.5 2A1.5 1.5 0 005 3.5V4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1v-.5A1.5 1.5 0 0013.5 2h-7zM7 4v-.5h6V4H7zm6.78 4.22a.75.75 0 00-1.06 0L9 11.94 7.28 10.22a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoEquipo({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </Base>
  );
}

export function IconoGlobo({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.5 0a6.5 6.5 0 00-1.1-3.623l-3.328 1.664a1.75 1.75 0 01-1.564 0L8.5 7.037V8.5a1.75 1.75 0 01-1.75 1.75H5.06a6.52 6.52 0 004.94 6.223v-1.223a1.75 1.75 0 011.75-1.75h1.5a1.75 1.75 0 011.75 1.75v.215A6.51 6.51 0 0016.5 10zM3.5 10a6.5 6.5 0 00.59 2.708l1.66-1.66A.25.25 0 006 10.872v-.622a.25.25 0 00-.25-.25H4.062A6.52 6.52 0 003.5 10z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoOjo({ className }: Props) {
  return (
    <Base className={className}>
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
        clipRule="evenodd"
      />
    </Base>
  );
}

export function IconoRefrescar({ className }: Props) {
  return (
    <Base className={className}>
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.31V15a.75.75 0 01-1.5 0v-3.75A.75.75 0 015 10.5h3.75a.75.75 0 010 1.5H6.866l.316.315a4 4 0 101.442-5.71.75.75 0 11-.75-1.3 5.5 5.5 0 017.438 6.119z"
        clipRule="evenodd"
      />
    </Base>
  );
}

