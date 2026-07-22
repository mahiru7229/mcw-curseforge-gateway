import { GATEWAY_NAME, GATEWAY_VERSION } from "./constants.js";
import { getCurseForgeApiKey, getCurseForgeBaseUrl, getCurseForgeTimeoutMs } from "./env.js";
import { CurseForgeUpstreamError } from "./errors.js";
export async function curseForgeRequest(path, options) {
    const url = new URL(`${getCurseForgeBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
    if (options.query) {
        options.query.forEach((value, key) => url.searchParams.append(key, value));
    }
    const headers = new Headers({
        Accept: "application/json",
        "User-Agent": `${GATEWAY_NAME}/${GATEWAY_VERSION}`,
        "X-Request-Id": options.requestId,
        "x-api-key": getCurseForgeApiKey(),
    });
    if (options.launcherVersion) {
        headers.set("X-MCW-Version", options.launcherVersion.slice(0, 100));
    }
    let body;
    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(options.body);
    }
    let response;
    try {
        response = await fetch(url, {
            method: options.method ?? "GET",
            headers,
            body,
            signal: AbortSignal.timeout(getCurseForgeTimeoutMs()),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Network error";
        throw new CurseForgeUpstreamError(`Network request failed: ${message}`, 502);
    }
    if (!response.ok) {
        const preview = (await response.text()).slice(0, 500);
        console.error("CurseForge returned an error", {
            requestId: options.requestId,
            status: response.status,
            path,
            preview,
        });
        throw new CurseForgeUpstreamError(`CurseForge returned HTTP ${response.status}.`, response.status, response.headers.get("retry-after"));
    }
    try {
        return await response.json();
    }
    catch {
        throw new CurseForgeUpstreamError("CurseForge returned invalid JSON.", 502);
    }
}
