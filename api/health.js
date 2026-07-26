import { GATEWAY_NAME, GATEWAY_VERSION, MINECRAFT_GAME_ID } from "../lib/constants.js";
import { curseForgeRequest } from "../lib/curseforge.js";
import { CurseForgeUpstreamError } from "../lib/errors.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../lib/http.js";

export { OPTIONS };

export async function GET(request) {
    return handleApiRequest(request, async (requestId) => {
        const configured = Boolean(process.env.CURSEFORGE_API_KEY?.trim());
        const probe = new URL(request.url).searchParams.get("probe") === "1";

        if (!configured) {
            return jsonResponse({
                status: "not_configured",
                service: GATEWAY_NAME,
                version: GATEWAY_VERSION,
                curseforgeConfigured: false,
                curseforgeCredentials: "missing",
                timestamp: new Date().toISOString(),
            }, 503);
        }

        if (!probe) {
            return jsonResponse({
                status: "ok",
                service: GATEWAY_NAME,
                version: GATEWAY_VERSION,
                curseforgeConfigured: true,
                curseforgeCredentials: "not_checked",
                timestamp: new Date().toISOString(),
            }, 200);
        }

        try {
            await curseForgeRequest(`/games/${MINECRAFT_GAME_ID}`, { requestId });
            return jsonResponse({
                status: "ok",
                service: GATEWAY_NAME,
                version: GATEWAY_VERSION,
                curseforgeConfigured: true,
                curseforgeCredentials: "valid",
                curseforgeReachable: true,
                timestamp: new Date().toISOString(),
            }, 200);
        }
        catch (error) {
            if (error instanceof CurseForgeUpstreamError) {
                const rejected = error.upstreamStatus === 401 || error.upstreamStatus === 403;
                return jsonResponse({
                    status: "degraded",
                    service: GATEWAY_NAME,
                    version: GATEWAY_VERSION,
                    curseforgeConfigured: true,
                    curseforgeCredentials: rejected ? "rejected" : "unknown",
                    curseforgeReachable: rejected,
                    timestamp: new Date().toISOString(),
                }, 503);
            }
            throw error;
        }
    });
}
