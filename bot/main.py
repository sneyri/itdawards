"""Бот выдаёт одноразовый код входа на сайт."""
import logging
from app import logging_setup
logging_setup.configure()
from telebot import types
from app import guard, heartbeat
from modules.auth import handlers, site_api
from app.loader import bot

def main():
    if not guard.is_installed():
        raise SystemExit("Защита Telegram API не установлена")
    if not site_api.configured():
        raise SystemExit("Задайте локальный AWARDS_SITE_API_URL и BOT_API_TOKEN")
    handlers.register()
    heartbeat.start()
    try:
        bot.set_my_commands([
            types.BotCommand("start", "Получить код входа"),
            types.BotCommand("login", "Получить код входа"),
            types.BotCommand("newcode", "Получить новый код"),
        ])
    except Exception as error:
        logging.getLogger(__name__).warning("set_mycommands: %s", error)
    bot.infinity_polling(skip_pending=False, timeout=30, long_polling_timeout=30)

if __name__ == "__main__":
    main()
