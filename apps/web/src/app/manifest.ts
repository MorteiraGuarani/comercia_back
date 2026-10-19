import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "comercIA",
    short_name: "comercIA",
    description:
      "La plataforma de trabajo para equipos comerciales en calle y oficina.",
    lang: "es",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e8dfd3",
    theme_color: "#183129",
    icons: [
      { src: "/pwa/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
