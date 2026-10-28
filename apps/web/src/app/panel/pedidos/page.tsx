import { IconoModulo } from "@/components/panel/iconos";

// Pedidos todavía no está habilitado: el menú lo muestra deshabilitado.
export default function PedidosPage() {
  return (
    <section className="mx-auto grid min-h-[50dvh] w-full max-w-md place-items-center px-4 py-10 text-center">
      <div className="space-y-3">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-soft text-muted">
          <IconoModulo nombre="pedidos" className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
        <p className="text-sm text-muted">Próximamente.</p>
      </div>
    </section>
  );
}
