export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
export class CurseForgeUpstreamError extends Error {
    upstreamStatus;
    retryAfter;
    constructor(message, upstreamStatus, retryAfter = null) {
        super(message);
        this.name = "CurseForgeUpstreamError";
        this.upstreamStatus = upstreamStatus;
        this.retryAfter = retryAfter;
    }
}
