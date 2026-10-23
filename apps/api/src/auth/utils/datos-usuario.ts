import { BadRequestException } from '@nestjs/common';
import {
  getCountries,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';
import { esRucParaguayoValido, normalizarRucPy } from '../../common/utils/ruc';

const TIPOS_CELULAR_VALIDOS = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

// Mensajes por columna única de usuarios (alta y edición).
export const MENSAJES_DUPLICADO: Record<string, string> = {
  correo: 'Ya existe un usuario registrado con ese correo',
  nombre_login: 'Ese nombre de usuario ya está en uso',
  ruc: 'Ya existe un usuario registrado con ese RUC',
};

export function normalizarCelular(celular: string, pais: string): string {
  if (!(getCountries() as string[]).includes(pais)) {
    throw new BadRequestException('El país del celular no es válido');
  }
  const parsed = parsePhoneNumberFromString(celular, pais as never);
  if (!parsed || !parsed.isValid() || parsed.country !== pais) {
    throw new BadRequestException(
      'El celular no es válido para el país seleccionado',
    );
  }
  const tipo = parsed.getType();
  if (tipo !== undefined && !TIPOS_CELULAR_VALIDOS.has(tipo)) {
    throw new BadRequestException('El número ingresado no es un celular');
  }
  return parsed.number;
}

// Los números leídos desde una SIM no siempre traen país ni formato uniforme.
// Esta variante no revela detalles al usuario: el flujo de autenticación decide
// si un número ausente o inválido debe caer al login habitual.
export function normalizarNumeroSim(celular: string): string | null {
  // Comercia normaliza sus celulares actuales como Paraguay; con el prefijo
  // por defecto también se puede resolver un número local que la operadora
  // exponga sin +595.
  const parsed = parsePhoneNumberFromString(celular, 'PY');
  if (!parsed || !parsed.isValid()) return null;

  const tipo = parsed.getType();
  if (tipo !== undefined && !TIPOS_CELULAR_VALIDOS.has(tipo)) return null;
  return parsed.number;
}

export function normalizarRucUsuario(ruc: string, pais: string): string {
  if (pais === 'PY') {
    const normalizado = normalizarRucPy(ruc.toUpperCase());
    if (!esRucParaguayoValido(normalizado)) {
      throw new BadRequestException(
        'El RUC no es válido: revisá el número y su dígito verificador (ej: 80012345-0)',
      );
    }
    return normalizado;
  }
  return ruc.trim().toUpperCase();
}
