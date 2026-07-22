import { timingSafeEqual } from "node:crypto";
import { getClientToken } from "./env.js";
import { ApiError } from "./errors.js";
function safeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
}
function readPresentedToken(request) {
    const authorization = request.headers.get("authorization")?.trim();
    if (authorization?.toLowerCase().startsWith("bearer ")) {
        return authorization.slice(7).trim() || null;
    }
    return request.headers.get("x-mcw-client-token")?.trim() || null;
}
export function assertClientAuthorized(request) {
    const expected = getClientToken();
    if (!expected) {
        return;
    }
    const presented = readPresentedToken(request);
    if (!presented || !safeEqual(presented, expected)) {
        throw new ApiError(401, "unauthorized", "A valid MCW client token is required.");
    }
}
