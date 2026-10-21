import { IntersectionType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EmpresaSociosParams } from '../../socios-negocio/dto/consulta-socios.dto';
import type { TablaProductos } from '../interfaces/tabla-productos.interface';

/** Los códigos se conservan como texto; solo las listas y líneas son int4. */
export function parametrosClave(t: TablaProductos) {
  const Dto = IntersectionType(
    EmpresaSociosParams,
    PickType(t.Dto, t.clave as never[]),
  );
  Object.defineProperty(Dto, 'name', { value: 'Clave_' + t.nombre });
  for (const campo of t.clave)
    if (typeof t.ejemplo[campo] === 'number')
      Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' && /^-?\d+$/.test(value)
          ? Number(value)
          : Number.NaN,
      )(Dto.prototype as object, campo);
  return Dto;
}
