# File Module y almacenamiento S3-compatible

**Corte:** 2026-11-25
**Estado:** PREPARADO SIN EJECUTAR / BLOQUEADO para S3 remoto.
**Proveedor local:** `file-local` con `upload_dir: static`.
**Proveedor remoto:** `file-s3`, opt-in.
**Staging autorizado:** usa `file-local` con volumen persistente mediante
`STAGING_ALLOW_LOCAL_STORAGE=true`; la excepción se rechaza en producción.

## Configuración actual

Desarrollo conserva:

```dotenv
FILE_STORAGE_PROVIDER=local
# FILE_BACKEND_URL=http://localhost:9000/static
```

El provider local escribe en `apps/backend/static/`, que no se versiona. Las
URLs usan `FILE_BACKEND_URL` o el puerto real del servidor para que E2E con
`PORT=9001` no apunte a 9000.

Para activar S3 se exige configuración completa:

```dotenv
FILE_STORAGE_PROVIDER=s3
S3_FILE_URL=https://cdn.example/jovycandy-staging
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
# Ambas credenciales se cargan desde el gestor de secretos del entorno.
S3_REGION=us-east-1
S3_BUCKET=jovycandy-staging
S3_ENDPOINT=https://s3.example
```

El preflight de staging/producción rechaza:

- `FILE_STORAGE_PROVIDER=local`, salvo `DEPLOYMENT_ENV=staging` con
  `STAGING_ALLOW_LOCAL_STORAGE=true`;
- `S3_FILE_URL` no HTTPS, con query o con fragmento;
- credenciales que conserven un placeholder;
- `S3_ENDPOINT` no HTTPS.

La excepción de staging genera una advertencia y exige que el volumen `static`
sea persistente y respaldado. `STAGING_ALLOW_LOCAL_STORAGE=true` con
`DEPLOYMENT_ENV=production` falla el arranque.

`S3_FILE_URL` se normaliza sin slash final.

## Lo que no se ejecutó

No existe bucket, cuenta ni endpoint autorizado. Por tanto no se validó:

- subida real de PNG, WebP o video;
- lectura pública o firmada;
- CORS del bucket;
- límites de tamaño;
- rechazo de MIME inválido;
- borrado y restauración;
- migración de medios locales.

No se generó un manifiesto de medios ni se sustituyeron URLs. Hacerlo sin bucket
y sin backup violaría la restricción de no tocar medios reales.

## Plan de migración reversible

1. Inventariar cada referencia por módulo propietario: producto, galería,
   hover, overlay, `layered`, banner, logo, certificación, video y novedad.
2. Registrar identificador, URL actual, tipo, tamaño, hash y referencias.
3. Copiar al bucket de laboratorio conservando el nombre lógico.
4. Verificar hash y lectura antes de cambiar una referencia.
5. Actualizar referencias en una transacción o lote controlado.
6. Ensayar rollback con las URLs originales.
7. Conservar los originales hasta cerrar la validación.

## Video y concurrencia

El carril de video usa archivos temporales y un lock en memoria por proceso
(`acquireEventVideoUploadLock`). En una sola instancia funciona; en varias
instancias no limita subidas concurrentes globales.

Antes de staging multi-instancia hay que decidir:

- lock compartido en Redis o base de datos;
- límite global por usuario y por entorno;
- limpieza de temporales ante caída del proceso;
- timeout de subida y aborto del cliente;
- almacenamiento temporal compartido o subida directa al bucket.

No se cambió el carril de video en esta campaña porque no hay bucket autorizado
ni topología multi-instancia aprobada.

## Pruebas posibles sin infraestructura

| Prueba | Estado |
|---|---|
| Rechazo de configuración S3 incompleta | PASS (preflight unitario) |
| Rechazo de S3 HTTP en staging | PASS (preflight unitario) |
| Provider local por defecto | PASS |
| Excepción local solo en staging | PASS |
| Rechazo de la excepción en producción | PASS |
| Subida/lectura real en S3 | BLOQUEADO |

## Dictamen

**BLOQUEADO.** El código y la configuración están preparados; la validación real
requiere un bucket aislado, credenciales temporales, política CORS y un plan de
backup aprobados. No se declara S3 operativo.
