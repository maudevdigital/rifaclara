---
titulo: Cómo sortear una rifa de forma transparente
descripcion: Papelitos, lotería, apps o sorteo verificable. Qué método usar, qué hacer con los números no vendidos y cómo demostrar que el sorteo fue limpio.
publicado: 2026-09-15
herramienta: sorteo-de-rifa
orden: 2
---

Vendiste los números, cobraste y llegó el día. Ahora viene la parte en que la rifa puede terminar bien o terminar en sospechas: **el sorteo**. La pregunta que siempre aparece —"¿fue de verdad?"— se responde con el método que elijas y con cómo lo muestres.

## Por qué el método importa

Quien compró un número no ve lo que pasa detrás. Si el ganador resulta ser el primo del organizador, aunque el sorteo haya sido limpio, la duda queda. Y en los últimos años se han multiplicado los reclamos por rifas en que participantes que pagaron no aparecieron en el sorteo.

Un buen método cumple tres condiciones:

1. **Nadie puede elegir el resultado**, ni siquiera quien organiza.
2. **Todos los números vendidos participan**, y se puede comprobar.
3. **El resultado se puede revisar después**, no solo mirar en el momento.

## Los métodos más usados

### Papelitos en una bolsa o tómbola

El clásico. Se escriben los números en papeles iguales, se doblan y alguien saca uno a la vista de todos.

- **A favor:** todos lo entienden y es barato.
- **En contra:** nadie puede confirmar que estaban todos los papeles, que eran iguales ni que no había dos del mismo número. Si no fue en vivo, hay que creerle al organizador.

### Resultado de una lotería oficial

Se anuncia de antemano que gana el número que coincida con las últimas cifras de un sorteo oficial de lotería en una fecha dada. Con 100 números, se usan las dos últimas cifras.

- **A favor:** el azar no lo controla nadie de la rifa y el resultado es público.
- **En contra:** hay que esperar la fecha del sorteo oficial, y si sale un número no vendido hay que tener una regla de respaldo (por ejemplo, usar el siguiente premio de la lotería).

### Una app o ruleta cualquiera

Muy práctico para transmitir en vivo, pero el resultado depende de un programa que nadie puede revisar. Si alguien pregunta cómo se eligió el número, la única respuesta es "confíen en la app".

### Sorteo verificable

Es el método del [sorteo de rifa de Rifa Clara](/sorteo-de-rifa). Funciona así:

1. La lista de números que participan queda **registrada y sellada** con una huella digital (un código SHA-256 que cambia si se modifica un solo número).
2. Se fija una **ronda futura de drand**, un faro público de números aleatorios que mantienen Cloudflare, universidades y otras organizaciones, y que emite un número nuevo cada 3 segundos.
3. Cuando llega esa ronda, los ganadores se calculan con una fórmula pública a partir de ese número aleatorio.

Nadie conoce el número aleatorio antes de que se emita, así que nadie puede acomodar la lista para favorecer a alguien. Y como la fórmula es pública, **cualquier participante puede repetir el cálculo** con el enlace del comprobante y llegar a los mismos ganadores.

## Qué hacer con los números no vendidos

Es la duda más común, y conviene resolverla **antes de vender**, no el día del sorteo.

- **Sortear solo entre los vendidos.** Es lo más justo con quienes pagaron: siempre gana alguien que compró. En el sorteo de rifa, elige "Solo los vendidos" y pega esos números.
- **Sortear entre todos y repetir si sale uno no vendido.** Es el método tradicional con talonario. Funciona, pero se ve raro en vivo y alarga el sorteo.
- **Postergar la fecha** hasta vender más. Solo si lo avisaste desde el comienzo.

## Cómo hacer el sorteo paso a paso

1. **Publica la lista de números vendidos** en el grupo o en redes un día antes. Cada persona confirma que el suyo está.
2. **Anuncia la hora y el método.** "Mañana a las 20:00, en vivo por Instagram, con sorteo verificable."
3. **Transmite en vivo.** En el sorteo de rifa, el botón de pantalla completa muestra los números en grande, uno por uno.
4. **Comparte el enlace del comprobante** apenas termine. Ahí queda la lista, la ronda de drand usada y los ganadores.
5. **Contacta a los ganadores** y coordina la entrega.

## Varios premios

Si la rifa tiene más de un premio, decide el orden antes: normalmente el primer número que sale gana el premio mayor. En el sorteo verificable los números salen en ese orden y un mismo número no puede ganar dos veces.

## En resumen

- Resuelve antes de vender qué pasa con los números no vendidos.
- Publica la lista de vendidos antes del sorteo.
- Sortea en vivo y con un método que se pueda revisar después.
- Guarda y comparte el comprobante.

¿Todavía no organizas la rifa? Empieza por la guía [cómo hacer una rifa paso a paso](/guias/como-hacer-una-rifa).
