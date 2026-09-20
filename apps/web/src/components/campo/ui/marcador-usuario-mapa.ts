import type { Circle, Map as MapaLeaflet, Marker } from "leaflet";
import type L from "leaflet";

export const HTML_MARCADOR_USUARIO = `
  <div class="campo-usuario" title="Tu ubicación">
    <span class="campo-usuario__pulso"></span>
    <span class="campo-usuario__punto"></span>
  </div>
`;

export type CapaUsuarioMapa = {
  actualizar: (latitud: number, longitud: number, precision?: number) => void;
  quitar: () => void;
};

export function montarCapaUsuario(
  mapa: MapaLeaflet,
  leaflet: typeof L,
  latitud: number,
  longitud: number,
  precision?: number,
): CapaUsuarioMapa {
  const radio = precision && precision > 8 ? precision : 28;
  const circulo: Circle = leaflet
    .circle([latitud, longitud], {
      radius: radio,
      color: "#0E65D8",
      weight: 1,
      fillColor: "#0E65D8",
      fillOpacity: 0.16,
      interactive: false,
    })
    .addTo(mapa);

  const marcador: Marker = leaflet
    .marker([latitud, longitud], {
      icon: leaflet.divIcon({
        className: "campo-marcador-usuario",
        html: HTML_MARCADOR_USUARIO,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      keyboard: false,
      interactive: false,
      title: "Tu ubicación",
      zIndexOffset: 1400,
    })
    .addTo(mapa);

  return {
    actualizar(siguienteLat, siguienteLng, siguientePrecision) {
      marcador.setLatLng([siguienteLat, siguienteLng]);
      circulo.setLatLng([siguienteLat, siguienteLng]);
      if (siguientePrecision && siguientePrecision > 8) {
        circulo.setRadius(siguientePrecision);
      }
    },
    quitar() {
      mapa.removeLayer(marcador);
      mapa.removeLayer(circulo);
    },
  };
}
