import type { EquipoCampo } from "@/types/rol";

export function destinatarioCampo(
  equipo?: EquipoCampo | null,
): "IMPULSADOR" | "REPOSITOR" | null {
  return equipo?.activo ? equipo.tipo : null;
}
