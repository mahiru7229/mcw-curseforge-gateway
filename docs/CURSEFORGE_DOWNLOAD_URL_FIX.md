# CurseForge download URL fix — gateway v0.1.1

## Root cause

The gateway previously mapped every CurseForge HTTP 401 **and** 403 response to
`gateway_not_configured`. This is incorrect for the download URL endpoint:
CurseForge may deny third-party automatic distribution for an individual file
while the API key remains valid for search, project metadata and file metadata.

## New behavior

1. Read the file metadata first.
2. Use `file.downloadUrl` immediately when it is available.
3. Call the dedicated `/download-url` endpoint only when metadata has no URL.
4. Convert a 403/404 from that endpoint into:

```json
{
  "error": {
    "code": "manual_download_required",
    "message": "This CurseForge file must be downloaded manually because third-party distribution is unavailable.",
    "details": {
      "modId": 0,
      "fileId": 0,
      "fileName": "example.jar",
      "reason": "distribution_restricted_or_url_unavailable"
    }
  }
}
```

5. Report a real upstream authentication rejection as
`gateway_credentials_rejected`.
6. Add `GET /api/health?probe=1` to verify the deployed credential against
CurseForge without exposing it.

## Deploy

Run before deployment:

```powershell
npm test
npm run check
```

Deploy production:

```powershell
vercel --prod
```

Then verify:

```text
https://<deployment>/api/health?probe=1
```

Expected fields:

```json
{
  "status": "ok",
  "version": "0.1.1",
  "curseforgeConfigured": true,
  "curseforgeCredentials": "valid",
  "curseforgeReachable": true
}
```

Do not proxy restricted `.jar` files through Vercel and do not attempt to derive
private CDN URLs. The launcher should present its manual download / Open in
browser fallback for `manual_download_required`.
