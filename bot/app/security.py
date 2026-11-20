"""Ограничение частоты запросов в личном чате."""
import threading
import time
from collections import deque
import config

_lock = threading.Lock()
_recent = {}

def too_fast(user_id):
    now = time.monotonic()
    with _lock:
        for uid in [uid for uid, actions in _recent.items() if not actions or now - actions[-1] > config.RATE_LIMIT_WINDOW]:
            del _recent[uid]
        actions = _recent.setdefault(user_id, deque())
        while actions and now - actions[0] > config.RATE_LIMIT_WINDOW:
            actions.popleft()
        if len(actions) >= config.RATE_LIMIT_ACTIONS:
            return True
        actions.append(now)
        return False
