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
