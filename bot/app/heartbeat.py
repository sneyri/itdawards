import logging
import threading
import time

import requests

import config

log = logging.getLogger(__name__)
interval = 20
state = {"telegram_ok": True}


def _telegram_ok():
    try:
        response = requests.get(
            "https://api.telegram.org/bot" + config.BOT_TOKEN + "/getMe",
            timeout=(3, 6),
        )
        return response.status_code == 200 and response.json().get("ok") is True
    except Exception:
        return False


def _loop(started):
    while True:
        time.sleep(interval)
        telegram_ok = _telegram_ok()
        state["telegram_ok"] = telegram_ok
        try:
            response = requests.post(
                config.AWARDS_SITE_API_URL.rstrip("/") + "/api/bot/heartbeat",
                json={"uptimeSeconds": int(time.monotonic() - started), "telegramOk": telegram_ok},
                headers={"Authorization": "Bearer " + config.BOT_API_TOKEN},
                timeout=(2, 4),
            )
            if response.status_code != 200:
                log.warning("Heartbeat: HTTP %s", response.status_code)
        except requests.RequestException as error:
            log.warning("Heartbeat: %s", error)


def start():
    threading.Thread(target=_loop, args=(time.monotonic(),), daemon=True, name="heartbeat").start()
