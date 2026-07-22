import { MAX_BATCH_SIZE, MAX_PAGE_SIZE, MAX_RESULT_INDEX, MOD_LOADER_TYPES, } from "./constants.js";
import { ApiError } from "./errors.js";
export function requiredString(params, name, maxLength) {
    const value = params.get(name)?.trim();
    if (!value) {
        throw new ApiError(400, "invalid_parameter", `Query parameter '${name}' is required.`);
    }
    if (value.length > maxLength) {
        throw new ApiError(400, "invalid_parameter", `Query parameter '${name}' is too long.`);
    }
    return value;
}
export function optionalString(params, name, maxLength) {
    const value = params.get(name)?.trim();
    if (!value) {
        return undefined;
    }
    if (value.length > maxLength) {
        throw new ApiError(400, "invalid_parameter", `Query parameter '${name}' is too long.`);
    }
    return value;
}
export function positiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0 || number > 2_147_483_647) {
        throw new ApiError(400, "invalid_parameter", `'${name}' must be a positive 32-bit integer.`);
    }
    return number;
}
export function optionalInteger(params, name, options = {}) {
    const raw = params.get(name)?.trim();
    if (!raw) {
        return undefined;
    }
    const value = Number(raw);
    const min = options.min ?? 0;
    const max = options.max ?? 2_147_483_647;
    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new ApiError(400, "invalid_parameter", `'${name}' must be an integer from ${min} to ${max}.`);
    }
    return value;
}
export function parsePagination(params) {
    const index = optionalInteger(params, "index", { min: 0, max: MAX_RESULT_INDEX - 1 }) ?? 0;
    const pageSize = optionalInteger(params, "pageSize", { min: 1, max: MAX_PAGE_SIZE }) ?? 20;
    if (index + pageSize > MAX_RESULT_INDEX) {
        throw new ApiError(400, "invalid_pagination", `index + pageSize must not exceed ${MAX_RESULT_INDEX}.`);
    }
    return { index, pageSize };
}
export function parseLoader(params) {
    const raw = params.get("loader")?.trim().toLowerCase();
    if (!raw) {
        return undefined;
    }
    if (!(raw in MOD_LOADER_TYPES)) {
        throw new ApiError(400, "invalid_loader", "loader must be one of: any, forge, fabric, quilt, neoforge.");
    }
    return MOD_LOADER_TYPES[raw];
}
export function parseSortOrder(params) {
    const raw = params.get("sortOrder")?.trim().toLowerCase();
    if (!raw) {
        return undefined;
    }
    if (raw !== "asc" && raw !== "desc") {
        throw new ApiError(400, "invalid_parameter", "sortOrder must be 'asc' or 'desc'.");
    }
    return raw;
}
export async function parseIdBatch(request, field) {
    let body;
    try {
        body = await request.json();
    }
    catch {
        throw new ApiError(400, "invalid_json", "Request body must contain valid JSON.");
    }
    if (!body || typeof body !== "object" || !Array.isArray(body[field])) {
        throw new ApiError(400, "invalid_body", `Request body must contain an array named '${field}'.`);
    }
    const rawValues = body[field];
    if (rawValues.length < 1 || rawValues.length > MAX_BATCH_SIZE) {
        throw new ApiError(400, "invalid_body", `'${field}' must contain between 1 and ${MAX_BATCH_SIZE} IDs.`);
    }
    const values = rawValues.map((value, index) => positiveInteger(String(value), `${field}[${index}]`));
    return [...new Set(values)];
}
