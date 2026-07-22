import { curseForgeRequest } from "../../lib/curseforge.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../../lib/http.js";
import { optionalInteger, optionalString, parseLoader, parsePagination, positiveInteger, } from "../../lib/params.js";
import { appendIfDefined } from "../../lib/query.js";
export { OPTIONS };
export async function GET(request) {
    return handleApiRequest(request, async (requestId) => {
        const incoming = new URL(request.url).searchParams;
        const modId = positiveInteger(incoming.get("modId"), "modId");
        const gameVersion = optionalString(incoming, "gameVersion", 50);
        const loader = parseLoader(incoming);
        const gameVersionTypeId = optionalInteger(incoming, "gameVersionTypeId", { min: 1 });
        const { index, pageSize } = parsePagination(incoming);
        const upstream = new URLSearchParams({ index: String(index), pageSize: String(pageSize) });
        appendIfDefined(upstream, "gameVersion", gameVersion);
        appendIfDefined(upstream, "modLoaderType", loader);
        appendIfDefined(upstream, "gameVersionTypeId", gameVersionTypeId);
        const data = await curseForgeRequest(`/mods/${modId}/files`, {
            query: upstream,
            requestId,
            launcherVersion: request.headers.get("x-mcw-version"),
        });
        return jsonResponse(data, 200, { maxAge: 0, sMaxAge: 300, staleWhileRevalidate: 1800 });
    }, { requireClientAuth: true });
}
