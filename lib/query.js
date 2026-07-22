export function appendIfDefined(params, name, value) {
    if (value !== undefined) {
        params.set(name, String(value));
    }
}
