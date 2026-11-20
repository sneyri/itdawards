"""Запрос одноразового кода к локальному Backend."""
import logging
from urllib.parse import urlsplit

import requests

import config

log = logging.getLogger(__name__)
UNAVAILABLE = "Сейчас вход на сайт недоступен. Попробуйте позже."


def _loopback_origin():
    try:
        url = urlsplit(config.AWARDS_SITE_API_URL)
        if (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1")
                and url.port and url.username is None and url.password is None
                and url.path in ("", "/") and not url.query and not url.fragment):
            return f"http://{url.netloc}"
    except ValueError:
        pass
    return ""


def configured():
    return bool(_loopback_origin() and config.BOT_API_TOKEN)


def _error_text(response):
    if response.status_code == 429:
        delay = response.headers.get("Retry-After", "")
        if delay.isascii() and delay.isdecimal() and len(delay) <= 5:
            return f"Запросы поступают слишком часто. Подождите {delay} сек. и повторите команду."
        return "Запросы поступают слишком часто. Подождите немного и повторите команду."
    if response.status_code == 403:
        return "Аккаунт на сайте заблокирован. Обратитесь к организаторам."
    log.warning("Сайт отклонил запрос бота (HTTP %s)", response.status_code)
    return UNAVAILABLE


def request_login_code(telegram_user):
    origin = _loopback_origin()
    if not origin or not config.BOT_API_TOKEN:
        return None, UNAVAILABLE

    payload = {"telegramId": str(telegram_user.id)}
    display_name = " ".join(
        part for part in (telegram_user.first_name, telegram_user.last_name) if part
    ).strip()
    if display_name:
        payload["displayName"] = display_name[:120]

    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.post(
                f"{origin}/api/bot/code",
                json=payload,
                headers={"Authorization": f"Bearer {config.BOT_API_TOKEN}"},
                timeout=(2, 4),
                allow_redirects=False,
            )
        if response.status_code != 200:
            return None, _error_text(response)
        data = response.json()["data"]
        if isinstance(data, dict):
            return data, None
    except (requests.RequestException, ValueError, KeyError, TypeError):
        pass
    log.warning("Сайт не вернул ожидаемый ответ на запрос бота")
    return None, UNAVAILABLE
