# MCW CurseForge Gateway

A small Vercel Functions gateway for MCW Launcher. It keeps the CurseForge `x-api-key` on the server and returns only CurseForge metadata or download URLs.

## What it does

- Minecraft-only CurseForge search (`gameId = 432`).
- Mod metadata and mod file listings.
- Single-file and batch-file metadata.
- Download URL resolution.
- Input validation, timeout handling and sanitized errors.
- Optional lightweight MCW client token.
- Vercel CDN caching for safe GET metadata routes.
- Never proxies mod binaries through Vercel.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api` | Endpoint overview |
| GET | `/api/health` | Configuration health |
| GET | `/api/curseforge/search` | Search Minecraft mods/modpacks |
| GET | `/api/curseforge/mod` | Get one mod |
| GET | `/api/curseforge/files` | List files for a mod |
| GET | `/api/curseforge/file` | Get one file |
| GET | `/api/curseforge/download-url` | Resolve a file download URL |
| POST | `/api/curseforge/files/batch` | Get up to 50 files |
| POST | `/api/curseforge/mods/batch` | Get up to 50 mods |

An OpenAPI starter document is available at `/openapi.json` after deployment.

The CurseForge API caps `pageSize` at 50 and `index + pageSize` at 10,000. This gateway validates those limits before contacting the upstream API.

## Local setup

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```text
CURSEFORGE_API_KEY=your_real_key
MCW_CLIENT_TOKEN=
MCW_ALLOWED_ORIGIN=*
```

Run:

```powershell
npm run check
npm run dev
```

Open:

```text
http://localhost:3000/api/health
http://localhost:3000/api/curseforge/search?query=sodium&gameVersion=1.21.1&loader=fabric
```

## Deploy to Vercel

```powershell
npm install -g vercel
vercel login
vercel
vercel env add CURSEFORGE_API_KEY production
vercel env add CURSEFORGE_API_KEY preview
vercel --prod
```

Or import the GitHub repository from the Vercel dashboard, then add `CURSEFORGE_API_KEY` under **Project → Settings → Environment Variables** and redeploy.

Recommended Vercel Firewall rule for this small project:

```text
If Request Path starts with /api/curseforge/
Then Rate Limit: 60 requests per 60 seconds per IP
```

## Security notes

- Never prefix the CurseForge secret with `NEXT_PUBLIC_` or expose it to browser code.
- Never commit `.env.local`.
- Do not add a generic `?url=` proxy endpoint.
- Do not stream `.jar`, `.zip`, or `.mcwpack` files through the Function.
- The optional `MCW_CLIENT_TOKEN` is not a strong secret in a desktop app; rely on server validation and Vercel Firewall for real abuse protection.
- If CurseForge returns no download URL, MCW Launcher must use its manual-download fallback.

## Loader values

```text
any, forge, fabric, quilt, neoforge
```

They map to CurseForge values `0`, `1`, `4`, `5`, and `6`.

## Testing

```powershell
npm test
npm run check
```

See [`docs/MCW_LAUNCHER_INTEGRATION.md`](docs/MCW_LAUNCHER_INTEGRATION.md) for launcher-side integration guidance.
