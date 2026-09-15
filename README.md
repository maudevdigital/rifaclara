# Rifa Clara

Rifas online con sorteo verificable, en **rifaclara.maudev.cl**.

Un repositorio con workspaces de npm:

| Carpeta | Qué es |
|---|---|
| `web/` | Astro en el Worker `rifaclara-web`. Es la única entrada pública y reenvía `/api/*` a la API por service binding |
| `api/` | Hono en el Worker `rifaclara-api`. Sin ruta pública ni workers.dev |
| `shared/` | Código que usan los dos. Hoy: el algoritmo del sorteo y las rondas de drand |
| `docs/` | [Plan](docs/plan.md), [competencia](docs/competencia.md), [direcciones de diseño](docs/diseno/) y mockups |

## Desarrollo

```bash
npm install
npm test            # pruebas del sorteo (shared)
npm run typecheck   # los tres paquetes
npm run build       # compila la web
```

Para levantar todo en local hacen falta dos terminales. Wrangler conecta el
service binding entre ambas:

```bash
npm run dev:api                                         # rifaclara-api en :8787
npm run build && cd web && npx wrangler dev --port 8788
# http://127.0.0.1:8788/api/salud → responde la API a través de la web
```

`npm run dev:web` (astro dev) sirve para trabajar las páginas.

Después de cambiar un `wrangler.jsonc`, regenera los tipos con
`npx wrangler types` (en `api/` se usa `--env-interface CloudflareBindings`).

## Base de datos (D1)

La base `rifaclara` usa migraciones SQL en `api/migrations/`. Para crear una
nueva: `npx wrangler d1 migrations create rifaclara <nombre>` dentro de `api/`.

```bash
cd api
npx wrangler d1 migrations apply rifaclara --local    # base local de wrangler dev
npx wrangler d1 migrations apply rifaclara --remote   # producción (el CI lo hace solo)
```

Los sorteos se borran a los 90 días con el cron diario de la API.

## Despliegue

`.github/workflows/ci.yml` corre pruebas, tipos y build en cada push. En `main`
despliega solo lo que cambió: primero la API y después la web. Un cambio en
`shared/` despliega las dos.

En el repo de GitHub hay que crear dos secretos:

- `CLOUDFLARE_API_TOKEN`: token con permisos *Workers Scripts: Edit*,
  *D1: Edit* y *Workers Routes: Edit* sobre la zona `maudev.cl`.
- `CLOUDFLARE_ACCOUNT_ID`.

El primer despliegue de la web crea el dominio `rifaclara.maudev.cl` en la zona
de Cloudflare de maudev.cl. La API tiene que existir antes, porque la web
depende de ella por el binding.

## Lista de espera

Los organizadores que se anotan quedan en la tabla `lista_espera` de D1. Para
revisarlos (la columna `pagaria` responde si pagarían $4.990 por rifa):

```bash
cd api
npx wrangler d1 execute rifaclara --remote --command "SELECT tipo, numeros, pagaria, COUNT(*) AS n FROM lista_espera GROUP BY 1, 2, 3 ORDER BY n DESC"
npx wrangler d1 execute rifaclara --remote --command "SELECT email, tipo, pagaria, datetime(creado_en, 'unixepoch') FROM lista_espera ORDER BY creado_en DESC"
```
