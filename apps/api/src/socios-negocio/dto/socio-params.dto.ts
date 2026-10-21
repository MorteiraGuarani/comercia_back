import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { EmpresaSociosParams } from './consulta-socios.dto';

export class SocioParams extends EmpresaSociosParams {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 15,
    example: 'C00001',
    description:
      'CardCode exacto del socio en esta empresa. Conserva ceros iniciales. Codificar caracteres especiales en la URL. Nunca se interpreta como id de PostgreSQL.',
  })
  @IsString()
  @Length(1, 15)
  CardCode!: string;
}
