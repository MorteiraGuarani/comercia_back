import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiPropertyOptions } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/transforms';
import { CAMPOS_SOCIOS } from '../campos-socios';
import {
  MAX_INT2,
  MIN_INT2,
  MAX_INT4,
  MIN_INT4,
} from '../../common/utils/numeros';

function documentarSocio(
  opciones: ApiPropertyOptions,
  requerido = false,
): PropertyDecorator {
  return (target, campo) => {
    const detalle = CAMPOS_SOCIOS[campo as keyof typeof CAMPOS_SOCIOS];
    const decorar = requerido ? ApiProperty : ApiPropertyOptional;
    decorar({ ...opciones, ...detalle })(target, campo);
  };
}

export function TextoSocio(
  maxLength: number,
  nullable = true,
  defecto?: string,
) {
  return applyDecorators(
    nullable
      ? documentarSocio({
          type: String,
          maxLength,
          nullable,
          ...(defecto === undefined ? {} : { default: defecto }),
        })
      : documentarSocio({ type: String, minLength: 1, maxLength }, true),
    Transform(trimString),
    ...(nullable ? [IsOptional()] : [MinLength(1)]),
    IsString(),
    MaxLength(maxLength),
  );
}

export function EnteroSocio(tipo: 'int2' | 'int4', defecto?: number) {
  const minimum = tipo === 'int2' ? MIN_INT2 : MIN_INT4;
  const maximum = tipo === 'int2' ? MAX_INT2 : MAX_INT4;
  return applyDecorators(
    documentarSocio({
      type: 'integer',
      nullable: true,
      minimum,
      maximum,
      ...(defecto === undefined ? {} : { default: defecto }),
    }),
    IsOptional(),
    IsInt(),
    Min(minimum),
    Max(maximum),
  );
}

/** Opcional al crear, con valor predeterminado; SQL no admite NULL. */
export function BanderaSocio(defecto: 'Y' | 'N') {
  return applyDecorators(
    documentarSocio({
      type: String,
      enum: ['Y', 'N'],
      nullable: false,
      default: defecto,
    }),
    Transform(trimString),
    ValidateIf((_obj: object, value: unknown) => value !== undefined),
    IsIn(['Y', 'N']),
  );
}

export function CodigoIdentidadSocio() {
  return applyDecorators(
    documentarSocio({
      type: 'integer',
      nullable: false,
      minimum: MIN_INT4,
      maximum: MAX_INT4,
      description:
        'Code original. Puede enviarse explícitamente; si se omite al crear se asigna el siguiente código disponible de la empresa.',
    }),
    ValidateIf((_obj: object, value: unknown) => value !== undefined),
    IsInt(),
    Min(MIN_INT4),
    Max(MAX_INT4),
  );
}
