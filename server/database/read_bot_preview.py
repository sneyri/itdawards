import argparse
import ast
from collections import defaultdict
from contextlib import closing
import json
from pathlib import Path
import sqlite3


def descriptions(config_path):
    source = ast.parse(config_path.read_text(encoding="utf-8-sig"))
    for statement in source.body:
        if isinstance(statement, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "NOMINATIONS"
            for target in statement.targets
        ):
            return {
                entry[1]: entry[3] if len(entry) > 3 else ""
                for entry in ast.literal_eval(statement.value)
            }
    raise ValueError("NOMINATIONS was not found in config.py")


def snapshot(bot_dir):
    db_path = (bot_dir / "awards.db").resolve()
    details = descriptions(bot_dir / "config.py")
    by_nomination = defaultdict(dict)
    with closing(sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)) as db:
        db.execute("BEGIN")
        nominations = db.execute(
            "SELECT id, title, emoji, position FROM nominations ORDER BY position, id"
        ).fetchall()
        for nomination_id, raw_text, author_hash in db.execute(
            "SELECT nomination_id, text, author_hash FROM suggestions ORDER BY id"
        ):
            label = " ".join(raw_text.split())
            key = label.lstrip("@").casefold()
            if key:
                # The bot groups by normalized text, counts distinct authors, and breaks ties by first submission.
                _, authors = by_nomination[nomination_id].setdefault(key, (label, set()))
                authors.add(author_hash)

    for nomination_id, title, emoji, position in nominations:
        top = sorted(by_nomination[nomination_id].values(), key=lambda entry: -len(entry[1]))[:5]
        yield {
            "id": nomination_id,
            "title": title,
            "emoji": emoji,
            "position": position,
            "description": details.get(title, ""),
            "suggestions": [label for label, _ in top],
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bot_dir", type=Path)
    args = parser.parse_args()
    print(json.dumps(list(snapshot(args.bot_dir))))
