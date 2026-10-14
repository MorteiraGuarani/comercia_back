export interface OpcionSelector<TId extends number | string = number> {
  id: TId;
  nombre?: string;
  descripcion?: string;
}
