"use client";

import dynamic from "next/dynamic";

// Leaflet necesita el navegador.
const UbicacionesPanel = dynamic(
  () => import("@/components/campo/ubicaciones-panel").then((m) => m.UbicacionesPanel),
  { ssr: false },
);

export default function UbicacionesPage() {
  return <UbicacionesPanel />;
}
