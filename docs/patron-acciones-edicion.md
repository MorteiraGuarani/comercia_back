# Acción Editar en COMERCIA

Las pantallas que muestran registros deben usar [`BotonEditar`](../apps/web/src/components/boton-editar.tsx) para abrir la edición. Este componente mantiene el mismo icono de lápiz que el Catálogo de Clientes, el tamaño táctil, los colores del tema, el estado de foco y el nombre accesible.

## Uso en listados

- En las acciones de una tabla de escritorio, usar el modo predeterminado: solo icono de lápiz. Ubicar **Editar** antes de Mapa, Ruta, Eliminar u otras acciones de la misma fila.
- En tarjetas o listas móviles, usar `modo="texto"`: el botón dice **Editar** y tiene al menos 44 px de alto. Si la fila es demasiado estrecha para texto, se puede usar el icono; el componente conserva un objetivo táctil de 44 px en móvil.
- Pasar en `etiqueta` la acción y el registro concreto. El componente la usa en `aria-label` y `title`, aunque el botón visible sea solo un icono.
- Usar el mismo callback de edición que ya abre el formulario o la pantalla. No copiar estilos ni dibujar otro lápiz en cada módulo.

```tsx
import { BotonEditar } from "@/components/boton-editar";

// Tabla de escritorio
<BotonEditar
  onClick={() => abrirEditar(local)}
  etiqueta={`Editar local ${local.nombre}`}
/>

// Lista móvil
<BotonEditar
  onClick={() => abrirEditar(local)}
  etiqueta={`Editar local ${local.nombre}`}
  modo="texto"
/>
```

El patrón se aplica a Clientes, PDV y rutas, Tareas, Usuarios, Roles, Empresas, Módulos y la planificación de horarios. Los botones de **Guardar** dentro de los formularios mantienen su texto propio: no son acciones de edición de una fila.
