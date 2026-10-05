export function destinatarioCampo(rol?: string | null): "IMPULSADOR" | "REPOSITOR" {
  const nombre = rol?.toLowerCase().replace(/[^a-z]/g, "");
  return nombre === "repositor" || nombre === "supervisorrepositores"
    ? "REPOSITOR"
    : "IMPULSADOR";
}
