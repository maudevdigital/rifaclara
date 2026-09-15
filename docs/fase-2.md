# Fase 2 · Rifas completas

Plan técnico. Cada entrega se puede publicar por separado.

## Entregas

| # | Entrega | Qué incluye |
|---|---|---|
| 2.1 ✅ | Cuentas | Ingreso con enlace mágico por correo, sesiones, panel vacío |
| 2.2 ✅ | Crear rifa y página pública | Formulario de creación, `/r/:slug` con la grilla de números |
| 2.3 ✅ | Reservas y boleto | Elegir números, reservar sin cuenta, boleto `/boleto/:codigo` |
| 2.4 ✅ | Panel del organizador | Marcar pagado, liberar, WhatsApp, vencimiento automático |
| 2.5 ✅ | Cierre y sorteo | Congelar la lista, sorteo verificable, página de resultados |

## Decisiones

- **Autenticación propia con enlace mágico**, no Better Auth: son cuatro endpoints, cabe en los 10 ms de CPU del plan gratuito y no depende de una librería nueva. Sin contraseñas.
  - El token del correo dura 15 minutos, se usa una sola vez y en la base se guarda solo su SHA-256.
  - El enlace abre una página con un botón "Entrar" que hace el POST. Así los antivirus de correo que abren los enlaces no gastan el token.
  - Sesión de 30 días en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`. En la base también va solo el hash.
  - Las peticiones que cambian datos exigen que el `Origin` sea el sitio.
- **Correo:** Resend desde `rifas@maudev.cl` (el dominio ya está verificado). En local no se envía: el enlace se muestra en la consola.
- **Números tomados:** la tabla `numeros` tiene una fila por número reservado o pagado, con PK `(rifa_id, numero)`. Una reserva inserta todos sus números en un solo `batch` de D1, que es una transacción: si otro compró uno un instante antes, falla completa y nadie queda con números a medias.
- **Plan gratuito:** rifas de 10 a 100 números. Las más grandes llegan con los pagos de la fase 4.
- **Sorteo:** al cierre se crea un registro en `sorteos` (tipo `plataforma`) con una línea por número pagado, `número:sha256(código de boleto)`, y se reutiliza todo el mecanismo verificable que ya existe.

## Datos (migración 0004)

- `usuarios`: id, email, nombre
- `enlaces_ingreso`: hash del token, email, vence, usado
- `sesiones`: hash del id, usuario, vence
- `rifas`: slug, organizador, título, descripción, premios (JSON), precio, rango de números, medios de pago, WhatsApp, cierre, horas de reserva, máximo por persona, estado, país, moneda, zona horaria, sorteo
- `reservas`: código, rifa, nombre, teléfono, estado (`pendiente`, `pagada`, `vencida`, `liberada`), vence
- `numeros`: (rifa, número) → reserva
- `eventos`: registro encadenado de cambios (entrega 2.4)
