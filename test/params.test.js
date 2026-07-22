import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../lib/errors.js";
import { parseIdBatch, parseLoader, parsePagination, positiveInteger } from "../lib/params.js";
test("positiveInteger accepts a valid id", () => {
    assert.equal(positiveInteger("432", "gameId"), 432);
});
test("positiveInteger rejects zero", () => {
    assert.throws(() => positiveInteger("0", "id"), ApiError);
});
test("parseLoader maps Fabric to the CurseForge enum", () => {
    const params = new URLSearchParams({ loader: "fabric" });
    assert.equal(parseLoader(params), 4);
});
test("parsePagination rejects requests beyond the CurseForge cap", () => {
    const params = new URLSearchParams({ index: "9990", pageSize: "20" });
    assert.throws(() => parsePagination(params), ApiError);
});
test("parseIdBatch removes duplicate ids", async () => {
    const request = new Request("https://example.test/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [1, 1, 2] }),
    });
    assert.deepEqual(await parseIdBatch(request, "fileIds"), [1, 2]);
});
