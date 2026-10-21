import type { Type } from '@nestjs/common';
import { CargaTablaPipe } from '../../common/pipes/carga-tabla.pipe';
import { MAX_SOCIOS_POR_LOTE } from '../tablas-socios';
export class CrearSociosPipe extends CargaTablaPipe {
  constructor(Dto: Type<object>, admiteLote = true) {
    super(Dto, admiteLote, MAX_SOCIOS_POR_LOTE);
  }
}
