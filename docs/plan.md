# Plan — Rifa Clara

v0.4 · 15 sep 2026. Este archivo es la fuente de verdad del plan.

## Decisiones

| Tema               | Decisión                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Marca              | Rifa Clara                                                                       |
| Diseño             | C · Familia Maudev: marfil, petróleo y salvia; Sora, Inter y JetBrains Mono. Tokens en `web/src/styles/global.css` |
| Dominio            | `rifaclara.maudev.cl` |
| Alcance            | Solo Chile en las fases 0 a 4 (`es-CL`, CLP). Otros países después               |
| Dinero             | La plataforma no lo toca. El participante paga directo al organizador            |
| Cobro              | Pago único por rifa. Sin suscripción ni comisión                                 |
| Sorteo             | drand + huella SHA-256 de la lista, verificable en el navegador                  |
| Cripto             | Fuera del alcance por ahora                                                      |
| Código             | Un repo con `web/`, `api/` y `shared/`                                           |
| Costo de operación | $0 (plan gratuito de Cloudflare)                                                 |

## Flujo

1. El organizador crea la rifa: premio, foto, cantidad de números, precio, cierre y datos de transferencia.
2. La comparte por WhatsApp o Instagram. La vista previa muestra premio, precio y % vendido.
3. El participante elige números y los reserva sin crear cuenta (nombre, WhatsApp, Turnstile). Recibe un boleto con código, por ejemplo `RC-7K2M`.
4. Transfiere al organizador y le manda el comprobante por WhatsApp con un mensaje ya escrito.
5. El organizador marca "pagado". Las reservas sin pagar se liberan solas a las 24 h (configurable).
6. Al cierre, el sistema congela la lista, publica su huella y fija una ronda futura de drand.
7. Llega la ronda: se lee el azar público y se calcula el ganador.
8. Cualquiera recalcula el resultado en su navegador y comprueba que su boleto estaba en la lista.

## Sorteo verificable

- Lista congelada: números pagados, ordenados, una línea por número con el formato `número:sha256(código de boleto)`. Cada participante reconoce su línea sin que se exponga su nombre.
- Compromiso: se publica la huella de la lista y una ronda de drand _quicknet_ posterior al cierre. Una ronda cada 3 s; la ronda comprometida es la primera emitida en el cierre o después: `ceil((t - 1692803367) / 3) + 1` (ver `shared/src/sorteo.ts`).
- Azar: se lee desde `api.drand.sh` y `drand.cloudflare.com` y se exige que coincidan. La firma BLS se verifica en el navegador, porque en el Worker gratuito no cabe en 10 ms de CPU.
- Ganador: `sha256(azar:idRifa:huella:premio) mod cantidad`. Si hay varios premios, se repite quitando a los que ya ganaron.
- Sello: la huella se ancla en Bitcoin con OpenTimestamps (gratis) en la fase 3.
- Qué garantiza: nadie elige al ganador. Qué no garantiza: que el organizador entregue el premio. Para eso están la lista pública con nombres enmascarados, el historial del organizador y las denuncias.

## Cobro

| Rifa                                            | Precio                         |
| ----------------------------------------------- | ------------------------------ |
| Hasta 100 números                               | Gratis, con anuncios           |
| Hasta 100 números, sin anuncios + talonario PDF | $2.990, pago único (propuesta) |
| Hasta 500 números                               | $4.990, pago único             |
| Hasta 2.000 números                             | $11.990, pago único            |

- Se cobra con Flow en CLP. Antes, confirmar que Flow acepta software de rifas.
- Club de Rifas usa el mismo modelo (pago único por rifa, sin comisión, 50 ventas gratis en la primera rifa), lo que valida el formato.
- La rifa típica chilena es de 100 números ("rifa 100 números" está entre las búsquedas más frecuentes). Por eso el tramo gratis cubre el caso común, y el tramo de $2.990 existe para cobrarle algo a ese caso.

## Legal en Chile

Según la prensa de 2026 que cita la Ley 10.262, en Chile solo pueden organizar rifas las entidades sin fines de lucro (fundaciones, beneficencia, clubes deportivos, bomberos) con autorización previa. Las rifas de influencers están en zona gris: Naya Fácil acumula al menos 15 reclamos en el SERNAC, incluidos participantes que pagaron y no entraron al sorteo. Además hay un proyecto de ley para regular las rifas de inmuebles.

Consecuencias para el producto:

- El público principal son organizaciones sin fines de lucro: bomberos, centros de padres, clubes, juntas de vecinos.
- No se aceptan rifas de inmuebles mientras no haya ley.
- La ley limita quién organiza una rifa, no quién vende herramientas para organizarla. Rifa Clara cobra un precio fijo por un software, como una imprenta cobra por imprimir talonarios; no participa de lo que se recauda. Por eso el pago único es también la opción más segura en lo legal: una comisión sobre la venta de números nos haría partícipes de la rifa.
- Al crear una rifa, el organizador declara que cuenta con los permisos que correspondan. Los términos dejan claro que responde por esos permisos y por la entrega del premio.
- Los pagos a Rifa Clara llevan boleta electrónica, como cualquier venta de Maudev.
- La lista pública y el sorteo verificable atacan justo el problema de los reclamos al SERNAC. Es el argumento de venta.
- Pendiente: una consulta breve con un abogado antes de lanzar la fase 2.

## SEO (Google Trends Chile, últimos 12 meses)

| Término          | Interés, con "rifa" = 100             |
| ---------------- | ------------------------------------- |
| sorteo           | ≈ 625 (casi todo Loto, Kino y fútbol) |
| rifa             | 100                                   |
| ruleta online    | 71                                    |
| rifas            | ≈ 20                                  |
| sorteo instagram | 8                                     |
| rifa bomberos    | 6                                     |
| números de rifa  | 3,5                                   |
| rifa online      | 1,5                                   |

Lo que más crece junto a "rifa" son rifas con nombre propio (Naya Fácil, La Querencia, bomberos de cada ciudad). "rifa sorteo" y "sorteo de rifa" aparecen entre las consultas relacionadas más altas.

Prioridades:

1. Páginas de rifas indexables con el título "Rifa {nombre}": la promoción de cada organizador trae búsquedas.
2. Ruleta online como primera herramienta.
3. Guías: cómo hacer una rifa, números de rifa, rifa de 100 números, rifa a beneficio, ¿es legal hacer una rifa en Chile?
4. Sorteo de nombres, generador de números y talonario PDF después.

Aviso: los datos salen de `pytrends`, que no es oficial, y los valores bajo 1 son ruido. Antes de escribir las guías, validar volúmenes con AnswerThePublic.

Competencia en Chile: SorteoRifas.cl (herramienta de sorteo gratis), YoSorteo.cl y Club de Rifas.

AdSense: Google restringe los anuncios en contenido de juegos de azar, así que los anuncios van en herramientas y guías, nunca junto a los botones de la grilla. Hay que pedir consentimiento de cookies antes de cargarlos.

## Arquitectura

```
navegador ──HTTPS──▶ web (Astro, Worker, rifaclara.maudev.cl)
                        │  /api/*  → service binding
                        ▼
                     api (Hono, Worker, sin ruta pública) ──▶ D1 · R2 · drand · Resend
```

- Al compartir dominio, las cookies de sesión funcionan sin CORS.
- `shared/` tiene el algoritmo del sorteo y los esquemas Zod: la API y el verificador usan exactamente el mismo código.
- Workspaces de npm. GitHub Actions con filtros por carpeta: un cambio en `web/` despliega solo el frontend, uno en `api/` solo el backend, y uno en `shared/` despliega los dos (primero `api`).
- Hay entorno de preview para cada Worker.

## Stack

| Parte         | Tecnología                                                  |
| ------------- | ----------------------------------------------------------- |
| Frontend      | Astro con adaptador de Cloudflare, islas React, Tailwind v4 |
| Backend       | Hono, Zod, Drizzle                                          |
| Base de datos | D1 (SQLite)                                                 |
| Autenticación | Better Auth con enlace mágico y Google, sin contraseñas     |
| Imágenes      | R2                                                          |
| Correo        | Resend (plan gratuito, 100 correos al día)                  |
| Tareas        | Cron Triggers: vencer reservas, ejecutar sorteos            |
| Anti-abuso    | Turnstile + límites por IP y por teléfono                   |
| Pruebas       | Vitest (api, shared) y Playwright (web)                     |

Límites del plan gratuito que importan: 100 mil peticiones al día y **10 ms de CPU por petición**. Los archivos estáticos no cuentan. Confirmar las cifras vigentes al empezar.

## Datos

| Tabla        | Campos clave                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| users        | id, email, nombre, verificado                                                                                                                                                      |
| raffles      | id, slug, organizador, título, país, moneda, zona horaria, precio (entero), medios de pago (JSON), plan pagado, total de números, estado, visibilidad, cierre, ronda drand, huella |
| prizes       | rifa, posición, título, imagen                                                                                                                                                     |
| tickets      | PK (rifa, número), estado, reserva, pagado en                                                                                                                                      |
| reservations | código, rifa, nombre, teléfono, vence en, estado                                                                                                                                   |
| draws        | rifa, ronda, azar, firma, resultados                                                                                                                                               |
| name_draws   | id, huella de la lista, ronda, resultado (sorteo de nombres de la fase 1)                                                                                                          |
| events       | rifa, tipo, datos, hash anterior, hash (registro que solo crece)                                                                                                                   |

País y moneda quedan desde el inicio aunque solo se habilite Chile.

## Rutas

| Ruta                                                                 | Qué es                  | Se indexa     |
| -------------------------------------------------------------------- | ----------------------- | ------------- |
| `/`                                                                  | Portada                 | Sí            |
| `/ruleta`, `/sorteo-de-nombres`, `/numeros-aleatorios`, `/talonario` | Herramientas            | Sí            |
| `/guias/*`                                                           | Guías en MDX            | Sí            |
| `/rifas`                                                             | Rifas públicas activas  | Sí            |
| `/r/:slug`                                                           | Página de la rifa       | Si es pública |
| `/r/:slug/sorteo`                                                    | Resultado y verificador | Sí            |
| `/boleto/:código`                                                    | Boleto del participante | No            |
| `/panel/*`                                                           | Organizador             | No            |

## Seguridad

| Riesgo                            | Control                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| Número vendido dos veces          | PK (rifa, número) y reserva en una transacción                              |
| Bots que acaparan números         | Turnstile, máximo por teléfono, vencimiento, límites                        |
| Lista alterada después del cierre | Huella publicada, OpenTimestamps, registro encadenado                       |
| Azar conocido de antemano         | Ronda futura fijada al cierre                                               |
| Premio no entregado               | Historial del organizador, denuncias, suspensión                            |
| Filtración de teléfonos           | Solo los ve el organizador. Borrado 90 días después del sorteo (Ley 21.719) |
| API llamada por fuera del sitio   | Sin ruta pública ni workers.dev                                             |
| Sesiones                          | Cookies HttpOnly y SameSite, CSP estricta, CSRF                             |

## Fases

**Fase 0 · Base (semana 1)**
Workspaces con `web`, `api` y `shared`; CI y previews; `rifaclara.maudev.cl` apuntando a `web` con `/api/salud` funcionando; keywords validadas; nombre definitivo.
Listo cuando: los dos Workers se despliegan solos desde GitHub.

**Fase 1 · Herramientas y contenido, solo Chile (semanas 2–3)**
Ruleta online, sorteo de nombres compartible y verificable, generador de números y 6 guías. Legales, sitemap, Search Console y Web Analytics.
Listo cuando: las páginas están indexadas en Google Chile y un sorteo de nombres se comparte y se verifica con un enlace.

**Fase 2 · MVP de rifas (semanas 4–7)**
Cuentas, asistente de creación, página pública, grilla, reservas, boleto, panel de pagos, vencimiento, cierre, sorteo y verificador. Pruebas de concurrencia. Consulta legal antes de abrir.
Listo cuando: una rifa real de 100 números se crea, se vende y se sortea de principio a fin.

**Fase 3 · Confianza y difusión (semanas 8–9)**
Imágenes OG por rifa, grilla en tiempo real, OpenTimestamps, registro público de cambios, historial del organizador.

**Fase 4 · Ingresos (semana 10 en adelante)**
AdSense, consentimiento de cookies, pagos únicos con Flow, talonario PDF. Caso publicado en maudev.cl.

**Después:** otros países (monedas, medios de pago, guías por país).

## Ingresos y cómo recibirlos

Fuentes, de menor a mayor riesgo legal:

| Fuente | Riesgo | Cuándo |
|---|---|---|
| AdSense en ruleta, herramientas y guías | Muy bajo: son herramientas neutras, no rifas | Fase 1 en adelante (solicitar con contenido publicado) |
| Clientes para Maudev: organizaciones que quieren su propia página o sistema | Muy bajo: es el servicio habitual de Maudev | Desde que haya tráfico |
| Sorteo certificado para marcas (sorteos de Instagram, sin venta de números) | Bajo | Validar en fase 3 |
| Pago único por rifa, cobrado al organizador | Bajo, con las reglas de abajo | Fase 4 |
| Comisión sobre la venta de números | Alto: nos hace partícipes de la rifa | Descartado |

Reglas para cobrar sin exponerse:

1. Precio fijo por el software. Nunca un porcentaje de lo recaudado, y nunca pasa por nosotros el dinero de los participantes ni el premio.
2. Paga el organizador, no el participante.
3. Precio con IVA incluido y boleta electrónica en cada venta; factura para las organizaciones que la pidan, por ejemplo para rendir cuentas. Todo a nombre de Maudev.
4. Al crear la rifa, el organizador marca una casilla donde declara que tiene los permisos que correspondan y que responde por la entrega del premio.
5. El marketing habla de "rifas a beneficio" y organizaciones. Nunca de "gana plata con rifas".
6. No se aceptan rifas de inmuebles. Botón de denuncia y posibilidad de suspender rifas.
7. Registro de eventos guardado, por si el SERNAC o una autoridad pide antecedentes.

Preguntas para la consulta con el abogado:

1. ¿Una plataforma que cobra un precio fijo por el software, sin tocar el dinero de la rifa, tiene responsabilidad si un organizador hace una rifa sin autorización?
2. ¿Basta con la declaración del organizador, o conviene pedir algo más (RUT de la organización, número de autorización)?
3. ¿Qué dicen hoy la Ley 10.262 y su reglamento sobre las personas naturales que rifan a beneficio de alguien, por ejemplo para una operación?
4. ¿El sorteo certificado para marcas choca con las reglas de los concursos promocionales?
5. ¿Qué cláusulas mínimas deben llevar los términos y la política de privacidad (Ley 21.719)?

## Pendiente

- Confirmar el tramo de $2.990.
- Consulta legal.
