export interface RegistroTabla {
  id: bigint;
  [campo: string]: unknown;
}
export interface RepositorioTabla {
  count(args: object): Promise<number>;
  findMany(args: object): Promise<RegistroTabla[]>;
  findFirst(args: object): Promise<RegistroTabla | null>;
  create(args: object): Promise<RegistroTabla>;
  createMany(args: object): Promise<{ count: number }>;
  update(args: object): Promise<RegistroTabla>;
  delete(args: object): Promise<RegistroTabla>;
}
