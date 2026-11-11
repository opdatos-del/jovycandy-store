# Plan maestro — JovyCandy 3.0

**Estado:** cimientos técnicos en curso. Este documento distingue decisiones aprobadas, evidencia de referencias y trabajo futuro; no describe funcionalidades aún no implementadas como disponibles.

## Propósito y alcance

JovyCandy 3.0 se reconstruirá como una plataforma nueva y aislada dentro de `prototipo`. Las carpetas `web-jovycandy` y `admin-webjovy` son referencias de lectura: no son dependencias de ejecución, no se migran como código y no se modifican.

La infraestructura inicial incluye monorepo, Next.js, Medusa, PostgreSQL local conectado y migraciones oficiales. La fase administrativa incorpora el primer bloque CMS `jovy_content`; no incluye catálogo comercial, cuentas B2C, carrito, checkout, diseño público ni integraciones reales.

## Inventario de referencias

### Web corporativa original

La auditoría de `web-jovycandy` identifica una SPA React/Vite con i18n ES/EN, PWA, navegación de una página y secciones de hero, identidad, categorías/catálogo, carrusel, certificaciones, eventos/galería, promociones, contacto, ubicación, selector de idioma y footer. Sus assets corporativos autorizados incluyen logotipo, isotipos, materiales de certificación, imágenes de marketing y video. Podrán revisarse y seleccionarse en fases de diseño; no se han copiado en esta entrega.

Limitaciones que resuelve el nuevo storefront: la SPA actual no tiene rutas de producto, SEO comercial por URL ni un dominio de comercio (precio, stock, variantes, carrito o pedido).

### Administrador original

La auditoría de `admin-webjovy` identifica gestión editorial de productos de catálogo, categorías, hero, promociones, eventos, galería, logos, contactos, usuarios, roles y estadísticas. Su modelo de producto no contiene SKU, precio, stock, variantes ni pedidos, por lo que no se reutilizará como fuente comercial.

| Capacidad actual | Destino previsto |
| --- | --- |
| Productos, variantes, precios, inventario, clientes, pedidos | Medusa nativo |
| Región, moneda, sales channel, envíos y pagos DEMO | Configuración oficial de Medusa |
| Hero, banners, carruseles, eventos, galerías, marca y SEO editorial | Módulos DML de Medusa futuros |
| Contactos y auditoría CMS | Módulos/API administrativos de Medusa futuros |
| Gestión comercial y editorial | Medusa Admin nativo, UI Routes/Widgets solo cuando sea necesario |

## Arquitectura aprobada

- **Repositorio:** un Git independiente en `prototipo`, con remoto privado configurado y sin repositorios anidados.
- **Workspace:** pnpm 11 con lockfile autoritativo en la raíz. Un lockfile anidado generado por Next.js está pendiente de eliminación autorizada.
- **Storefront:** Next.js App Router, TypeScript estricto, Tailwind y Server Components por defecto en `apps/storefront`.
- **Backend y administración:** Medusa v2 y su Admin nativo en `apps/backend`.
- **Persistencia:** PostgreSQL local y aislado, con base prevista `jovycandy_prototipo_medusa`.
- **Infraestructura:** desarrollo local, sin Docker, Redis, servicios paralelos Express, despliegues ni integraciones productivas.

Se descartaron como alternativas: conservar Vite/Express/MySQL como nueva plataforma (duplica comercio y conserva límites de SEO), un administrador Next.js separado (duplica Medusa Admin), y Turborepo/paquetes compartidos en esta entrega (no añaden valor con dos aplicaciones base todavía).

## Límites y dirección de dependencias

1. El storefront depende de APIs públicas de Medusa; no accede a PostgreSQL.
2. Medusa es la fuente de verdad comercial; el CMS futuro solo enlaza productos por identificador y no duplica SKU, precio, variantes, inventario ni pedidos.
3. Los módulos editoriales futuros viven en Medusa y exponen APIs públicas exclusivamente para contenido publicado; el CRUD administrativo queda protegido.
4. Los originales no participan en el runtime ni en la base de datos del prototipo.

## Modelo previsto para fases posteriores

| Área | Fuente de verdad | Regla |
| --- | --- | --- |
| Producto, variante, precio, stock, carrito, pedido, cliente | Medusa | No se duplican en CMS |
| Página, hero, banner, carrusel, evento, galería, marca, SEO | Módulos editoriales Medusa | Borrador y publicación separados |
| Producto destacado | Enlace editorial a producto Medusa | Solo orden, estado y texto/imagen editorial opcionales |
| Contacto y auditoría | Módulos Medusa | Nunca exponer solicitudes ni tokens en API pública |

Las APIs futuras se dividirán entre Store API para contenido publicado/comercio público y APIs administrativas autenticadas para el Admin. Sus contratos se diseñarán antes de exponer consumidores.

## Orden de implementación

1. **Cimientos actuales:** crear administrador local y validar runtime, login y reinicio de Medusa.
2. **CMS administrativo:** completar módulos editoriales por bloques verticales, empezando por `jovy_content` ya migrado.
3. **Diseño:** analizar assets y establecer dirección/sistema visual corporativo.
4. **Primer vertical comercial:** home → carrusel DEMO → ficha DEMO → carrito Medusa → checkout DEMO.
5. **Cuentas B2C:** auth Medusa, sesiones BFF seguras, perfil, direcciones y pedidos.
6. **Calidad transversal:** pruebas unitarias, integración, Playwright, accesibilidad, SEO, PWA evaluada y revisión visual.

## Seguridad

- No se leen, copian ni documentan secretos de los proyectos originales.
- `.env` está ignorado; solo se versionan archivos `.env.example` con marcadores.
- La base nueva no reutilizará nombres de las bases históricas prohibidas.
- Los secretos de JWT y cookies serán únicos y locales; no se expondrán al cliente.
- No habrá pagos, correos, paqueterías, inventario productivo ni despliegues durante el prototipo base.

## Estrategia de pruebas

En esta fase: instalación reproducible, lint, typecheck, build y prueba HTTP del storefront. Tras disponer de la base, se añaden validaciones de migración, health endpoint, Admin y persistencia tras reinicio. Las pruebas de comportamiento se incorporarán con los primeros flujos, en el nivel más bajo adecuado; Playwright se introducirá al primer recorrido vertical.

## Riesgos y bloqueos conocidos

| Riesgo o bloqueo | Tratamiento |
| --- | --- |
| Store API sin Publishable API Key configurada | Configurarla en la fase Store; no usar una clave productiva |
| Sin pruebas E2E del CMS | Añadir Playwright tras estabilizar los siguientes módulos editoriales |
| Peer dependencies transitivas del starter Medusa | Registrar salida de `pnpm peers check`; no forzar versiones oficiales |
| Generador Medusa actual crea un wrapper DTC | Se extrajo solo el backend oficial a la estructura aprobada; no se instaló el storefront de Medusa |
| Node requerido por Medusa | Raíz restringida a Node `>=22.23.4 <25`; entorno actual Node 24 cumple |

## Criterios de aceptación de esta entrega

- [x] `prototipo` es un Git y workspace pnpm aislados.
- [ ] Eliminar el lockfile anidado generado `apps/storefront/pnpm-lock.yaml` — bloqueado hasta autorización destructiva explícita.
- [x] Next.js está en `apps/storefront` y Medusa en `apps/backend`.
- [x] No existe backend Express ni administrador adicional.
- [x] Ambos proyectos compilan.
- [x] Storefront responde HTTP 200 de forma temporal.
- [x] Base `jovycandy_prototipo_medusa` creada, conectada y migrada.
- [x] Health, Admin, cuenta administrativa y reinicio de Medusa — validados mediante instancias temporales y credenciales locales ignoradas.
