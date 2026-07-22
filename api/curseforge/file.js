import { curseForgeRequest } from "../../lib/curseforge.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../../lib/http.js";
import { positiveInteger } from "../../lib/params.js";
export { OPTIONS };
export async function GET(request) {
    return handleApiRequest(request, async (requestId) => {
        const params = new URL(request.url).searchParams;
        const modId = positiveInteger(params.get("modId"), "modId");
        const fileId = positiveInteger(params.get("fileId"), "fileId");
        const data = await curseForgeRequest(`/mods/${modId}/files/${fileId}`, {
            requestId,
            launcherVersion: request.headers.get("x-mcw-version"),
        });
        return jsonResponse(data, 200, { maxAge: 0, sMaxAge: 1800, staleWhileRevalidate: 7200 });
    }, { requireClientAuth: true });
}
