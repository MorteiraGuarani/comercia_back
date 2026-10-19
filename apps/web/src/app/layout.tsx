import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ActualizadorDespliegue } from "@/components/actualizador-despliegue";
import { RegistroServiceWorker } from "@/components/registro-service-worker";
import { ToastProvider } from "@/components/toast/toast-provider";
import { ConfirmacionHost } from "@/components/confirmacion/confirmacion-host";
import "./globals.css";

const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: {
    default: "comercIA",
    template: "%s · comercIA",
  },
  description:
    "La plataforma de trabajo para equipos comerciales en calle y oficina.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
  ],
};

// Aplica el tema ANTES del primer pintado (sin destello): usa la elección
// guardada del usuario o, si no eligió, la preferencia del dispositivo.
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");var oscuro=t?t==="oscuro":matchMedia("(prefers-color-scheme: dark)").matches;if(oscuro)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: las extensiones del navegador (ColorZilla,
          Grammarly, etc.) inyectan atributos en el body antes de que React
          hidrate; eso no es un error nuestro y no debe ensuciar la consola */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
        <ActualizadorDespliegue />
        <RegistroServiceWorker />
        <ToastProvider>{children}</ToastProvider>
        <ConfirmacionHost />
      </body>
    </html>
  );
}
