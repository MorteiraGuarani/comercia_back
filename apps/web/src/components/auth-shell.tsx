import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-[#10231d] lg:grid lg:grid-cols-[minmax(430px,0.84fr)_minmax(0,1.16fr)]">
      <section className="hidden bg-[#183129] p-10 lg:flex lg:min-h-svh lg:flex-col lg:justify-between">
        <BrandMark claro />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#efb37f]">
            Plataforma de gestión comercial
          </p>
          <h2 className="mt-3 max-w-sm text-[clamp(2rem,3vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.05em] text-white">
            Tu negocio. Más inteligente.
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-[#c7d5d0]">
            Gestioná tu equipo, optimizá tus ventas y tomá mejores decisiones con inteligencia artificial.
          </p>
          <div aria-hidden className="mt-6 h-1 w-14 rounded-full bg-[#d9955d]" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#82968f]">
          comercIA · gestión comercial
        </p>
      </section>

      <section className="flex min-h-svh w-full min-w-0 items-center justify-center bg-[#10231d] px-5 py-7 text-white sm:px-9 sm:py-10 lg:px-[clamp(2.5rem,4vw,4.75rem)]">
        <div className="w-full max-w-md [--border:#405a50] [--control-border:#658077] [--foreground:#fffaf3] [--muted:#b9c9c3] [--surface-raised:#183129] [--surface-soft:#203d34]">
          <div className="mb-10 lg:hidden"><BrandMark claro /></div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function BrandMark({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border text-lg font-black ${claro ? "border-white bg-white text-brand-900" : "border-brand-700 bg-brand-700 text-white"}`}>
        C<span aria-hidden className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      <span className={`truncate text-xl font-extrabold tracking-[-0.045em] ${claro ? "text-white" : "text-foreground"}`}>
        comerc<span className={claro ? "text-[#efb37f]" : "text-accent"}>IA</span>
      </span>
    </div>
  );
}
