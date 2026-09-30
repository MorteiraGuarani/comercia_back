import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiLocal = process.env.COMERCIA_LOCAL_API_PROXY_TARGET;
if (apiLocal) {
  const destino = new URL(apiLocal);
  if (process.env.NODE_ENV !== "development" || destino.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(destino.hostname) || destino.username || destino.password || destino.pathname !== "/" || destino.search || destino.hash) {
    throw new Error("COMERCIA_LOCAL_API_PROXY_TARGET solo admite una API local HTTP durante desarrollo.");
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // typedRoutes desactivado: las rutas de módulos/páginas se configuran en la
  // base de datos (runtime), así que no se pueden verificar en compilación.
  // Build autocontenido para Docker; la raíz de trazado es el monorepo
  // para que el standalone incluya las dependencias hoisted de la raíz.
  output: "standalone",
  outputFileTracingRoot: path.join(currentDirectory, "../../"),
  // prod:web usa el mismo origen para mantener la sesión aunque cambie el puerto de Next.js.
  async rewrites() {
    return apiLocal ? [{ source: "/api/v1/:path*", destination: `${apiLocal}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
