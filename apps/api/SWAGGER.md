# Documentacion de la API

- Interfaz: `/api/docs`.
- OpenAPI JSON: `/api/docs-json`.
- OpenAPI YAML: `/api/docs-yaml`.
- Se activa con `SWAGGER_ENABLED=true`; `false` elimina las tres rutas.
- En produccion requiere una sesion vigente de superadmin: cookie de la API
  obtenida al iniciar sesion en Comercia, o `Authorization: Bearer <token>`.
  Tambien se protegen los archivos de Swagger; no se cachea la documentacion.
- Los permisos de los endpoints siguen vigentes. Abrir la documentacion no
  autoriza ejecutar una operacion que el usuario no pueda realizar.
- Los DTOs y sus validaciones se documentan mediante el plugin de compilacion
  de `@nestjs/swagger`. No se generan esquemas a partir de modelos Prisma.
- Prueba aislada: `npm run build --workspace=api` y luego
  `npm run test:swagger --workspace=api`. No usa la base de produccion.

Produccion: https://api.comercia.pro/api/docs

Referencia del plugin: https://docs.nestjs.com/openapi/cli-plugin
