import { curseForgeRequest } from "../../../lib/curseforge.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../../../lib/http.js";
import { parseIdBatch } from "../../../lib/params.js";
export { OPTIONS };
export async function POST(request) {
    return handleApiRequest(request, async (requestId) => {
        const fileIds = await parseIdBatch(request, "fileIds");
        const data = await curseForgeRequest("/mods/files", {
            method: "POST",
            body: { fileIds },
            requestId,
            launcherVersion: request.headers.get("x-mcw-version"),
        });
        return jsonResponse(data);
    }, { requireClientAuth: true });
}
