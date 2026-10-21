import type { RegistroSocio } from './registro-socio.interface';

// Adaptador interno para las once tablas de la lista fija. Sus columnas se
// validan con el DTO específico antes de llegar a los delegados de Prisma.
export interface RepositorioSocios {
  count(args: object): Promise<number>;
  findMany(args: object): Promise<RegistroSocio[]>;
  findFirst(args: object): Promise<RegistroSocio | null>;
  create(args: object): Promise<RegistroSocio>;
  createMany(args: object): Promise<{ count: number }>;
  update(args: object): Promise<RegistroSocio>;
  delete(args: object): Promise<RegistroSocio>;
  aggregate(args: object): Promise<{ _max: { Code: number | null } }>;
}
