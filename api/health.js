import { GATEWAY_NAME, GATEWAY_VERSION } from "../lib/constants.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../lib/http.js";
export { OPTIONS };
export async function GET(request) {
    return handleApiRequest(request, async () => {
        const configured = Boolean(process.env.CURSEFORGE_API_KEY?.trim());
        return jsonResponse({
            status: configured ? "ok" : "not_configured",
            service: GATEWAY_NAME,
            version: GATEWAY_VERSION,
            curseforgeConfigured: configured,
            timestamp: new Date().toISOString(),
        }, configured ? 200 : 503);
    });
}
