import { ImageResponse } from "next/og";

// Colores de la marca (--commercial-ink y --accent de globals.css). El fondo
// cubre todo el cuadrado y la letra queda en el 60% central, así el mismo
// ícono sirve como "maskable" en Android.
const FONDO = "#183129";
const ACENTO = "#c98248";

export function imagenIconoApp(lado: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FONDO,
          color: "#ffffff",
          fontSize: lado * 0.42,
          fontWeight: 800,
          letterSpacing: -lado * 0.02,
        }}
      >
        c<span style={{ color: ACENTO }}>IA</span>
      </div>
    ),
    { width: lado, height: lado },
  );
}
