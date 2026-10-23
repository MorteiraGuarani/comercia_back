import {
  AsYouType,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";

// Sin "+" se asume Paraguay: "0991188620" → "+595991188620".
function conPrefijo(texto: string): string {
  const limpio = texto.replace(/[^\d+]/g, "");
  if (!limpio || limpio.startsWith("+")) return limpio;
  return `+595${limpio.replace(/^0+/, "")}`;
}

/** Formato internacional mientras se escribe: "+595 991 188620". */
export function formatearTelefono(texto: string): string {
  const numero = conPrefijo(texto);
  return numero ? new AsYouType().input(numero) : "";
}

/** Estado del teléfono para el formulario; e164 es lo que se guarda. */
export function pistaTelefono(texto: string): {
  valido: boolean;
  e164: string;
  mensaje: string;
} {
  const numero = conPrefijo(texto);
  if (!numero) return { valido: true, e164: "", mensaje: "" };
  const largo = validatePhoneNumberLength(numero);
  if (largo === "TOO_SHORT")
    return { valido: false, e164: "", mensaje: "Faltan dígitos en el número" };
  if (largo === "TOO_LONG")
    return { valido: false, e164: "", mensaje: "Sobran dígitos en el número" };
  if (largo === "INVALID_COUNTRY")
    return { valido: false, e164: "", mensaje: "Revisá el código de país" };
  const telefono = parsePhoneNumberFromString(numero);
  if (largo || !telefono?.isValid())
    return {
      valido: false,
      e164: "",
      mensaje: "El número no es válido para ese país",
    };
  return {
    valido: true,
    e164: telefono.number,
    mensaje: `✓ ${telefono.formatInternational()}`,
  };
}

/** País y número nacional de un celular guardado en E.164, para editarlo. */
export function partesCelular(e164: string): { pais: CountryCode; numero: string } {
  const numero = parsePhoneNumberFromString(e164);
  return { pais: numero?.country ?? "PY", numero: numero?.formatNational() ?? e164 };
}
