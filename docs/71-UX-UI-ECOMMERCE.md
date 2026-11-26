# UX/UI del ecommerce

**Estado:** IMPLEMENTADO EN LABORATORIO.

## Identidad

Se conserva el sistema visual del catálogo:

- azul Jovy, aqua, coral y rosa;
- tipografía sans condensada;
- superficies blancas y crema;
- bordes finos, radios suaves y badges tipo píldora;
- packshots protagonistas.

## Pantallas

- Catálogo full-width con sidebar sticky.
- Ficha con galería, variantes, cantidad, precio y relacionados.
- Drawer de carrito con foco, Escape, backdrop y estado vacío.
- Página de carrito con edición y totales.
- Checkout en cuatro pasos con resumen persistente.
- Confirmación con número de pedido y mensaje.
- Cuenta con login, registro, direcciones e historial.

## Estados

Cada flujo contempla:

- loading;
- vacío;
- error;
- disabled;
- éxito;
- disponible/no disponible;
- reintento.

## Responsive

- 375: una columna, drawer de ancho completo, formularios apilados.
- 768: dos columnas donde aplica.
- 1280/1440/1920: catálogo de 5/6 columnas y checkout con resumen lateral.

## Accesibilidad

- un solo `h1` por vista;
- labels visibles;
- botones con nombre accesible;
- `<dialog>` nativo;
- foco visible;
- mensajes `role="status"`/`role="alert"`;
- objetivos táctiles de 44 px;
- `prefers-reduced-motion`.

## Feedback y movimiento

- notificaciones discretas para agregar, eliminar, iniciar/cerrar sesión y confirmar pedido;
- skeletons por ruta para que la navegación se sienta inmediata;
- animación corta en galería, badge del carrito, drawer y confirmación de pedido;
- motor visual de tarjeta con zoom global por defecto y modos swap/layered/none administrables desde Medusa;
- spinners por línea del carrito sin bloquear el resto de la interfaz;
- barra de compra fija en móvil;
- todo el movimiento se desactiva con `prefers-reduced-motion`.

## Pendiente

- Auditoría manual con lector de pantalla.
- Prueba de contraste final con contenido definitivo.
- Revisión de zoom al 200 %.
