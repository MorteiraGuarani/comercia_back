import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const manifest: MetadataRoute.Manifest = {
  name: "comercIA",
  short_name: "comercIA",
  description:
    "La plataforma de trabajo para equipos comerciales en calle y oficina.",
  lang: "es",
  id: "/panel",
  start_url: "/panel",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f5f6f2",
  theme_color: "#365745",
  icons: [
    { src: "/pwa/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/pwa/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
