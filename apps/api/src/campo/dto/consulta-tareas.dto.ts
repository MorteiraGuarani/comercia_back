import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConsultaCampoDto } from './campo.dto';

export class ConsultaTareasCampoDto extends ConsultaCampoDto {
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
  @IsOptional() @IsIn(['obligatorias', 'con_fotos']) tipo?: 'obligatorias' | 'con_fotos';
}
