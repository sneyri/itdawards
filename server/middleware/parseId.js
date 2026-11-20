export function parseId(value) {
    if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)) value = Number(value);
    return Number.isInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}
