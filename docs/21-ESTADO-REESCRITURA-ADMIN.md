# Estado — reescritura administrativa en Medusa

| Área | Estado | Evidencia |
| --- | --- | --- |
| PostgreSQL y migraciones Medusa base | COMPLETADO Y VALIDADO | `medusa db:migrate` ejecutado sobre `jovycandy_prototipo_medusa` |
| Auditoría del administrador histórico | COMPLETADO Y VALIDADO | `13-AUDITORIA-ADMIN-ORIGINAL.md`, fuentes en modo lectura |
| Mapeo a Medusa | COMPLETADO Y VALIDADO | `14-MAPEO-ADMIN-MEDUSA.md` |
| Módulo `jovy_content` | COMPLETADO Y VALIDADO | DML, migración `Migration20261111174909.ts`, workflows, APIs, auditoría y prueba unitaria |
| Ruta Medusa Admin Contenido Jovy | IMPLEMENTADO SIN VALIDAR EN RUNTIME | Compila en `medusa build`; pendiente login manual/E2E |
| Marketing: hero/banners/destacados | DISEÑADO | No implementado |
| Eventos y galerías | DISEÑADO | No implementado |
| Productos editoriales y Module Links | PENDIENTE | Depende de catálogo Medusa futuro |
| Contactos | DISEÑADO | No implementado |
| RBAC fino / roles | BLOQUEADO POR VERIFICACIÓN | Requiere validar capacidades/licencia de Medusa instalada |
| Health, `/app` y login | COMPLETADO Y VALIDADO | Instancia temporal: `/health` 200, `/app` 200, login 200 y API administrativa CMS 200 |
| Persistencia tras reinicio | COMPLETADO Y VALIDADO | Migración, usuario local y login fueron comprobados tras iniciar instancias temporales separadas |
| Store API publicada con API key | BLOQUEADO POR CONFIGURACIÓN | Medusa exige Publishable API Key; no se creó una en esta fase administrativa |

## Próximo paso reproducible

1. Configurar una Publishable API Key al iniciar la fase Store para probar la respuesta pública publicada con el mecanismo nativo.
2. Añadir aserciones HTTP automatizadas para auditoría y CRUD del módulo `jovy_content`.
3. Ejecutar prueba visual/manual o E2E de la ruta **Contenido Jovy** antes de iniciar el módulo Marketing.
