import { avanceTareasPorLocal } from './avance-tareas';

describe('avanceTareasPorLocal', () => {
  const tareas = [
    { id: 1, esObligatoria: true, todosLocales: true, locales: [] },
    { id: 2, esObligatoria: false, todosLocales: true, locales: [] },
  ];

  it('multiplica las tareas por los locales de la ruta', () => {
    expect(
      avanceTareasPorLocal(['A', 'B', 'C'], tareas, [
        { localId: 'A', cumplimientos: [{ tareaId: 1 }, { tareaId: 2 }] },
        { localId: 'B', cumplimientos: [{ tareaId: 2 }] },
      ]),
    ).toEqual({ total: 6, completadas: 3, obligPendientes: 2 });
  });

  it('una tarea de ciertos locales solo cuenta en esos', () => {
    expect(
      avanceTareasPorLocal(
        ['A', 'B'],
        [
          {
            id: 3,
            esObligatoria: true,
            todosLocales: false,
            locales: [{ localId: 'B' }],
          },
        ],
        // Hecha en A no cuenta: la tarea es solo de B.
        [{ localId: 'A', cumplimientos: [{ tareaId: 3 }] }],
      ),
    ).toEqual({ total: 1, completadas: 0, obligPendientes: 1 });
  });
});
