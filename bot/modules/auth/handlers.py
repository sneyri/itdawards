"""Команды Telegram, выдающие код входа в личном чате."""
import logging
from urllib.parse import urlsplit

import requests
from telebot import types
from telebot.apihelper import ApiException

import config
from app import security
from app.loader import bot
from .site_api import UNAVAILABLE, request_login_code

log = logging.getLogger(__name__)
PRIVATE = ["private"]


def allow_private(message):
    user = message.from_user
    return (message.chat.type == "private" and user is not None
            and message.chat.id == user.id and not user.is_bot
            and not security.too_fast(user.id))


def reply(message, text, markup=None):
    try:
        bot.send_message(message.chat.id, text, reply_markup=markup, timeout=8)
    except (ApiException, requests.RequestException):
        log.warning("Не удалось отправить ответ о входе на сайт")


def _website_button():
    try:
        url = urlsplit(config.AWARDS_SITE_LOGIN_URL)
        if (url.netloc and url.hostname and url.username is None and url.password is None
                and (url.scheme == "https" or
                     url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1"))):
            return types.InlineKeyboardMarkup().add(
                types.InlineKeyboardButton("Открыть форму входа", url=config.AWARDS_SITE_LOGIN_URL)
            )
    except ValueError:
        pass
    return None


def show_code(message):
    if not allow_private(message):
        return
    data, error = request_login_code(message.from_user)
    if error:
        return reply(message, error)
    code = data.get("code")
    seconds = data.get("expiresIn")
    if (not isinstance(code, str) or not config.AWARDS_SITE_CODE_PATTERN.fullmatch(code)
            or type(seconds) is not int or seconds <= 0):
        log.warning("Сайт вернул код в неизвестном формате")
        return reply(message, UNAVAILABLE)
    return reply(
        message,
        f"Код для входа на сайт — <code>{code}</code>\n\n"
        f"Введите его на странице входа. Код действует {seconds} сек. и используется один раз. "
        "Никому его не пересылайте. После истечения срока используйте /newcode.",
        _website_button(),
    )


def register():
    bot.register_message_handler(show_code, commands=["start", "login", "newcode"], chat_types=PRIVATE)
