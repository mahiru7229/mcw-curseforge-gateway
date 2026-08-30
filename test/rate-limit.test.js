import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../lib/errors.js";
import {
    enforceRateLimit,
    getRateLimitHealth,
    rateLimitIdentifier,
    resetRateLimitForTests,
} from "../lib/rate-limit.js";

function clearRateLimitEnvironment() {
    for (const name of [
        "MCW_RATE_LIMIT_ENABLED",
        "MCW_RATE_LIMIT_REQUESTS",
        "MCW_RATE_LIMIT_GLOBAL_REQUESTS",
        "MCW_RATE_LIMIT_WINDOW_SECONDS",
        "MCW_RATE_LIMIT_REDIS_REST_URL",
        "MCW_RATE_LIMIT_REDIS_REST_TOKEN",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "KV_REST_API_URL",
        "KV_REST_API_TOKEN",
    ]) delete process.env[name];
    resetRateLimitForTests();
}

test("memory rate limit rejects requests over the per-client budget", async () => {
    clearRateLimitEnvironment();
    process.env.MCW_RATE_LIMIT_REQUESTS = "2";
    process.env.MCW_RATE_LIMIT_GLOBAL_REQUESTS = "20";
    const request = new Request("https://gateway.test/api/curseforge/search", {
        headers: { "X-Vercel-Forwarded-For": "203.0.113.10" },
    });
    try {
        const first = await enforceRateLimit(request);
        const second = await enforceRateLimit(request);
        assert.equal(first["X-RateLimit-Limit"], "2");
        assert.equal(second["X-RateLimit-Remaining"], "0");
        await assert.rejects(enforceRateLimit(request), (error) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.status, 429);
            assert.equal(error.code, "rate_limited");
            assert.equal(error.details.scope, "client");
            assert.ok(Number(error.headers["Retry-After"]) >= 1);
            return true;
        });
    }
    finally {
        clearRateLimitEnvironment();
    }
});

test("different client addresses receive independent client budgets", async () => {
    clearRateLimitEnvironment();
    process.env.MCW_RATE_LIMIT_REQUESTS = "1";
    process.env.MCW_RATE_LIMIT_GLOBAL_REQUESTS = "10";
    const first = new Request("https://gateway.test/api/curseforge/mod", {
        headers: { "X-Vercel-Forwarded-For": "203.0.113.11" },
    });
    const second = new Request("https://gateway.test/api/curseforge/mod", {
        headers: { "X-Vercel-Forwarded-For": "203.0.113.12" },
    });
    try {
        assert.notEqual(rateLimitIdentifier(first), rateLimitIdentifier(second));
        await assert.doesNotReject(enforceRateLimit(first));
        await assert.doesNotReject(enforceRateLimit(second));
    }
    finally {
        clearRateLimitEnvironment();
    }
});

test("redis rate limit uses an atomic transaction without storing the raw address", async () => {
    clearRateLimitEnvironment();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "redis-secret";
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuthorization = "";
    let capturedBody = "";
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input);
        capturedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
        capturedBody = String(init?.body);
        return new Response(JSON.stringify([
            { result: 1 },
            { result: 1 },
            { result: null },
            { result: 1 },
            { result: 1 },
            { result: null },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    try {
        const request = new Request("https://gateway.test/api/curseforge/files", {
            headers: { "X-Vercel-Forwarded-For": "198.51.100.44" },
        });
        await enforceRateLimit(request);
        assert.equal(capturedUrl, "https://redis.example.test/multi-exec");
        assert.equal(capturedAuthorization, "Bearer redis-secret");
        assert.doesNotMatch(capturedBody, /198\.51\.100\.44/);
        assert.match(capturedBody, /INCRBY/);
        assert.equal(getRateLimitHealth().distributed, true);
    }
    finally {
        globalThis.fetch = originalFetch;
        clearRateLimitEnvironment();
    }
});

test("configured distributed rate limit fails closed when its store is unavailable", async () => {
    clearRateLimitEnvironment();
    process.env.MCW_RATE_LIMIT_REDIS_REST_URL = "https://redis.example.test";
    process.env.MCW_RATE_LIMIT_REDIS_REST_TOKEN = "redis-secret";
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    console.error = () => {};
    try {
        await assert.rejects(
            enforceRateLimit(new Request("https://gateway.test/api/curseforge/search")),
            (error) => error instanceof ApiError && error.status === 503 && error.code === "rate_limit_unavailable",
        );
    }
    finally {
        console.error = originalConsoleError;
        globalThis.fetch = originalFetch;
        clearRateLimitEnvironment();
    }
});
