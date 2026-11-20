"""Настройка логов так, чтобы токен бота в них НИКОГДА не попадал.

Откуда он мог взяться: при обрыве связи библиотека requests пишет в текст ошибки
полный адрес запроса https://api.telegram.org/bot<ТОКЕН>/... — и этот текст
оказывался в логе и в окне консоли.

Здесь все сообщения логов и все необработанные ошибки проходят через mask().
"""
import logging
import logging.handlers
import sys
import threading
import traceback

import config

MASK = "***TOKEN***"


def mask(text):
    text = str(text)
    if config.BOT_TOKEN:
        text = text.replace(config.BOT_TOKEN, MASK)
        secret_part = config.BOT_TOKEN.split(":", 1)[-1]
        if len(secret_part) >= 20:
            text = text.replace(secret_part, MASK)
    if config.BOT_API_TOKEN:
        text = text.replace(config.BOT_API_TOKEN, MASK)
        text = config.AWARDS_SITE_CODE_PATTERN.sub("***LOGIN CODE***", text)
    return text


class SafeFormatter(logging.Formatter):
    """Обычный форматтер, только итоговая строка (вместе с traceback) проходит через mask()."""

    def format(self, record):
        return mask(super().format(record))


LOG_FILE = config.BASE_DIR / "logs" / "bot.log"
dashboard_active = False   # True, пока в терминале рисуется живая панель (app/services/console.py)


def _safe_excepthook(exc_type, exc, tb):
    text = mask("".join(traceback.format_exception(exc_type, exc, tb)))
    if dashboard_active:
        # Панель занимает весь экран: ошибку пишем в лог и в список событий, а не в stderr.
        logging.getLogger("crash").critical(text)
    else:
        sys.stderr.write(text)


def _safe_thread_excepthook(args):
    _safe_excepthook(args.exc_type, args.exc_value, args.exc_traceback)


def configure():
    # Время с миллисекундами, уровень, поток, логгер: так видно, где и когда именно случилось.
    formatter = SafeFormatter("%(asctime)s.%(msecs)03d %(levelname)-7s [%(threadName)s] %(name)s: %(message)s",
                              datefmt="%H:%M:%S")
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handlers = [handler]

    # Полный лог в файл: когда терминал показывает живую панель, подробности ищи здесь.
    try:
        LOG_FILE.parent.mkdir(exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_FILE, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
    except OSError:
        pass

    # События без дублей для живых экранов (терминал и сообщение в Telegram).


    root = logging.getLogger()
    root.handlers[:] = handlers
    level = getattr(logging, config.LOG_LEVEL, logging.INFO)
    root.setLevel(level)

    # У telebot свой обработчик — ему тоже ставим безопасный формат.
    import telebot
    if level <= logging.DEBUG:
        telebot.logger.setLevel(logging.DEBUG)
    for h in telebot.logger.handlers:
        h.setFormatter(formatter)
    if not telebot.logger.propagate:   # иначе его ошибки не попали бы в файл и на живые экраны
        for h in handlers[1:]:
            telebot.logger.addHandler(h)

    sys.excepthook = _safe_excepthook
    threading.excepthook = _safe_thread_excepthook
