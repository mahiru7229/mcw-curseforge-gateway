import { curseForgeRequest } from "../../lib/curseforge.js";
import { ApiError, CurseForgeUpstreamError } from "../../lib/errors.js";
import { handleApiRequest, jsonResponse, OPTIONS } from "../../lib/http.js";
import { positiveInteger } from "../../lib/params.js";

export { OPTIONS };

function normalizeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    }
    catch {
        return null;
    }
}

function manualDownloadDetails(file, modId, fileId) {
    return {
        modId,
        fileId,
        fileName: typeof file?.fileName === "string" ? file.fileName : null,
        reason: "distribution_restricted_or_url_unavailable",
    };
}

export async function GET(request) {
    return handleApiRequest(request, async (requestId) => {
        const params = new URL(request.url).searchParams;
        const modId = positiveInteger(params.get("modId"), "modId");
        const fileId = positiveInteger(params.get("fileId"), "fileId");
        const requestOptions = { requestId, launcherVersion: request.headers.get("x-mcw-version") };

        const filePayload = await curseForgeRequest(`/mods/${modId}/files/${fileId}`, requestOptions);
        const file = filePayload?.data ?? null;
        const metadataUrl = normalizeHttpUrl(file?.downloadUrl);
        if (metadataUrl) {
            return jsonResponse({ data: metadataUrl }, 200, undefined, { "X-MCW-Download-Source": "file-metadata" });
        }

        try {
            const data = await curseForgeRequest(`/mods/${modId}/files/${fileId}/download-url`, requestOptions);
            const resolvedUrl = normalizeHttpUrl(data?.data);
            if (!resolvedUrl) {
                throw new ApiError(409, "manual_download_required", "CurseForge did not provide an automatic download URL for this file.", manualDownloadDetails(file, modId, fileId));
            }
            return jsonResponse({ data: resolvedUrl }, 200, undefined, { "X-MCW-Download-Source": "download-url-endpoint" });
        }
        catch (error) {
            if (error instanceof CurseForgeUpstreamError && (error.upstreamStatus === 403 || error.upstreamStatus === 404)) {
                throw new ApiError(409, "manual_download_required", "This CurseForge file must be downloaded manually because third-party distribution is unavailable.", manualDownloadDetails(file, modId, fileId));
            }
            throw error;
        }
    }, { requireClientAuth: true, rateLimitCost: 2 });
}
