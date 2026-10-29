import { BadRequestException, ConflictException } from '@nestjs/common';
import { loginDesdeCorreo, mensajeErrorLote } from './lote-usuarios';

describe('loginDesdeCorreo', () => {
  it('usa lo que va antes de la @ si cumple el formato de usuario', () => {
    expect(loginDesdeCorreo('Juan.Perez@empresa.com.py')).toBe('juan.perez');
    expect(loginDesdeCorreo('_ana+ventas@x.com')).toBe('anaventas');
    expect(loginDesdeCorreo('ab@x.com')).toBeNull();
    expect(loginDesdeCorreo(undefined)).toBeNull();
    expect(loginDesdeCorreo('a'.repeat(40) + '@x.com')).toHaveLength(30);
  });
});

describe('mensajeErrorLote', () => {
  it('devuelve el mensaje de la validación o del conflicto, nunca el interno', () => {
    expect(mensajeErrorLote(new BadRequestException(['uno', 'dos']))).toBe(
      'uno. dos',
    );
    expect(mensajeErrorLote(new ConflictException('Duplicado'))).toBe(
      'Duplicado',
    );
    expect(mensajeErrorLote(new Error('SQL roto'))).toBe(
      'No se pudo procesar este usuario',
    );
  });
});
