# Retención de solicitudes de contacto

Estado del documento: **PROPUESTO**. Describe el comportamiento observable del laboratorio y
propone una política de retención que **requiere aprobación del negocio y revisión legal**. No se
declara cumplimiento normativo: este repositorio no define base legal, plazos obligatorios ni
encargados de tratamiento.

## Alcance

- Tablas `jovy_contact_request` y `jovy_contact_audit_log` del módulo `jovy-contacts`.
- Intake público `POST /store/jovy/contacts` y gestión en `/admin/jovy/contacts`.
- No cubre pedidos, clientes de Medusa ni el buzón de correo que reciba futuras notificaciones.

## Qué se guarda

| Campo | Motivo operativo | Sensible |
| --- | --- | --- |
| `first_name`, `last_name` | Identificar al remitente y responder | Sí |
| `email` | Canal de respuesta | Sí |
| `phone`, `country`, `city`, `postal_code` | Contacto comercial y logística | Sí |
| `contact_type` | Enrutar a ventas nacionales, internacionales, atención o catálogo | No |
| `message` | Contenido de la solicitud | Sí (puede incluir PII libre) |
| `status`, `handled_at`, `handled_by` | Seguimiento y trazabilidad interna | No |
| `admin_notes` | Notas internas de seguimiento | Sí |
| `created_at`, `updated_at`, `deleted_at` | Ciclo de vida y borrado lógico | No |
| `actor_id`, `action`, `metadata` en `jovy_contact_audit_log` | Auditoría de la gestión | No (sólo estado y tipo) |

## Qué NO se guarda

- La IP del remitente: sólo se usa en memoria para el límite de frecuencia (`src/lib/jovy/contact-rate-limit.ts`).
- `User-Agent`, `Referer`, cookies, `X-Forwarded-For` ni identificadores de dispositivo.
- Envíos que activan el honeypot (`website` con valor): responden `202` y no se persisten.
- Campos desconocidos: `publicContactSchema` es `.strict()`, así que un campo extra devuelve `400` en
  lugar de almacenarse.
- Datos personales en la auditoría: el workflow sólo escribe `status` y `contact_type`
  (`contactAuditMetadata` en `src/lib/jovy/audit.ts`). Nunca mensaje, email, teléfono ni notas.

## Quién accede

- Todas las rutas `/admin/jovy/*` exigen `authenticate("user", ["session", "bearer", "api-key"])`
  (`src/api/middlewares.ts`). Sin sesión o token la respuesta es `401` con `{ "message": "Unauthorized" }`.
- Hoy **cualquier** actor `user` autenticado puede listar y editar contactos: no hay RBAC ni
  separación por rol (`docs/19-SEGURIDAD-ADMIN.md`). Es el hueco principal antes de producción.
- El `actor_id` de cada mutación se toma de la sesión y se guarda en `jovy_contact_audit_log`.
- El listado admin pagina y filtra en el servidor (`limit` 1–100, por defecto 20; `offset` ≥ 0;
  `status`, `contact_type`, `q`), pero sigue devolviendo PII a todo admin autenticado.

## Límite de frecuencia (laboratorio)

- 5 solicitudes por IP cada 10 minutos, en memoria y **por proceso**: se reinicia al reiniciar el
  backend y no coordina varias instancias.
- La respuesta `429` incluye `Retry-After` con los segundos restantes de la ventana.
- Las solicitudes rechazadas por validación (`400`) no consumen cuota; el honeypot sí.
- Para producción se requiere un almacén compartido (Redis/PostgreSQL) o un límite en el borde.
  No se implementa aquí para no introducir una dependencia nueva.

## Retención propuesta (pendiente de aprobación)

Los plazos son una **propuesta de laboratorio**, no un requisito legal verificado.

| Estado | Plazo propuesto | Acción al vencer |
| --- | --- | --- |
| `pending` sin atender | 180 días desde `created_at` | Borrado lógico y anonimización posterior |
| `handled` | 365 días desde `handled_at` | Borrado lógico y anonimización posterior |
| Borrado lógicamente (`deleted_at`) | 30 días de gracia | Purga física de datos personales (no implementada) |
| `jovy_contact_audit_log` | 365 días | Purga de filas antiguas (no implementada) |

Supuestos que el negocio debe confirmar:

1. Qué base legal aplica a cada tipo de contacto (ventas, atención, catálogo).
2. Si una solicitud convertida en cliente debe conservarse mientras dure la relación comercial.
3. Si se exige consentimiento explícito, texto de aviso de privacidad y enlace en el formulario.
4. Si el plazo se cuenta desde la recepción o desde el cierre del seguimiento.
5. Qué autoridad, responsable y encargado de tratamiento se declaran.

## Exportación

- **No implementada.** No existe ruta CSV/JSON ni `Content-Disposition` en
  `src/api/admin/jovy/contacts/`.
- Propuesta: `GET /admin/jovy/contacts/export` autenticado, con los mismos filtros del listado, tope
  de filas, auditoría de la exportación (actor, filtros, cantidad) y sin incluir `admin_notes` salvo
  para perfiles con permiso explícito.
- Mientras no exista, la exportación se hace desde la base de datos con acceso restringido.

## Borrado lógico y derecho de supresión

- `DELETE /admin/jovy/contacts/:id` ejecuta `softDeleteJovyContactRequests`: la fila y su auditoría
  permanecen con `deleted_at`, y el listado deja de mostrarla. No hay ruta de restauración.
- Esto **no** satisface todavía una supresión real: no existe purga física ni anonimización de
  `first_name`, `email`, `phone`, `message` ni `admin_notes`. Ambas tareas están pendientes.
- No se borran archivos de medios compartidos desde este flujo; el módulo de contactos no toca el
  File Module.

## Qué falta para producción

1. RBAC por recurso (`jovy_contact:read/update/delete`) y principio de mínimo privilegio.
2. Limitador de frecuencia compartido o en el borde.
3. Job programado de retención y purga/anonimización, con auditoría de la propia purga.
4. Exportación controlada y auditada.
5. Aviso de privacidad verificado, base legal y plazos aprobados.
6. Cifrado en reposo o seudonimización de campos sensibles, si el negocio lo exige.
7. Registro de accesos de lectura al detalle (hoy sólo se auditan mutaciones).
