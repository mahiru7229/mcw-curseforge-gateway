import assert from "node:assert/strict";
import test from "node:test";
import { assertClientAuthorized } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
test("client authentication is optional when no token is configured", () => {
    delete process.env.MCW_CLIENT_TOKEN;
    assert.doesNotThrow(() => assertClientAuthorized(new Request("https://example.test")));
});
test("client authentication accepts a matching bearer token", () => {
    process.env.MCW_CLIENT_TOKEN = "test-token";
    const request = new Request("https://example.test", {
        headers: { Authorization: "Bearer test-token" },
    });
    assert.doesNotThrow(() => assertClientAuthorized(request));
    delete process.env.MCW_CLIENT_TOKEN;
});
test("client authentication rejects an invalid token", () => {
    process.env.MCW_CLIENT_TOKEN = "test-token";
    const request = new Request("https://example.test", {
        headers: { Authorization: "Bearer wrong-token" },
    });
    assert.throws(() => assertClientAuthorized(request), ApiError);
    delete process.env.MCW_CLIENT_TOKEN;
});
