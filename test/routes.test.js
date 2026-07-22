import assert from "node:assert/strict";
import test from "node:test";

import { GET as search } from "../api/curseforge/search.js";
import { GET as health } from "../api/health.js";

test("health reports a missing CurseForge key without exposing details", async () => {
  delete process.env.CURSEFORGE_API_KEY;
  const response = await health(new Request("https://gateway.test/api/health"));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, "not_configured");
  assert.equal(body.curseforgeConfigured, false);
});

test("search validates loader and game version before calling upstream", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };

  try {
    const request = new Request("https://gateway.test/api/curseforge/search?query=sodium&loader=fabric");
    const response = await search(request);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "missing_game_version");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CURSEFORGE_API_KEY;
  }
});

test("search forwards validated Minecraft parameters to CurseForge", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  let capturedUrl = null;

  globalThis.fetch = async (input) => {
    capturedUrl = new URL(String(input));
    return new Response(JSON.stringify({ data: [], pagination: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const request = new Request("https://gateway.test/api/curseforge/search?query=sodium&gameVersion=1.21.1&loader=fabric&pageSize=10");
    const response = await search(request);

    assert.equal(response.status, 200);
    assert.equal(capturedUrl.searchParams.get("gameId"), "432");
    assert.equal(capturedUrl.searchParams.get("classId"), "6");
    assert.equal(capturedUrl.searchParams.get("modLoaderType"), "4");
    assert.equal(capturedUrl.searchParams.get("pageSize"), "10");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CURSEFORGE_API_KEY;
    delete process.env.CURSEFORGE_API_BASE_URL;
  }
});
