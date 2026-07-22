import assert from "node:assert/strict";
import test from "node:test";
import { curseForgeRequest } from "../lib/curseforge.js";
test("curseForgeRequest adds the secret header without exposing it in the URL", async () => {
    process.env.CURSEFORGE_API_KEY = "server-secret";
    process.env.CURSEFORGE_API_BASE_URL = "https://api.example.test/v1";
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedHeaders = new Headers();
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input);
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    };
    try {
        const result = await curseForgeRequest("/mods/search", {
            query: new URLSearchParams({ gameId: "432" }),
            requestId: "request-1",
        });
        assert.deepEqual(result, { data: [] });
        assert.equal(capturedHeaders.get("x-api-key"), "server-secret");
        assert.equal(new URL(capturedUrl).searchParams.get("x-api-key"), null);
        assert.equal(new URL(capturedUrl).searchParams.get("gameId"), "432");
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.CURSEFORGE_API_KEY;
        delete process.env.CURSEFORGE_API_BASE_URL;
    }
});
