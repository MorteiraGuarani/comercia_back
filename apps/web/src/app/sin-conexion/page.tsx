import type { Metadata } from "next";
import { BotonReintentar } from "./boton-reintentar";

export const metadata: Metadata = { title: "Sin conexión" };

// La muestra el service worker cuando no hay red y la pantalla pedida no
// quedó guardada en el dispositivo.
export default function SinConexion() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-muted">
        No hay internet y esta pantalla todavía no está guardada en el
        teléfono. Las acciones pendientes se envían solas cuando vuelve la
        señal.
      </p>
      <BotonReintentar />
    </main>
  );
}
