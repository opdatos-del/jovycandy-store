# Extensiones Medusa Admin

## Implementado

La ruta `src/admin/routes/jovy/content/page.tsx` se registra como **Contenido Jovy**. Usa `defineRouteConfig`, Medusa UI y las APIs de Medusa en el mismo origen para listar, crear, editar y eliminar páginas editoriales.

La interfaz muestra estado, formulario bilingüe, estados de carga, error accesible y confirmación nativa antes de eliminar. No crea otro panel ni duplica la pantalla nativa de productos.

## Planeado

- Widgets en ficha de producto para atributos editoriales ligados a productos Medusa.
- Rutas para marketing, eventos, galerías y contactos solo después de disponer de sus módulos/API/pruebas.
- Carga de archivos con File Module; ninguna ruta de subida heredada.
