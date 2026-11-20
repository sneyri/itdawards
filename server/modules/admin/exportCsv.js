function csvCell(value) {
    if (value == null) return '""';
    const text = value instanceof Date ? value.toISOString() : String(value);
    // Spreadsheet apps may execute quoted cells starting with a formula character.
    const safeText = typeof value === 'string' && /^(\s*[=+\-@]|[\t\r\n])/.test(text) ? "'" + text : text;
    return '"' + safeText.replaceAll('"', '""') + '"';
}

export function sendCsv(res, filename, columns, rows) {
    const csv = [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))];
    return res.attachment(filename).type('text/csv').send('\uFEFF' + csv.join('\r\n') + '\r\n');
}
