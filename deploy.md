# Deploying FlightSafe Dashboard to Railway

## Architecture

Railway runs a single **FlightSafe** service that serves both the Express API and the built React client. SQLite persists on a Railway volume mounted at `/data`.

```
Browser  -->  Railway (FlightSafe service)
                |-- Express API   (/api/*)
                |-- Static client (Vite build, served from client/dist/)
                |-- SQLite DB     (/data/flightsafe.db on persistent volume)
                |
                +--> FlightSafeWeather service (separate Railway project)
                     https://flightsafeweather-production.up.railway.app
```

## Prerequisites

- [Railway CLI](https://docs.railway.com/guides/cli) installed
- Railway account logged in: `railway login`
- GitHub repo: https://github.com/bgatti/FlightSafeDashboard

## Current Deployment

- **Live URL**: https://flightsafe-production.up.railway.app
- **Project ID**: `0153c401-9381-4c73-85c7-a6944a4abcdd`
- **Service**: FlightSafe
- **Volume**: `/data` (SQLite DB + event logs)

## How It Works

Railway auto-detects the Node project and runs:

1. `npm install` (root) -- triggers `postinstall` which installs server/ and client/ deps
2. `npm run build` -- runs `vite build` in client/
3. `npm run start` -- runs `node server/index.js`

The server serves the built client from `client/dist/` as static files and handles `/api/*` routes. SPA fallback sends all non-API routes to `index.html` for React Router.

## Environment Variables

Set these on the Railway service (dashboard or CLI):

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_PATH` | `/data/flightsafe.db` | SQLite file on persistent volume |
| `DATA_DIR` | `/data` | Sim event log directory |
| `VITE_WEATHER_URL` | `https://flightsafeweather-production.up.railway.app` | Baked into client at build time |
| `PORT` | (set by Railway automatically) | Express reads `process.env.PORT` |

**Windows CLI warning**: The Railway CLI on Windows/MSYS mangles paths starting with `/` into `C:/Program Files/Git/...`. Set path variables (`DATABASE_PATH`, `DATA_DIR`) via the Railway web dashboard instead.

## Deploy Commands

### Link to existing project

```bash
railway link --project 0153c401-9381-4c73-85c7-a6944a4abcdd --service FlightSafe
```

### Deploy from local code

```bash
railway up
```

This uploads the working directory, builds on Railway, and deploys. Takes ~2-3 minutes (better-sqlite3 native compilation).

### Check status

```bash
railway service status
```

### View logs

```bash
# Deploy logs (live)
railway logs

# Build logs
railway logs -b --latest

# Last 50 lines
railway logs --lines 50
```

### Generate a public domain (first time only)

```bash
railway domain
```

## Fresh Setup (from scratch)

```bash
# 1. Create project
railway init --name FlightSafeDashboard

# 2. Link it
railway link --project <PROJECT_ID> --service FlightSafe

# 3. Create an empty service
railway add --service FlightSafe

# 4. Add persistent volume (use dashboard if on Windows -- CLI mangles paths)
railway volume add -m "/data"

# 5. Set env vars (use dashboard for path vars on Windows)
#    DATABASE_PATH = /data/flightsafe.db
#    DATA_DIR = /data
#    VITE_WEATHER_URL = https://flightsafeweather-production.up.railway.app

# 6. Deploy
railway up

# 7. Generate public URL
railway domain
```

## Volume (Important)

The SQLite database lives on a Railway volume at `/data`. Without the volume, the DB is wiped on every deploy. The volume was created with:

```bash
railway volume add -m "/data"
```

This persists across deploys. The DB auto-seeds on first run if empty.

## Local Development

Locally, the Vite dev server proxies `/weather-api` to `localhost:3000` (see `client/vite.config.js`). The `VITE_WEATHER_URL` env var is not set locally, so it falls back to the proxy path. No changes needed for local dev.

```bash
# Terminal 1: API server
cd server && npm run dev

# Terminal 2: Vite dev server
cd client && npm run dev
```

## Key Files

| File | Purpose |
|---|---|
| `package.json` | Root scripts: `postinstall`, `build`, `start` |
| `nixpacks.toml` | Railway build config (install, build, start phases) |
| `server/index.js` | Express server, reads `PORT`, serves `client/dist/` |
| `server/db/index.js` | SQLite init, reads `DATABASE_PATH` |
| `client/vite.config.js` | Dev proxy config for local development |
