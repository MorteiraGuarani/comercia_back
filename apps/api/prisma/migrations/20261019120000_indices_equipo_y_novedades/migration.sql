-- Usuarios activos por empresa, jerarquía (equipo de cada líder) y búsqueda por celular.
CREATE INDEX "usuarios_empresa_id_is_active_idx" ON "usuarios"("empresa_id", "is_active");
CREATE INDEX "usuarios_superior_id_idx" ON "usuarios"("superior_id");
CREATE INDEX "usuarios_celular_idx" ON "usuarios"("celular");

-- Novedades de un colaborador en un período (resumen y detalle de supervisión).
CREATE INDEX "campo_novedades_usuario_id_creado_at_idx" ON "campo_novedades"("usuario_id", "creado_at");
