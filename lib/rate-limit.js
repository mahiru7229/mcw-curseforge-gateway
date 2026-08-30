import { createHash } from "node:crypto";

import {
    getRateLimitEnabled,
    getRateLimitGlobalRequests,
    getRateLimitRedis,
    getRateLimitRequests,
    getRateLimitWindowSeconds,
} from "./env.js";
import { ApiError } from "./errors.js";

const RATE_LIMIT_PREFIX = "mcw:curseforge:rate-limit:v1";
const memoryWindows = new Map();

function clientAddress(request) {
    const candidates = [
        request.headers.get("x-vercel-forwarded-for"),
        request.headers.get("x-forwarded-for"),
        request.headers.get("x-real-ip"),
    ];
    for (const candidate of candidates) {
        const value = candidate?.split(",", 1)[0]?.trim();
        if (value) return value.slice(0, 200);
    }
    return "unknown";
}

export function rateLimitIdentifier(request) {
    return createHash("sha256").update(clientAddress(request)).digest("hex").slice(0, 32);
}

function windowState(now, windowSeconds) {
    const windowMs = windowSeconds * 1_000;
    const current = Math.floor(now / windowMs);
    const elapsed = now - current * windowMs;
    return {
        current,
        previous: current - 1,
        previousWeight: (windowMs - elapsed) / windowMs,
        resetAt: (current + 1) * windowMs,
        ttlSeconds: windowSeconds * 2 + 10,
    };
}

function keys(identifier, window) {
    return {
        clientCurrent: `${RATE_LIMIT_PREFIX}:client:${identifier}:${window.current}`,
        clientPrevious: `${RATE_LIMIT_PREFIX}:client:${identifier}:${window.previous}`,
        globalCurrent: `${RATE_LIMIT_PREFIX}:global:${window.current}`,
        globalPrevious: `${RATE_LIMIT_PREFIX}:global:${window.previous}`,
    };
}

function numericResult(entry, fallback = 0) {
    const value = Number(entry?.result);
    return Number.isFinite(value) ? value : fallback;
}

function evaluateCounts(clientCurrent, clientPrevious, globalCurrent, globalPrevious, window, limits) {
    const clientUsed = clientCurrent + clientPrevious * window.previousWeight;
    const globalUsed = globalCurrent + globalPrevious * window.previousWeight;
    const clientRemaining = Math.max(0, Math.floor(limits.client - clientUsed));
    const globalRemaining = Math.max(0, Math.floor(limits.global - globalUsed));
    const scope = clientUsed > limits.client ? "client" : globalUsed > limits.global ? "gateway" : "client";
    return {
        allowed: clientUsed <= limits.client && globalUsed <= limits.global,
        limit: scope === "gateway" ? limits.global : limits.client,
        remaining: scope === "gateway" ? globalRemaining : clientRemaining,
        resetAt: window.resetAt,
        scope,
    };
}

function cleanMemoryWindows(activeWindow) {
    if (memoryWindows.size < 1_000) return;
    for (const key of memoryWindows.keys()) {
        const suffix = Number(key.slice(key.lastIndexOf(":") + 1));
        if (Number.isFinite(suffix) && suffix < activeWindow - 1) memoryWindows.delete(key);
    }
}

function incrementMemory(key, cost) {
    const next = (memoryWindows.get(key) ?? 0) + cost;
    memoryWindows.set(key, next);
    return next;
}

function memoryLimit(identifier, cost, window, limits) {
    cleanMemoryWindows(window.current);
    const rateKeys = keys(identifier, window);
    return {
        ...evaluateCounts(
            incrementMemory(rateKeys.clientCurrent, cost),
            memoryWindows.get(rateKeys.clientPrevious) ?? 0,
            incrementMemory(rateKeys.globalCurrent, cost),
            memoryWindows.get(rateKeys.globalPrevious) ?? 0,
            window,
            limits,
        ),
        backend: "memory",
    };
}

async function redisLimit(redis, identifier, cost, window, limits) {
    const rateKeys = keys(identifier, window);
    const response = await fetch(`${redis.url}/multi-exec`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${redis.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify([
            ["INCRBY", rateKeys.clientCurrent, cost],
            ["EXPIRE", rateKeys.clientCurrent, window.ttlSeconds],
            ["GET", rateKeys.clientPrevious],
            ["INCRBY", rateKeys.globalCurrent, cost],
            ["EXPIRE", rateKeys.globalCurrent, window.ttlSeconds],
            ["GET", rateKeys.globalPrevious],
        ]),
        signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`Rate-limit store returned HTTP ${response.status}.`);
    const results = await response.json();
    if (!Array.isArray(results) || results.some((entry) => entry?.error)) {
        throw new Error("Rate-limit store returned an invalid transaction response.");
    }
    return {
        ...evaluateCounts(
            numericResult(results[0]),
            numericResult(results[2]),
            numericResult(results[3]),
            numericResult(results[5]),
            window,
            limits,
        ),
        backend: "redis",
    };
}

function limitHeaders(result) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1_000));
    return {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
        ...(result.allowed ? {} : { "Retry-After": String(retryAfter) }),
    };
}

export async function enforceRateLimit(request, options = {}) {
    if (!getRateLimitEnabled()) return null;
    const cost = Number.isInteger(options.cost) && options.cost >= 1 && options.cost <= 10 ? options.cost : 1;
    const windowSeconds = getRateLimitWindowSeconds();
    const limits = {
        client: getRateLimitRequests(),
        global: getRateLimitGlobalRequests(),
    };
    const window = windowState(Date.now(), windowSeconds);
    const identifier = rateLimitIdentifier(request);
    const redis = getRateLimitRedis();
    let result;
    try {
        result = redis
            ? await redisLimit(redis, identifier, cost, window, limits)
            : memoryLimit(identifier, cost, window, limits);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown rate-limit store error";
        console.error("Rate-limit store failed", { message });
        throw new ApiError(503, "rate_limit_unavailable", "The gateway protection service is temporarily unavailable.");
    }
    if (!result.allowed) {
        throw new ApiError(
            429,
            "rate_limited",
            result.scope === "gateway"
                ? "The gateway request budget is temporarily exhausted."
                : "Too many requests were sent from this client.",
            { scope: result.scope, resetAt: new Date(result.resetAt).toISOString() },
            limitHeaders(result),
        );
    }
    return limitHeaders(result);
}

export function getRateLimitHealth() {
    const redis = getRateLimitRedis();
    return {
        enabled: getRateLimitEnabled(),
        backend: redis ? "redis" : "memory",
        distributed: Boolean(redis),
        requestsPerWindow: getRateLimitRequests(),
        globalRequestsPerWindow: getRateLimitGlobalRequests(),
        windowSeconds: getRateLimitWindowSeconds(),
    };
}

export function resetRateLimitForTests() {
    memoryWindows.clear();
}
