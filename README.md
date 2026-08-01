# Super Tzmieg

Web platform for a tire shop and wheel-alignment garage. React (JavaScript/JSX,
no TypeScript) on the front, Node.js/Express on the back.

The headline feature is the **smart tire selector**: a customer types their
license plate and gets back only the tire sizes that are road-legal for that
specific vehicle, resolved live against the Israeli Ministry of Transport open
data on data.gov.il.

## Running locally

You need **two terminals**. The frontend and the API are separate processes in
development, and the tire selector fails with `ECONNREFUSED` if the second one
is not running.

```bash
npm install

# Terminal 1 — frontend on :5173
npm run dev

# Terminal 2 — API on :4000
npm run server
```

Vite proxies `/api` to `localhost:4000`, so the browser stays on one origin.
That proxy is **development only** — see the deployment note below.

```bash
npm run lint     # ESLint
npm test         # backend unit + integration tests
npm run build    # production bundle into dist/
```

## How the data flows

The storefront runs against an in-browser mock (`src/services/mock/`) for the
catalog, reviews, booking, invoicing and admin. Vehicle lookup is the one thing
that is real: the mock reaches through to the Express service, which is the only
component allowed to call data.gov.il.

This means **`VITE_USE_MOCK_API` must stay unset**. The Express service
implements only the vehicle endpoints, so setting it to `false` breaks the rest
of the site rather than making it more production-like.

### Vehicle lookup

`GET /api/vehicles/:plate/tire-specs` composes two CKAN datasets:

1. **רכב פרטי ומסחרי** — one row per registered vehicle, keyed by plate. Usually
   carries the tire sizes directly.
2. **דגמי רכב** — one row per model/trim/year. Queried only when step 1 comes up
   short, plus a cheap non-blocking enrichment pass for the TPMS flag.

Failures degrade rather than break: a registry outage or a model with no
published sizes falls back to a curated reference table, flagged `verified:
false` so the UI can say so.

CKAN mints a new resource id every time a dataset is republished, which turns a
working lookup into "vehicle not found" for every visitor. `GOV_RESOURCE_*` are
configurable for that reason, and `/api/diagnostics/registry` checks them.

### A note on tire pressure

The registry publishes tire **sizes** and a TPMS flag, and no recommended
inflation pressure at all — verified field by field against the live API. So the
UI shows the TPMS fact, a class-typical *range* explicitly labelled as not
vehicle-specific, and a pointer to the door-jamb placard. It never invents a
figure. See `server/lib/tirePressure.js`.

## Deployment

One web service serves both the built frontend and the API. Splitting them does
not work: Vite's dev proxy has no production equivalent, so a separately hosted
static build has no route to `/api`.

`render.yaml` is a ready Render blueprint. Configured by hand, the settings are:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| `NODE_ENV` | `development` — Vite is a devDependency and `npm ci` would skip it |
| `TRUST_PROXY` | `1` — the rate limiter reads `req.ip` |
| `DIAGNOSTICS_TOKEN` | any secret; unset disables the diagnostics route |

Copy `.env.example` to `.env` for local overrides. Everything in it has a
documented default, so none of it is required to run.

## Layout

```
server/            Express service — the only thing that talks to data.gov.il
  lib/             Registry client, tire-size parser, pressure, error taxonomy
  services/        Two-step aggregator, reference-table fallback, cache adapter
  data/            Curated fitment reference for when the registry cannot answer
  test/            node:test suites
src/
  components/      UI, grouped by surface (catalog, quote, trust, admin, ui)
  hooks/           Data fetching and per-screen state machines
  services/        HTTP transport, API layer, and the mock backend
  lib/             Constants, validation, formatting
```
