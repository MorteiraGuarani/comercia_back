import {
  codigoErrorPrisma,
  relanzarDuplicado,
  traducirErrorPrisma,
} from './error-prisma';

describe('errores de Prisma', () => {
  it('lee el código solo de errores de Prisma', () => {
    expect(codigoErrorPrisma({ code: 'P2002' })).toBe('P2002');
    expect(codigoErrorPrisma({ code: 'ENOENT' })).toBeNull();
    expect(codigoErrorPrisma(new Error('x'))).toBeNull();
    expect(codigoErrorPrisma(null)).toBeNull();
  });

  it('traduce los errores comunes a respuestas HTTP sin datos internos', () => {
    expect(traducirErrorPrisma({ code: 'P2002' })?.getStatus()).toBe(409);
    expect(traducirErrorPrisma({ code: 'P2025' })?.getStatus()).toBe(404);
    expect(traducirErrorPrisma({ code: 'P2003' })?.getStatus()).toBe(409);
    expect(traducirErrorPrisma({ code: 'P2000' })?.getStatus()).toBe(400);
    expect(traducirErrorPrisma({ code: 'P1001' })?.getStatus()).toBe(503);
    expect(traducirErrorPrisma({ code: 'P2024' })?.getStatus()).toBe(503);
    expect(traducirErrorPrisma({ code: 'P9999' })).toBeNull();
    expect(traducirErrorPrisma(new Error('otro'))).toBeNull();
  });

  it('relanza como 409 solo los duplicados', () => {
    expect(() => relanzarDuplicado({ code: 'P2002' }, 'Repetido')).toThrow(
      'Repetido',
    );
    const otro = new Error('otro');
    expect(() => relanzarDuplicado(otro, 'Repetido')).toThrow(otro);
  });
});
