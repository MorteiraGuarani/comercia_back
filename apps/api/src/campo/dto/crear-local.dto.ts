import { OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../common/utils/transforms';

/** Alta de cliente en OCRD y, si se informa, su dirección de entrega en CRD1. */
export class CrearLocalCampoDto {
  @Transform(trimString)
  @IsString({ message: 'El código de cliente debe ser texto' })
  @Length(1, 15, {
    message: 'El código de cliente debe tener entre 1 y 15 caracteres',
  })
  CardCode!: string;

  @Transform(trimString)
  @IsString({ message: 'El nombre del cliente debe ser texto' })
  @Length(1, 200, {
    message: 'El nombre del cliente debe tener entre 1 y 200 caracteres',
  })
  CardName!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El RUC debe ser texto' })
  @MaxLength(32, { message: 'El RUC admite hasta 32 caracteres' })
  LicTradNum?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  @MaxLength(200, { message: 'La dirección admite hasta 200 caracteres' })
  Address?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'La calle debe ser texto' })
  @MaxLength(200, { message: 'La calle admite hasta 200 caracteres' })
  Street?: string;

  /** Punto marcado en el mapa; se guarda en U_Latitud/U_Longitud. */
  @IsOptional()
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180)
  @Max(180)
  longitud?: number;
}

/** Edición: el código de cliente es la clave y no cambia. */
export class EditarLocalCampoDto extends OmitType(CrearLocalCampoDto, [
  'CardCode',
] as const) {}
