# MCW Launcher integration

The launcher stores only the gateway URL. It must never store the CurseForge API key.

```python
CURSEFORGE_GATEWAY_URL = "https://your-project.vercel.app/api/curseforge"
```

Suggested requests:

```text
GET  {base}/search?query=sodium&gameVersion=1.21.1&loader=fabric
GET  {base}/mod?modId=238222
GET  {base}/files?modId=238222&gameVersion=1.21.1&loader=fabric
GET  {base}/file?modId=238222&fileId=123456
GET  {base}/download-url?modId=238222&fileId=123456
POST {base}/files/batch
POST {base}/mods/batch
```

Recommended headers:

```python
headers = {
    "Accept": "application/json",
    "X-MCW-Version": VERSION_ID,
}
```

When `MCW_CLIENT_TOKEN` is configured on Vercel, also send:

```python
headers["Authorization"] = f"Bearer {MCW_CLIENT_TOKEN}"
```

The client token is only an abuse-deterrence measure. It is not a true secret after being embedded in a desktop executable.

## Download flow

1. Fetch file metadata through `/file` or `/files/batch`.
2. Read `fileLength`, `hashes`, and `downloadUrl`.
3. If `downloadUrl` is absent, call `/download-url` just before downloading.
4. Download directly from the returned CurseForge CDN URL with the launcher's existing downloader.
5. Verify the file size and SHA-1 (`hashes[].algo == 1`).
6. If no URL is available, open the official project page and use the manual-file flow.

Do not proxy `.jar` or `.mcwpack` bytes through Vercel.

## Rate-limit handling

Protected responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

When the gateway returns HTTP `429`:

1. Read `Retry-After` as seconds.
2. Pause that provider until the delay expires.
3. Reuse the existing resolve/install plan instead of starting resolution again.
4. Do not retry concurrently from several launcher tasks.

HTTP `503` with `error.code == "rate_limit_unavailable"` means the distributed protection store is unavailable. Treat it as a temporary provider outage and preserve the local cache.
