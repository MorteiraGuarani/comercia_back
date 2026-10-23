import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

// Texto opcional: vacío se guarda como null.
const textoOpcional = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class CrearConexionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 80)
  nombre!: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  servernode?: string | null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userDb?: string | null;

  /** Solo escritura: nunca se devuelve. Vacío u omitido conserva la actual. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  passwordDb?: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceLayer?: string | null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  versionTls?: string | null;
}

export class ActualizarConexionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  nombre?: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  servernode?: string | null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userDb?: string | null;

  /** Solo escritura: nunca se devuelve. Vacío u omitido conserva la actual. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  passwordDb?: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceLayer?: string | null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  versionTls?: string | null;
}
