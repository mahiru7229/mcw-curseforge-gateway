import { DEFAULT_MINECRAFT_MOD_CLASS_ID, MINECRAFT_GAME_ID } from "../../lib/constants.js";
import { curseForgeRequest } from "../../lib/curseforge.js";
import { ApiError } from "../../lib/errors.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../../lib/http.js";
import { optionalInteger, optionalString, parseLoader, parsePagination, parseSortOrder, requiredString, } from "../../lib/params.js";
import { appendIfDefined } from "../../lib/query.js";
export { OPTIONS };
export async function GET(request) {
    return handleApiRequest(request, async (requestId) => {
        const incoming = new URL(request.url).searchParams;
        const query = requiredString(incoming, "query", 100);
        const gameVersion = optionalString(incoming, "gameVersion", 50);
        const loader = parseLoader(incoming);
        const classId = optionalInteger(incoming, "classId", { min: 1 }) ?? DEFAULT_MINECRAFT_MOD_CLASS_ID;
        const sortField = optionalInteger(incoming, "sortField", { min: 1, max: 12 });
        const sortOrder = parseSortOrder(incoming);
        const categoryId = optionalInteger(incoming, "categoryId", { min: 1 });
        const { index, pageSize } = parsePagination(incoming);
        if (loader !== undefined && !gameVersion) {
            throw new ApiError(400, "missing_game_version", "gameVersion is required when loader is provided.");
        }
        const upstream = new URLSearchParams({
            gameId: String(MINECRAFT_GAME_ID),
            classId: String(classId),
            searchFilter: query,
            index: String(index),
            pageSize: String(pageSize),
        });
        appendIfDefined(upstream, "gameVersion", gameVersion);
        appendIfDefined(upstream, "modLoaderType", loader);
        appendIfDefined(upstream, "sortField", sortField);
        appendIfDefined(upstream, "sortOrder", sortOrder);
        appendIfDefined(upstream, "categoryId", categoryId);
        const data = await curseForgeRequest("/mods/search", {
            query: upstream,
            requestId,
            launcherVersion: request.headers.get("x-mcw-version"),
        });
        return jsonResponse(data, 200, { maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 300 });
    }, { requireClientAuth: true });
}
