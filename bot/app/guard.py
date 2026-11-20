"""Заглушка: бот может делать только то, что ему действительно нужно.

ВСЕ запросы библиотеки telebot к Telegram проходят через одну функцию
apihelper._make_request. Мы оборачиваем её и проверяем каждый запрос:

  1. Метод должен быть в белом списке ALLOWED_METHODS. Всё остальное
     (setWebhook, logOut, setMyName, banChatMember, ...) блокируется.
  2. Методы, которые ПИШУТ, могут писать только в личные чаты: chat_id и
     from_chat_id должны быть положительными числами (у каналов и групп ID
     отрицательные или @username). Сообщения через inline_message_id запрещены.
  3. Только методы для чтения канала (READ_ONLY_METHODS) могут обращаться к каналу.

ВАЖНО: это защита от ошибок в НАШЕМ коде (неверный ID, лишний метод). От кражи токена
она не спасает: у вора своя программа. Против кражи — перевыпуск токена и
отсутствие прав у бота в канале (см. README).
"""
import logging

from telebot import apihelper

log = logging.getLogger(__name__)

# Методы, которые только читают — им можно обращаться к каналу.
READ_ONLY_METHODS = {"getme", "getchat", "getchatmember", "getupdates", "getwebhookinfo"}

# Методы, которые пишут — только в личные чаты.
WRITE_METHODS = {"sendmessage", "editmessagetext", "answercallbackquery", "copymessage", "deletemessage",
                 "sendphoto", "sendvideo"}

# Служебные: команды бота в меню, описание бота (с контактом для связи — main.py)
# и удаление ЧУЖОГО webhook (app/services/watchdog.py).
SERVICE_METHODS = {"setmycommands", "setmydescription", "setmyshortdescription", "deletewebhook"}

ALLOWED_METHODS = READ_ONLY_METHODS | WRITE_METHODS | SERVICE_METHODS

CHAT_FIELDS = ("chat_id", "from_chat_id")


class ChannelWriteBlocked(RuntimeError):
    """Запрос, который боту делать нельзя."""


def _is_private_chat_id(value):
    if isinstance(value, bool):
        return False
    if isinstance(value, str):
        value = value.strip()
        if not value.isdigit():
            return False  # «@username», «-100...», «+5» — не личный чат
        value = int(value)
    return isinstance(value, int) and value > 0


def check_request(method_name, params):
    """Бросает ChannelWriteBlocked, если запрос не разрешён."""
    method = str(method_name).lower()
    params = params or {}
    if method not in ALLOWED_METHODS:
        raise ChannelWriteBlocked(f"Метод {method_name} не разрешён боту")
    if method in READ_ONLY_METHODS:
        return
    if "inline_message_id" in params:
        raise ChannelWriteBlocked(f"{method_name}: inline-сообщения боту не нужны")
    if method == "setmycommands" and "scope" in params:
        raise ChannelWriteBlocked("setMyCommands: команды задаются только для всех сразу")
    for field in CHAT_FIELDS:
        if field in params and not _is_private_chat_id(params[field]):
            raise ChannelWriteBlocked(f"{method_name}: {field}={params[field]!r} — это не личный чат")
    if "reply_parameters" in params:
        raise ChannelWriteBlocked(f"{method_name}: ответы на сообщения боту не нужны")


def install():
    """Включает заглушку. Вызывается один раз при создании бота (app/loader.py)."""
    if getattr(apihelper._make_request, "_guarded", False):
        return
    original = apihelper._make_request

    def guarded(token, method_name, method="get", params=None, files=None):
        try:
            check_request(method_name, params)
        except ChannelWriteBlocked as e:
            log.error("ЗАБЛОКИРОВАНО: %s", e)
            raise
        return original(token, method_name, method=method, params=params, files=files)

    guarded._guarded = True
    apihelper._make_request = guarded


def is_installed():
    """Проверка при запуске: заглушку никто не снял (main.py)."""
    return getattr(apihelper._make_request, "_guarded", False)
