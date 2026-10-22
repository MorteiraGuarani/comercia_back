"use client";

import dynamic from "next/dynamic";

// Solo en el navegador: arranca con el zoom según el ancho de la pantalla.
const OrganigramaPanel = dynamic(
  () => import("@/components/organigrama/organigrama-panel").then((m) => m.OrganigramaPanel),
  { ssr: false },
);

export default function OrganigramaPage() {
  return <OrganigramaPanel />;
}
