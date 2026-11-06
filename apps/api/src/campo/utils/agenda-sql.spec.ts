import { Prisma } from '../../../generated/prisma/client';
import { busquedaAgenda } from './agenda-sql';

describe('busquedaAgenda', () => {
  it('vacío no filtra', () => {
    expect(busquedaAgenda()).toBe(Prisma.empty);
    expect(busquedaAgenda('   ')).toBe(Prisma.empty);
  });

  it('busca sin mayúsculas ni acentos y escapa los comodines de LIKE', () => {
    const sql = busquedaAgenda('  PELLÓN 50%_ ');
    expect(sql.values).toContain('%pellon 50\\%\\_%');
    // Nombre, alias, CardCode y dirección usan el mismo patrón parametrizado.
    expect(sql.values.filter((v) => v === '%pellon 50\\%\\_%')).toHaveLength(4);
    expect(sql.sql).toContain('tbl_crd1');
  });
});
