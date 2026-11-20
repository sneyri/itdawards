const username = process.env.TELEGRAM_BOT_USERNAME?.trim();
export const publicOrigin = process.env.PUBLIC_ORIGIN;
export const botApiToken = process.env.BOT_API_TOKEN || null;
export const codeSecret = process.env.AUTH_CODE_SECRET || null;
export const secureCookies = Boolean(publicOrigin?.startsWith('https://'));
export const botUrl = username && botApiToken && codeSecret
    ? `https://t.me/${username}?start=website_login` : null;

if (username && !/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) {
    throw new Error('TELEGRAM_BOT_USERNAME должен быть именем бота без @.');
}
if ([botApiToken, codeSecret].some((secret) => secret && (secret.length < 32 || /\s/.test(secret)))
    || (botApiToken && botApiToken === codeSecret)) {
    throw new Error('Настройте два разных секрета длиной от 32 символов без пробелов.');
}
if (process.env.NODE_ENV === 'production' && (!secureCookies || !botUrl)) {
    throw new Error('В production нужны HTTPS PUBLIC_ORIGIN и настройки Telegram-авторизации.');
}
