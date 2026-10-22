import { colorCartelLocal, textoCartelLocal } from "@/utils/foto-local";

interface FotoLocalProps {
  nombre: string;
  className?: string;
}

/**
 * Imagen chica del local en las tarjetas. OCRD no trae foto ni logo: se
 * dibuja el frente con el nombre del socio en el cartel.
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
          <rect width="160" height="120" className="fill-sky-100 dark:fill-sky-950" />
          <rect x="0" y="104" width="160" height="16" className="fill-stone-300 dark:fill-stone-700" />
          <rect x="8" y="16" width="144" height="88" className="fill-stone-50 dark:fill-stone-800" />
          <rect x="8" y="16" width="144" height="26" fill={color} />
          <text
            x="80"
            y="34"
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#fff"
            className="ft-display"
          >
            {textoCartelLocal(nombre)}
          </text>
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={8 + i * 18}
              y="42"
              width="18"
              height="9"
              fill={i % 2 ? "#fff" : color}
              opacity={i % 2 ? 0.9 : 1}
            />
          ))}
          <path
            d={`M8 51 ${"q4.5 5 9 0 ".repeat(16)}z`}
            fill={color}
          />
          <rect x="18" y="62" width="42" height="42" className="fill-slate-600 dark:fill-slate-900" opacity=".85" />
          <rect x="100" y="62" width="42" height="42" className="fill-slate-600 dark:fill-slate-900" opacity=".85" />
          <rect x="68" y="58" width="24" height="46" className="fill-slate-700 dark:fill-slate-950" />
          <rect x="79" y="58" width="2" height="46" className="fill-slate-400 dark:fill-slate-600" />
          <g className="fill-amber-300 dark:fill-amber-500" opacity=".8">
            <rect x="23" y="70" width="10" height="7" />
            <rect x="37" y="70" width="10" height="7" />
            <rect x="105" y="70" width="10" height="7" />
            <rect x="126" y="84" width="10" height="7" />
          </g>
          <g className="fill-white dark:fill-slate-300" opacity=".85">
            <rect x="23" y="84" width="10" height="7" />
            <rect x="44" y="84" width="10" height="7" />
            <rect x="112" y="84" width="10" height="7" />
          </g>
        </svg>
    </div>
  );
}
