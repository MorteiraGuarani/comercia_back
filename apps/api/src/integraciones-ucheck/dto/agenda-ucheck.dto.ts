import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginacionDto } from '../../common/utils/paginacion';

export class AgendaUcheckDto extends PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ucheckUsuarioId?: number;
  @IsEmail()
  @MaxLength(254)
  correo!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;
}
