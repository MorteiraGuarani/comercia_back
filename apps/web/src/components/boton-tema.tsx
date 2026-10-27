"use client";

// Botón sol/luna del navbar. El ícono visible lo decide el CSS (dark:) — cero
// problemas de hidratación — y el clic alterna la clase .dark y la persiste.
export function BotonTema({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
  function alternar() {
    const oscuro = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", oscuro);
    try {
      localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
    } catch {
      // localStorage puede no estar disponible (modo privado estricto): el
      // cambio aplica igual para la sesión actual
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar tema"
      className={`grid h-10 w-10 place-items-center rounded-xl border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
        sobreOscuro
          ? "text-white hover:border-[#587268] hover:bg-commercial-ink-soft"
          : "text-muted hover:border-line hover:bg-surface-soft hover:text-foreground"
      }`}
    >
      {/* Luna: visible en modo claro (invita a pasar a oscuro) */}
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 dark:hidden" aria-hidden>
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
      {/* Sol: visible en modo oscuro (invita a pasar a claro) */}
      <svg viewBox="0 0 20 20" fill="currentColor" className="hidden h-5 w-5 dark:block" aria-hidden>
        <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
      </svg>
    </button>
  );
}
