import assert from "node:assert/strict";
import test from "node:test";

import { GET as downloadUrl } from "../api/curseforge/download-url.js";
import { GET as search } from "../api/curseforge/search.js";
import { GET as health } from "../api/health.js";

function restoreEnvironment(originalFetch) {
  globalThis.fetch = originalFetch;
  delete process.env.CURSEFORGE_API_KEY;
  delete process.env.CURSEFORGE_API_BASE_URL;
}

test("health reports a missing CurseForge key without exposing details", async () => {
  delete process.env.CURSEFORGE_API_KEY;
  const response = await health(new Request("https://gateway.test/api/health"));
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "not_configured");
  assert.equal(body.curseforgeConfigured, false);
  assert.equal(body.curseforgeCredentials, "missing");
});

test("health can probe whether the configured key is accepted", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { id: 432 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const response = await health(new Request("https://gateway.test/api/health?probe=1"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.curseforgeCredentials, "valid");
    assert.equal(body.curseforgeReachable, true);
  } finally {
    restoreEnvironment(originalFetch);
  }
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
    restoreEnvironment(originalFetch);
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
    restoreEnvironment(originalFetch);
  }
});

test("download-url uses the URL already present in file metadata", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      data: {
        fileName: "example.jar",
        downloadUrl: "https://edge.forgecdn.net/files/example.jar",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await downloadUrl(new Request("https://gateway.test/api/curseforge/download-url?modId=10&fileId=20"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data, "https://edge.forgecdn.net/files/example.jar");
    assert.equal(response.headers.get("x-mcw-download-source"), "file-metadata");
    assert.equal(calls, 1);
  } finally {
    restoreEnvironment(originalFetch);
  }
});

test("download-url reports manual download instead of a fake credential failure for restricted files", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ data: { fileName: "restricted.jar", downloadUrl: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("File distribution is disabled", { status: 403 });
  };
  try {
    const response = await downloadUrl(new Request("https://gateway.test/api/curseforge/download-url?modId=10&fileId=20"));
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(body.error.code, "manual_download_required");
    assert.equal(body.error.details.fileName, "restricted.jar");
    assert.equal(body.error.details.reason, "distribution_restricted_or_url_unavailable");
    assert.equal(calls, 2);
  } finally {
    restoreEnvironment(originalFetch);
  }
});

test("a real upstream authentication rejection is reported separately", async () => {
  process.env.CURSEFORGE_API_KEY = "bad-secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unauthorized API key", { status: 401 });
  try {
    const response = await downloadUrl(new Request("https://gateway.test/api/curseforge/download-url?modId=10&fileId=20"));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "gateway_credentials_rejected");
  } finally {
    restoreEnvironment(originalFetch);
  }
});

test("a generic forbidden response is not mislabeled as missing credentials", async () => {
  process.env.CURSEFORGE_API_KEY = "secret";
  process.env.CURSEFORGE_API_BASE_URL = "https://curseforge.test/v1";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Forbidden by project policy", { status: 403 });
  try {
    const request = new Request("https://gateway.test/api/curseforge/search?query=sodium&gameVersion=1.21.1&loader=fabric");
    const response = await search(request);
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "upstream_forbidden");
  } finally {
    restoreEnvironment(originalFetch);
  }
});
