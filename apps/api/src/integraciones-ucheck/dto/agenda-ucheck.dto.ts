import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';

export class AgendaUcheckDto extends PaginacionDto {
  @IsEmail()
  @MaxLength(254)
  correo!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;
}
