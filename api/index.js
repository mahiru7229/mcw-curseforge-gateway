import { GATEWAY_NAME, GATEWAY_VERSION } from "../lib/constants.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../lib/http.js";
export { OPTIONS };
export async function GET(request) {
    return handleApiRequest(request, async () => jsonResponse({
        name: GATEWAY_NAME,
        version: GATEWAY_VERSION,
        purpose: "CurseForge metadata gateway for MCW Launcher",
        endpoints: {
            health: "GET /api/health",
            search: "GET /api/curseforge/search?query=sodium&gameVersion=1.21.1&loader=fabric",
            mod: "GET /api/curseforge/mod?modId=238222",
            files: "GET /api/curseforge/files?modId=238222&gameVersion=1.21.1&loader=fabric",
            file: "GET /api/curseforge/file?modId=238222&fileId=123456",
            downloadUrl: "GET /api/curseforge/download-url?modId=238222&fileId=123456",
            batchFiles: "POST /api/curseforge/files/batch",
            batchMods: "POST /api/curseforge/mods/batch",
        },
    }, 200, { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 3600 }));
}
