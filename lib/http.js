import { randomUUID } from "node:crypto";
import { assertClientAuthorized } from "./auth.js";
import { getAllowedOrigin } from "./env.js";
import { ApiError, CurseForgeUpstreamError } from "./errors.js";
import { enforceRateLimit } from "./rate-limit.js";

function corsHeaders() {
    return {
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-MCW-Client-Token, X-MCW-Version",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Origin": getAllowedOrigin(),
        "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-Id",
        "Access-Control-Max-Age": "86400",
    };
}
function cacheControl(policy) {
    if (!policy) return "no-store";
    const values = [`public`, `max-age=${policy.maxAge ?? 0}`, `s-maxage=${policy.sMaxAge ?? 0}`];
    if (policy.staleWhileRevalidate) values.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
    return values.join(", ");
}
export function jsonResponse(data, status = 200, policy, extraHeaders) {
    const headers = new Headers({
        "Cache-Control": cacheControl(policy),
        "Content-Type": "application/json; charset=utf-8",
        "Vercel-CDN-Cache-Control": cacheControl(policy),
        ...corsHeaders(),
    });
    if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
    return new Response(JSON.stringify(data), { status, headers });
}
export function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders() });
}

function looksLikeCredentialFailure(error) {
    if (error.upstreamStatus === 401) return true;
    if (error.upstreamStatus !== 403) return false;
    const preview = error.responsePreview.toLowerCase();
    return preview.includes("api key")
        || preview.includes("x-api-key")
        || preview.includes("credential")
        || preview.includes("unauthorized")
        || preview.includes("authentication");
}

function mapUpstreamError(error, requestId) {
    const status = error.upstreamStatus;
    if (status === 404) {
        return jsonResponse({ error: { code: "not_found", message: "The requested CurseForge resource was not found.", requestId } }, 404);
    }
    if (status === 400) {
        return jsonResponse({ error: { code: "upstream_rejected_request", message: "CurseForge rejected the validated request.", requestId } }, 400);
    }
    if (status === 429) {
        return jsonResponse({ error: { code: "upstream_rate_limited", message: "CurseForge is temporarily rate limited.", requestId } }, 503, undefined, error.retryAfter ? { "Retry-After": error.retryAfter } : undefined);
    }
    if (looksLikeCredentialFailure(error)) {
        return jsonResponse({ error: { code: "gateway_credentials_rejected", message: "CurseForge rejected the gateway credentials.", requestId } }, 503);
    }
    if (status === 403) {
        return jsonResponse({ error: { code: "upstream_forbidden", message: "CurseForge denied this operation.", requestId } }, 403);
    }
    return jsonResponse({ error: { code: "upstream_unavailable", message: "CurseForge is temporarily unavailable.", requestId } }, 502);
}

export async function handleApiRequest(request, handler, options = {}) {
    const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
    try {
        if (options.requireClientAuth) assertClientAuthorized(request);
        const rateLimitHeaders = options.rateLimit || options.requireClientAuth
            ? await enforceRateLimit(request, { cost: options.rateLimitCost })
            : null;
        const response = await handler(requestId);
        response.headers.set("X-Request-Id", requestId);
        if (rateLimitHeaders) {
            new Headers(rateLimitHeaders).forEach((value, key) => response.headers.set(key, value));
        }
        return response;
    }
    catch (error) {
        if (error instanceof ApiError) {
            return jsonResponse({
                error: {
                    code: error.code,
                    message: error.message,
                    requestId,
                    ...(error.details ? { details: error.details } : {}),
                },
            }, error.status, undefined, error.headers);
        }
        if (error instanceof CurseForgeUpstreamError) {
            console.error("CurseForge upstream request failed", { requestId, status: error.upstreamStatus, path: error.path, message: error.message });
            return mapUpstreamError(error, requestId);
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Unhandled gateway error", { requestId, message });
        return jsonResponse({ error: { code: "internal_error", message: "The gateway could not complete the request.", requestId } }, 500);
    }
}
