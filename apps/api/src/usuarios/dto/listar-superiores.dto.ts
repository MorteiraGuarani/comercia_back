import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';
import { ListarUsuariosDto } from './usuario.dto';

export class ListarSuperioresDto extends ListarUsuariosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  rolId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  excluirUsuarioId?: number;
}
