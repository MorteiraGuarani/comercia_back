import { BadRequestException } from '@nestjs/common';
import type { TablaSociosDefinicion } from '../interfaces/tabla-socios.interface';
import type { EntradaSocio } from '../interfaces/registro-socio.interface';
import { leerSelectorDireccion } from './selector-direccion';

export function filtroRegistroSocios(
  tabla: TablaSociosDefinicion,
  empresaId: number,
  referencia: string | number,
  direccion?: string,
): EntradaSocio {
  if (tabla.nombre === 'tbl_ocrd' || tabla.nombre === 'tbl_crd1') {
    const selector =
      direccion === undefined ? {} : leerSelectorDireccion(direccion);
    if (selector === null)
      throw new BadRequestException('Selector de dirección inválido');
    return { empresaId, CardCode: String(referencia), ...selector };
  }
  if (tabla.nombre === 'tbl_oagp') {
    if (
      typeof referencia !== 'string' ||
      referencia.length < 1 ||
      referencia.length > 200
    )
      throw new BadRequestException(
        'AgentCode debe ser texto de 1 a 200 caracteres',
      );
    return { empresaId, AgentCode: referencia };
  }
  if (
    tabla.nombre === 'tbl_jcanales' ||
    tabla.nombre === 'tbl_jsubcanales' ||
    tabla.nombre === 'tbl_opln' ||
    tabla.nombre === 'tbl_oslp'
  ) {
    const campo =
      tabla.nombre === 'tbl_opln'
        ? 'ListNum'
        : tabla.nombre === 'tbl_oslp'
          ? 'SlpCode'
          : 'Code';
    const codigo = Number(referencia);
    if (
      !/^-?\d+$/.test(String(referencia)) ||
      !Number.isInteger(codigo) ||
      codigo < -2147483648 ||
      codigo > 2147483647
    )
      throw new BadRequestException(`${campo} debe ser un entero int4`);
    return { empresaId, [campo]: codigo };
  }
  return { empresaId, id: BigInt(referencia) };
}
