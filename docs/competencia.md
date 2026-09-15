# Competencia

Revisión del 15 sep 2026. Capturas en [`competencia/`](competencia/).

Se copian **ideas y funciones**, nunca textos, imágenes ni código. Copiar texto
además nos hundiría en Google por contenido duplicado.

## Quién es quién

| Sitio | Qué hace | Cobro | Estilo |
|---|---|---|---|
| [SorteoRifas.cl](https://sorteorifas.cl/) | Herramientas gratis para Chile: sorteador, calculadora de metas y precios, generador de bases legales, talonarios, guías y blog. No vende rifas | AdSense | Azul noche + amarillo degradado, fuente Orbitron (tipo videojuego) |
| [Club de Rifas](https://clubderifas.com/) | Plataforma de rifas: publicar, compartir, confirmar pagos, sortear. Temas para la página de la rifa. Demo | Pago único por rifa, 50 ventas gratis en la primera | Blanco + morado, ilustración genérica, Poppins |
| [Rifalo](https://www.rifalo.ar/) (AR) | Rifas con Mercado Pago, promociones 2x1, precio anticipado, ventas en efectivo, sorteo en vivo o con la Lotería Nacional, asistente con IA ("Rafi"), calculadora | 5 % de comisión | Morado muy oscuro + amarillo, Fraunces + Plus Jakarta |
| [SimpleRifa](https://simplerifa.com/) | Sitio de sorteos con dominio propio para emprendedores | $141.100 CLP al año | Azul oscuro, tarjetas de vidrio, maqueta de celular |
| [RifaBase](https://rifabase.com/) (MX) | Panel de gestión con cobros integrados (Stripe, Mercado Pago, Wompi) | Planes | — |
| YoSorteo.cl | En mantención; categorías de vehículos e inmuebles | — | — |

## Lo que se repite

- Casi todos usan fondo oscuro con amarillo o morado. **Un diseño claro y preciso nos separa a primera vista.**
- Todos dicen "transparente" o "aleatorio real", pero **ninguno deja comprobar el sorteo**. Es solo una promesa.
- Nadie une el talonario de papel con la rifa online, y en Chile el papel sigue siendo lo normal.

## Qué tomamos y cómo lo mejoramos

| Idea (de quién) | Versión Rifa Clara |
|---|---|
| Sorteador (SorteoRifas) | Sorteo verificable con drand, enlace para compartir el resultado y modo pantalla completa para proyectar o transmitir en vivo |
| Calculadora de metas (SorteoRifas, Rifalo) | "¿Cuánto necesitas juntar?" propone cantidad de números y precio, y con un clic crea la rifa ya llenada |
| Generador de bases (SorteoRifas) | Las bases quedan publicadas en la rifa y entran en la huella del sorteo: no se pueden cambiar después del cierre |
| Talonarios (SorteoRifas) | **Talonario híbrido**: PDF con un QR por número. Se vende en papel y el comprador escanea para ver su número en la rifa online |
| Temas de la página (Club de Rifas) | Varias paletas para que el organizador elija el estilo de su rifa |
| Ventas en efectivo y promociones (Rifalo) | Marcar ventas en efectivo desde el panel y packs de números (fase 3) |
| Sorteo con la lotería (Rifalo) | Para cuando lleguen otros países |
| Cifras de confianza (Rifalo) | Contador de rifas y sorteos verificados, cuando existan números reales |
| Demo (Club de Rifas) | Rifa de ejemplo navegable desde la portada |

## Lo que solo tendremos nosotros

1. Un sorteo que cualquiera puede recalcular.
2. Una lista pública de números pagados con nombres enmascarados.
3. El talonario híbrido de papel con QR.
4. Un registro de cambios que el organizador no puede borrar, útil ante un reclamo en el SERNAC.
5. Un precio único en CLP y sin comisión, bajo el anual de SimpleRifa y sin el porcentaje de Rifalo.
