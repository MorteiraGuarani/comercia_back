import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { ConsultaSociosDto, EmpresaSociosParams } from './consulta-socios.dto';
import { leerSelectorDireccion } from '../utils/selector-direccion';

export class DireccionParams extends EmpresaSociosParams {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 200,
    example: 'C0001',
    description:
      'CardCode exacto de las direcciones en esta empresa; nunca id técnico. Conserva ceros iniciales. Codificar caracteres especiales en la URL.',
  })
  @IsString()
  @Length(1, 200)
  CardCode!: string;
}

export class CodigoCatalogoParams extends EmpresaSociosParams {
  @ApiProperty({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    example: 1,
    description:
      'Code original del canal o subcanal en esta empresa, nunca id técnico.',
  })
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    typeof obj[key] === 'string' && /^-?\d+$/.test(obj[key])
      ? Number(obj[key])
      : Number.NaN,
  )
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  Code!: number;
}

export class SelectorDireccionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @ValidateBy({
    name: 'selectorDireccion',
    validator: {
      validate: (value: unknown) => leerSelectorDireccion(value) !== null,
      defaultMessage: () =>
        'direccion debe ser JSON con Address, Street y AdresType, cada uno texto de hasta 200 caracteres o null',
    },
  })
  direccion?: string;
}
export class ConsultaDireccionesDto extends IntersectionType(
  ConsultaSociosDto,
  SelectorDireccionDto,
) {}
export class SinConsultaDto {}
