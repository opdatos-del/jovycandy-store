# Seguridad administrativa CMS

## Controles implementados

- `/admin/jovy/*` se protege con `authenticate("user", ["session", "bearer", "api-key"])` de Medusa.
- Las mutaciones se realizan en workflows y registran actor, entidad, acción, fecha implícita y metadatos no sensibles.
- Zod valida longitud, slug, estado, estructura bilingüe, SEO y fecha ISO antes de persistir.
- Las rutas públicas filtran en servidor por estado y programación, sin exponer borradores, identificadores internos ni auditoría.
- Las páginas se eliminan mediante soft delete del modelo DML.

## Riesgos y controles pendientes

| Riesgo | Tratamiento |
| --- | --- |
| Autorización CMS granular | Medusa Admin autentica al usuario, pero no se afirma RBAC fino hasta verificar licencia y APIs de la instalación. No hay endpoint para autootorgar roles. |
| Archivos | Sin carga implementada. El futuro File Module debe validar tipo real, tamaño, destino y acceso; no se aceptarán rutas arbitrarias. |
| Contactos | Aún no implementado. Requerirá rate limiting, minimización de datos, vistas administrativas autorizadas y ausencia total de lectura pública. |
| Secretos | `.env` sigue ignorado; no se leyeron ni copiaron credenciales históricas. |

No aplican pagos, redirecciones, comandos de usuario ni integraciones de terceros en este bloque.
