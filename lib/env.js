import { ApiError } from "./errors.js";
import { DEFAULT_TIMEOUT_MS } from "./constants.js";
export function getCurseForgeApiKey() {
    const value = process.env.CURSEFORGE_API_KEY?.trim();
    if (!value) {
        throw new ApiError(503, "gateway_not_configured", "CURSEFORGE_API_KEY is not configured.");
    }
    return value;
}
export function getCurseForgeBaseUrl() {
    const value = process.env.CURSEFORGE_API_BASE_URL?.trim();
    return (value || "https://api.curseforge.com/v1").replace(/\/+$/, "");
}
export function getCurseForgeTimeoutMs() {
    const raw = process.env.CURSEFORGE_TIMEOUT_MS?.trim();
    if (!raw) {
        return DEFAULT_TIMEOUT_MS;
    }
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1_000 && value <= 30_000
        ? value
        : DEFAULT_TIMEOUT_MS;
}
export function getClientToken() {
    return process.env.MCW_CLIENT_TOKEN?.trim() || null;
}
export function getAllowedOrigin() {
    return process.env.MCW_ALLOWED_ORIGIN?.trim() || "*";
}

function integerEnvironment(name, fallback, minimum, maximum) {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

export function getRateLimitEnabled() {
    return process.env.MCW_RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false";
}

export function getRateLimitRequests() {
    return integerEnvironment("MCW_RATE_LIMIT_REQUESTS", 60, 1, 10_000);
}

export function getRateLimitGlobalRequests() {
    return integerEnvironment("MCW_RATE_LIMIT_GLOBAL_REQUESTS", 600, 1, 100_000);
}

export function getRateLimitWindowSeconds() {
    return integerEnvironment("MCW_RATE_LIMIT_WINDOW_SECONDS", 60, 1, 3_600);
}

export function getRateLimitRedis() {
    const url = (
        process.env.MCW_RATE_LIMIT_REDIS_REST_URL
        ?? process.env.UPSTASH_REDIS_REST_URL
        ?? process.env.KV_REST_API_URL
    )?.trim().replace(/\/+$/, "");
    const token = (
        process.env.MCW_RATE_LIMIT_REDIS_REST_TOKEN
        ?? process.env.UPSTASH_REDIS_REST_TOKEN
        ?? process.env.KV_REST_API_TOKEN
    )?.trim();
    return url && token ? { url, token } : null;
}
