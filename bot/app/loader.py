"""Создание Telegram-бота с защитой исходящих запросов."""
import telebot
import config
from app import guard

if not config.BOT_TOKEN:
    raise SystemExit("Не задан BOT_TOKEN в файле .env")
guard.install()
bot = telebot.TeleBot(config.BOT_TOKEN, parse_mode="HTML")
