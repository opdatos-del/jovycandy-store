# Mapeo funcional: administrador original → Medusa

## Decisiones

| Dominio | Decisión | Justificación |
| --- | --- | --- |
| Comercio | Product, Pricing, Inventory, Customer y Order nativos | Evita duplicar la fuente de verdad comercial. |
| Páginas corporativas | `jovy_content` DML | Es contenido editorial independiente del comercio y requiere publicación bilingüe. |
| Hero/banners/destacados | Módulo Marketing Content futuro | Necesita programación, prioridad y enlaces editoriales, no un catálogo paralelo. |
| Eventos | Módulo Events futuro | Tiene ciclo editorial y fechas propios. |
| Galerías/logos | Gallery/Brand Content futuro + File Module | Los archivos pertenecen a Medusa y no a un directorio público administrado por código propio. |
| Contactos | Contact Module futuro | Datos personales, estados operativos y acceso exclusivamente administrativo. |
| Roles | Administración nativa Medusa | No se migra el JWT ni las contraseñas históricas; RBAC fino se evaluará contra licencia/capacidades reales. |
| Analítica y SSE | Diferidos | No hay requisito actual ni fuente aprobada que justifique persistir telemetría o conexiones públicas. |

## Primer contrato implementado

`jovy_content` administra páginas con `slug` único, traducciones ES/EN, SEO, estado `draft|published|archived` y programación opcional. Las mutaciones pasan por workflows y dejan auditoría. La API pública devuelve exclusivamente páginas publicadas y cuya fecha ya llegó.

## Compatibilidad

Los nuevos endpoints `/admin/jovy/*` y `/store/jovy/*` son contratos nuevos: el storefront aún no los consume. Por ello no se conserva la semántica de los endpoints Express históricos ni se versionan rutas obsoletas.
