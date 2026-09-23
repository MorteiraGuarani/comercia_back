import { BadRequestException } from '@nestjs/common';
import { distanciaMetros } from '../../common/utils/geo';
import type { MarcaCampoDto } from '../dto/campo.dto';

export function comprobarMarcaEnLocal(
  marca: MarcaCampoDto,
  local: { latitud: number; longitud: number; radioMetros: number },
  ahora: Date,
): number {
  const antiguedad = ahora.getTime() - new Date(marca.capturadaEn).getTime();
  if (
    !Number.isFinite(antiguedad) ||
    antiguedad > 60_000 ||
    antiguedad < -15_000
  )
    throw new BadRequestException('Obtené una ubicación nueva para marcar');
  if (
    !Number.isFinite(marca.precisionMetros) ||
    marca.precisionMetros < 0 ||
    marca.precisionMetros > Math.min(local.radioMetros, 50)
  )
    throw new BadRequestException(
      'La precisión del GPS no es suficiente. Acercate al local y volvé a intentar',
    );
  if (!Number.isFinite(marca.latitud) || !Number.isFinite(marca.longitud))
    throw new BadRequestException('Obtené una ubicación válida para marcar');
  const distancia = distanciaMetros(
    marca.latitud,
    marca.longitud,
    local.latitud,
    local.longitud,
  );
  if (!Number.isFinite(distancia) || distancia > local.radioMetros)
    throw new BadRequestException(
      `Estás fuera del radio permitido de ${local.radioMetros} m`,
    );
  return distancia;
}
