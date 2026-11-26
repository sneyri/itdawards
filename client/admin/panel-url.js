const aliases = new Map([
    // Old audit links open the security section. Its journal has a separate section parameter.
    ['audit', 'security'],
    ['lab', 'overview'],
    ['constellation', 'catalog'],
]);

export function readPanelUrl() {
    const raw = location.hash.slice(1);
    const separator = raw.indexOf('?');
    const name = separator === -1 ? raw : raw.slice(0, separator);
    const query = separator === -1 ? '' : raw.slice(separator + 1);
    return {
        id: aliases.get(name) ?? (name || 'overview'),
        params: new URLSearchParams(query),
    };
}

export function updatePanelUrl(fields, { history: mode = 'push' } = {}) {
    const { id, params } = readPanelUrl();
    for (const [key, value] of Object.entries(fields)) {
        if (value == null || value === '') params.delete(key);
        else params.set(key, String(value));
    }
    const query = params.toString();
    const hash = '#' + id + (query ? '?' + query : '');
    if (hash === location.hash) return;
    if (mode === 'replace') history.replaceState(history.state, '', hash);
    else history.pushState(history.state, '', hash);
}
