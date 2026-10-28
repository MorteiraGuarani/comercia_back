import { PickType } from '@nestjs/swagger';
import { ActualizarUsuarioDto } from './usuario.dto';

/**
 * Lo único que cada usuario cambia de sí mismo. Con forbidNonWhitelisted, rol,
 * superior, legajo o usuario enviados acá devuelven 400.
 */
export class ActualizarPerfilDto extends PickType(ActualizarUsuarioDto, [
  'nombre',
  'apellido',
  'correo',
  'ruc',
  'celular',
  'celularPais',
] as const) {}
