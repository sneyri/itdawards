import os
import re
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

BASE_DIR = Path(__file__).resolve().parent
# В автономной сборке config.py находится внутри единственного файла бота.
PROJECT_DIR = BASE_DIR.parent if Path(__file__).is_file() else BASE_DIR
PROJECT_ENV_FILE = PROJECT_DIR / ".env"
SALT_ENV_FILE = PROJECT_ENV_FILE
database_directory = BASE_DIR
running_tests = os.getenv("ITD_BOT_TEST") == "1"
if not running_tests:
    load_dotenv(PROJECT_ENV_FILE)
    legacy_env = os.getenv("BOT_ENV_FILE", "").strip()
    if legacy_env:
        bot_env_file = (PROJECT_DIR / Path(legacy_env).expanduser()).resolve()
        if not bot_env_file.is_file():
            raise SystemExit(f"BOT_ENV_FILE: файл не найден: {bot_env_file}")
        database_directory = bot_env_file.parent
    else:
        bot_env_file = BASE_DIR / ".env"
    if bot_env_file != PROJECT_ENV_FILE and bot_env_file.is_file():
        load_dotenv(bot_env_file)
        # Сохраняем автоматически созданную соль там, откуда она загрузится при следующем старте.
        if "VOTE_SALT" not in dotenv_values(PROJECT_ENV_FILE):
            SALT_ENV_FILE = bot_env_file

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()

# Вход на сайт через тот же бот и локальный API.
AWARDS_SITE_API_URL = os.getenv("AWARDS_SITE_API_URL", "").strip()
AWARDS_SITE_LOGIN_URL = os.getenv("AWARDS_SITE_LOGIN_URL", "").strip()
BOT_API_TOKEN = os.getenv("BOT_API_TOKEN", "").strip()
managed_default = "1" if AWARDS_SITE_API_URL and BOT_API_TOKEN else "0"
AWARDS_SITE_MANAGED = os.getenv("AWARDS_SITE_MANAGED", managed_default).strip() != "0"
AWARDS_SITE_CODE_PATTERN = re.compile(r"(?<![A-Z0-9])[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}(?![A-Z0-9])")


def _parse_admin_ids(raw):
    """«123, 456» -> {123, 456}. Мусор не превращается в админа молча — бот не запустится."""
    ids = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit():
            raise SystemExit(f"ADMIN_IDS: «{part}» — не Telegram ID (нужны только цифры)")
        ids.add(int(part))
    return ids


# Telegram ID админов через запятую: ADMIN_IDS=123456789,987654321
ADMIN_IDS = _parse_admin_ids(os.getenv("ADMIN_IDS", ""))


DB_PATH = database_directory / os.getenv("DB_PATH", "awards.db")
if running_tests:
    SALT_ENV_FILE = DB_PATH.parent / ".env"

# Сколько номинантов один человек может предложить в одну номинацию
MAX_SUGGESTIONS_PER_NOMINATION = int(os.getenv("MAX_SUGGESTIONS_PER_NOMINATION", "3"))
MAX_SUGGESTION_LENGTH = 100

# Идеи новых номинаций («Предложить свою номинацию»): сколько идей от одного человека и длина.
MAX_IDEAS_PER_USER = int(os.getenv("MAX_IDEAS_PER_USER", "2"))
MAX_IDEA_LENGTH = 150
MAX_NOMINEE_LENGTH = 60

# --- Защита ---
# Канал, на который нужно быть подписанным, чтобы пользоваться ботом.
# Публичный канал: @username. Приватный: числовой ID вида -1001234567890.
# Пустое значение отключает проверку. Бот должен быть АДМИНОМ этого канала.
REQUIRED_CHANNEL = os.getenv("REQUIRED_CHANNEL", "@itditp113").strip()
CHANNEL_URL = os.getenv("CHANNEL_URL", "https://t.me/itditp113?direct").strip()


# Не больше RATE_LIMIT_ACTIONS действий за RATE_LIMIT_WINDOW секунд от одного человека.
RATE_LIMIT_ACTIONS = int(os.getenv("RATE_LIMIT_ACTIONS", "12"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "10"))

# Сколько секунд человек должен быть знаком с ботом, прежде чем голосовать
# (мешает «одноразовым» аккаунтам из скрипта). 0 — отключить.
MIN_VOTER_AGE_SEC = int(os.getenv("MIN_VOTER_AGE_SEC", "300"))

# 1 — голосуют только те, кто пришёл в бот ДО начала голосования (сильная защита от
# ферм аккаунтов, созданных после анонса). 0 — голосовать может любой подписчик.
VOTERS_MUST_JOIN_BEFORE_VOTING = os.getenv("VOTERS_MUST_JOIN_BEFORE_VOTING", "0").strip() == "1"

# Секретная соль для анонимных хешей (VOTE_SALT) читается в database/settings.py.

# --- Консоль разработчика ---
# Уровень подробности логов: DEBUG / INFO / WARNING. DEBUG показывает и внутреннюю кухню telebot.
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()
# 1 — в консоли показывать ТЕКСТ входящих сообщений (по умолчанию только тип и длина: это тайна людей).
# Голоса (u:vote, u:pick) скрыты всегда, даже при 1.
DEBUG_SHOW_CONTENT = os.getenv("DEBUG_SHOW_CONTENT", "0").strip() == "1"

# --- Живые экраны (вместо ленты логов и кучи сообщений) ---
# Живая панель в терминале (нужен пакет rich; в файл/без терминала сама отключается). 0 — обычные логи.
LIVE_CONSOLE = os.getenv("LIVE_CONSOLE", "1").strip() != "0"
# Как часто обновлять закреплённое сообщение /status у админа, секунд (не меньше 5).
LIVE_STATUS_INTERVAL = max(5, int(os.getenv("LIVE_STATUS_INTERVAL", "20")))

EVENT_TITLE = "ИТД AWARDS 2026"

# Кому писать, если бот не работает (юзернейм без @). Показывается в меню, /help,
# сообщениях об ошибках и в описании бота.
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "SneyrIII").strip().lstrip("@")

# Номинации: (эмодзи, полное название, короткая подпись для кнопки, описание, пример ответа).
# Описание — одно предложение: что это за номинация. Пример — как выглядит хороший ответ
# (показывается людям: «Например: …»). Оба можно оставить пустыми "".
# Можно менять названия, эмодзи, описания и примеры — после перезапуска они обновятся в боте.
NOMINATIONS = [
    ("👑", "KING ИТД", "KING ИТД", "Самый яркий и достойный представитель мужской части ИТД.", "@username"),
    ("👸", "QUEEN ИТД", "QUEEN ИТД", "Самая яркая и запоминающаяся девушка ИТД.", "@username"),
    ("💞", "Шип года", "Шип года", "Самая красивая и обсуждаемая пара года.", "Иван и Мария"),
    ("🎨", "Художник года", "Художник года", "Человек, чьи творческие работы заслуживают особого внимания.", "@username"),
    ("😂", "Мем года", "Мем года", "Самый смешной и запоминающийся мем сообщества.", "название мема или ник автора"),
    ("📰", "Новостной паблик года", "Новостной паблик года", "Лучший источник новостей и событий ИТД.", "@название_канала"),
    ("🎮", "Стример года", "Стример года", "Автор самых интересных трансляций.", "@username"),
    ("🎭", "Косплей года", "Косплей года", "Человек с ярким перевоплощением в персонажа.", "@username"),
    ("🔥", "Завоз года", "Завоз года", "Самый яркий и неожиданный перформанс.", "что произошло"),
    ("✨", "Событие года", "Событие года", "Событие с наибольшим резонансом.", "название события"),
    ("🚀", "Проект года", "Проект года", "Самая интересная инициатива сообщества.", "название проекта"),
    ("🎵", "Трек года", "Трек года", "Песня, которая стала главным саундтреком года.", "название песни и исполнитель"),
    ("😇", "Добряк года", "Добряк года", "Человек, который чаще всего проявлял доброту и помогал другим.", "@username"),
    ("🎉", "Интерактив года", "Интерактив года", "Самое интересное и запоминающееся мероприятие или активность года.", "название мероприятия или активности"),
    ("🎙️", "Интервьюер года", "Интервьюер года", "Человек, который лучше всех проводил интервью и задавал интересные вопросы.", "@username"),
    ("📸", "Фотограф года", "Фотограф года", "Человек, чьи фотографии больше всего запомнились в этом году.", "@username"),
    ("📖", "Щитпостер года", "Щитпостер года", "Человек, который 24/7 делится своими мыслями и делает кучу постов.", "@username"),
]
