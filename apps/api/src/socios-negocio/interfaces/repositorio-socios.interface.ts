import type { RepositorioTabla } from '../../common/interfaces/repositorio-tabla.interface';

// Adaptador interno para las nueve tablas de la lista fija. Sus columnas se
// validan con el DTO específico antes de llegar a los delegados de Prisma.
export interface RepositorioSocios extends RepositorioTabla {
  aggregate(args: object): Promise<{ _max: { Code: number | null } }>;
}
