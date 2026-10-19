import { imagenIconoApp } from "@/components/marca/icono-app";

export const dynamic = "force-static";

export function GET() {
  return imagenIconoApp(512);
}
