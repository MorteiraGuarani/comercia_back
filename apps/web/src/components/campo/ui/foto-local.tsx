import { colorCartelLocal, textoCartelLocal } from "@/utils/foto-local";

interface FotoLocalProps {
  nombre: string;
  className?: string;
}

// Tonos apagados: la ilustración acompaña, no compite con los estados de la tarjeta.
const HOJA = "#7f9a7c";
const HOJA_OSCURA = "#6a8668";
const MACETA = "#b39684";
const PRODUCTOS = ["#c9b79c", "#a9b8a6", "#c4a59c", "#b7b2c4"];

function Maceta({ x }: { x: number }) {
  return (
    <g>
      <ellipse cx={x + 6} cy="86" rx="4" ry="9" fill={HOJA} />
      <ellipse cx={x + 2.5} cy="90" rx="3" ry="7" fill={HOJA_OSCURA} transform={`rotate(-22 ${x + 2.5} 90)`} />
      <ellipse cx={x + 9.5} cy="90" rx="3" ry="7" fill={HOJA_OSCURA} transform={`rotate(22 ${x + 9.5} 90)`} />
      <path d={`M${x} 96h12l-1.6 10h-8.8z`} fill={MACETA} />
    </g>
  );
}

function Vidriera({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y="50" width="44" height="48" rx="2" className="fill-[#dde5e2] dark:fill-slate-600" />
      {[64, 80].map((y) => (
        <rect key={y} x={x + 2} y={y} width="40" height="1.5" className="fill-[#b9c4c0] dark:fill-slate-500" />
      ))}
      {[55, 69, 85].map((y, fila) =>
        [0, 1, 2, 3].map((i) => (
          <rect
            key={`${y}-${i}`}
            x={x + 4 + i * 10}
            y={y}
            width="6"
            height="8"
            rx="1"
            fill={PRODUCTOS[(i + fila) % PRODUCTOS.length]}
          />
        )),
      )}
    </g>
  );
}

/**
 * Imagen chica del local en las tarjetas. OCRD no trae foto ni logo: se
 * dibuja un frente con toldo, vidrieras y macetas, y el nombre en el cartel.
 */
export function FotoLocal({ nombre, className = "" }: FotoLocalProps) {
  const color = colorCartelLocal(nombre);
  return (
    <div
      className={`relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-soft ${className}`}
    >
      <svg
        viewBox="0 0 160 120"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Ilustración del frente de ${nombre}`}
        className="block h-full w-full"
      >
        <rect width="160" height="120" className="fill-[#ece6dc] dark:fill-stone-800" />
        <rect x="0" y="106" width="160" height="14" className="fill-[#d9d0c2] dark:fill-stone-700" />
        <rect x="14" y="14" width="132" height="92" className="fill-stone-50 dark:fill-stone-700" />

        {/* Cartel con el nombre */}
        <rect x="24" y="6" width="112" height="20" rx="3" fill={color} />
        <text
          x="80"
          y="20"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#fff"
          className="ft-display"
        >
          {textoCartelLocal(nombre)}
        </text>

        {/* Toldo a rayas con borde ondulado */}
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={14 + i * 16.5}
            y="28"
            width="16.5"
            height="12"
            fill={i % 2 ? "#f4efe6" : color}
          />
        ))}
        <path d={`M14 40 ${"q4.125 6 8.25 0 ".repeat(16)}z`} fill={color} opacity=".9" />

        <Vidriera x={24} />
        <Vidriera x={92} />

        {/* Puerta */}
        <rect x="72" y="52" width="16" height="54" rx="1" className="fill-[#5f6d68] dark:fill-slate-900" />
        <rect x="75" y="56" width="10" height="26" rx="1" className="fill-[#cfdad6] dark:fill-slate-600" opacity=".7" />
        <circle cx="85" cy="86" r="1.2" className="fill-[#e3dccf]" />

        <Maceta x={2} />
        <Maceta x={146} />
      </svg>
    </div>
  );
}
