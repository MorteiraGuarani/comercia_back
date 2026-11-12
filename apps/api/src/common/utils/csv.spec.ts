import { aCsv } from './csv';

describe('aCsv', () => {
  it('separa con punto y coma, escapa comillas y anula fórmulas', () => {
    expect(
      aCsv(
        ['Local', 'Cantidad'],
        [
          ['Súper "6"; Galería', 3],
          ['=1+1', null],
        ],
      ),
    ).toBe('﻿Local;Cantidad\r\n"Súper ""6""; Galería";3\r\n\'=1+1;\r\n');
  });
});
