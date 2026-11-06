import { filtrosBusquedaUsuario } from './busqueda-usuario';

describe('filtrosBusquedaUsuario', () => {
  it('separa nombre completo en términos AND con columnas OR', () => {
    const filtros = filtrosBusquedaUsuario('  Ana   Rojas ');

    expect(filtros).toHaveLength(2);
    expect(filtros[0]).toEqual({
      OR: [
        { nombre: { contains: 'Ana', mode: 'insensitive' } },
        { apellido: { contains: 'Ana', mode: 'insensitive' } },
        { nombreLogin: { contains: 'Ana', mode: 'insensitive' } },
        { correo: { contains: 'Ana', mode: 'insensitive' } },
        { legajo: { contains: 'Ana', mode: 'insensitive' } },
        { ruc: { contains: 'Ana', mode: 'insensitive' } },
      ],
    });
    expect(filtros[1]).toEqual({
      OR: [
        { nombre: { contains: 'Rojas', mode: 'insensitive' } },
        { apellido: { contains: 'Rojas', mode: 'insensitive' } },
        { nombreLogin: { contains: 'Rojas', mode: 'insensitive' } },
        { correo: { contains: 'Rojas', mode: 'insensitive' } },
        { legajo: { contains: 'Rojas', mode: 'insensitive' } },
        { ruc: { contains: 'Rojas', mode: 'insensitive' } },
      ],
    });
  });

  it('no agrega condiciones para una búsqueda vacía', () => {
    expect(filtrosBusquedaUsuario('   ')).toEqual([]);
  });

  it('permite buscar referencias ERP solo cuando el ABM lo solicita', () => {
    for (const campo of [
      'ERP_CodigoAlmacen',
      'ERP_NombreAlmacen',
      'ERP_CodUsuarioSap',
    ])
      expect(filtrosBusquedaUsuario('ALM01', true)[0].OR).toContainEqual({
        [campo]: { contains: 'ALM01', mode: 'insensitive' },
      });
    expect(
      filtrosBusquedaUsuario('ALM01')[0].OR?.some(
        (f) => 'ERP_CodigoAlmacen' in f,
      ),
    ).toBe(false);
  });
});
