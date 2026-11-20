export function sendError(res, status, code, message) {
    return res.status(status).json({ error: { code, message } });
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
        return sendError(res, 400, 'invalid_json', 'Тело запроса должно быть корректным JSON.');
    }
    if (error.type === 'entity.too.large') {
        return sendError(res, 413, 'payload_too_large', 'Слишком большой запрос.');
    }
    if (error.status === 415) {
        return sendError(res, 415, 'unsupported_payload', 'Формат запроса не поддерживается.');
    }
    if (error instanceof URIError && error.status === 400) {
        return sendError(res, 400, 'invalid_id', 'Некорректный идентификатор.');
    }
    console.error('Ошибка обработки запроса:', error.code ?? error.name);
    return sendError(res, 500, 'server_error', 'Не удалось обработать запрос. Попробуйте ещё раз.');
}

export function routeNotFound(_req, res) {
    return sendError(res, 404, 'route_not_found', 'Маршрут не найден.');
}
