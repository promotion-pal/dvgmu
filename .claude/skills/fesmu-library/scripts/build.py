#!/usr/bin/env python3
"""Методички (.md) и издания каталога (.json) → миграция-сид библиотеки fesmu.

    build.py --name <slug> [--items items.json] manual1.md [manual2.md …]

Пишет apps/fesmu/api/migrations/library/<время>_library_<slug>_seed.sql.
Формат .md и .json — references/format.md. Содержимое методички хранится как
protojson entity.Manual{sections} (apps/fesmu/api/internal/modules/library/blocks.go).
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

TONES = {
    "info": "MANUAL_CALLOUT_TONE_INFO",
    "important": "MANUAL_CALLOUT_TONE_IMPORTANT",
    "warning": "MANUAL_CALLOUT_TONE_WARNING",
    "clinical": "MANUAL_CALLOUT_TONE_CLINICAL",
}
# Пределы api (service.go, blocks.go): сид не должен обходить то, что не пропустил бы редактор.
CARD_LIMITS = {"discipline": 255, "title": 512, "specialty": 255, "authors": 512, "annotation": 4096}
ITEM_LIMITS = {"title": 512, "authors": 512, "publisher": 255, "description": 8192, "discipline": 255}
MAX_SECTIONS, MAX_BLOCKS, MAX_CONTENT = 200, 3000, 4 << 20
SEED_BY = "seed"


def die(msg):
    sys.exit(f"build.py: {msg}")


def unescape(s):
    return s.replace("&#91;", "[").replace("\\[", "[").replace("\\]", "]").replace("\\~", "~").replace("\\*", "*")


def plain(s):
    """Ячейки таблиц, шаги чек-листов и вопросы задач показываются без разметки."""
    s = unescape(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*", r"\1", s)
    return s.strip()


def split_title(arg):
    """`callout important | Заголовок` → (["important"], "Заголовок")."""
    head, _, title = arg.partition("|")
    return head.split(), title.strip()


class Manual:
    def __init__(self, path, prefix):
        self.path, self.prefix = path, prefix
        self.n = 0
        self.sections = []
        self.cur = None
        self.meta = {}

    def bid(self):
        self.n += 1
        return f"{self.prefix}-{self.n:03d}"

    def where(self, line):
        return f"{self.path}:{line}"

    def add(self, kind, body):
        if self.cur is None:  # текст до первой темы — вступление
            self.cur = {"id": f"{self.prefix}-s00", "title": "Введение", "blocks": []}
            self.sections.append(self.cur)
        self.cur["blocks"].append({"id": self.bid(), kind: body})

    def last(self, kind):
        b = self.cur["blocks"][-1] if self.cur and self.cur["blocks"] else None
        return b[kind] if b and kind in b else None

    # ── вставки ```вид | заголовок ──────────────────────────────────────
    def fence(self, info, body, line):
        words, title = split_title(info)
        kind, args = words[0], words[1:]
        lines = [l.rstrip() for l in body]
        if kind == "callout":
            tone = args[0] if args else "info"
            if tone not in TONES:
                die(f"{self.where(line)}: тон выноски {tone!r}, допустимы {', '.join(TONES)}")
            self.add("callout", {"tone": TONES[tone], "title": title, "text": unescape("\n".join(lines)).strip()})
        elif kind == "checklist":
            ordered = not (args and args[0] == "unordered")
            steps = [plain(re.sub(r"^\s*(\d+[.)]|[-•])\s+", "", l)) for l in lines if l.strip()]
            if not steps:
                die(f"{self.where(line)}: пустой чек-лист")
            self.add("checklist", {"title": title, "ordered": ordered, "steps": steps})
        elif kind == "case":
            cond, questions, answer, in_answer = [], [], [], False
            for l in lines:
                if in_answer:
                    answer.append(l)
                elif l.strip() in ("Ответ:", "Эталон:", "Эталон ответа:"):
                    in_answer = True
                elif l.startswith("? "):
                    questions.append(plain(l[2:]))
                else:
                    cond.append(l)
            if not answer:
                die(f"{self.where(line)}: у задачи нет строки «Ответ:» и эталона после неё")
            self.add("clinicalCase", {"title": title, "condition": unescape("\n".join(cond)).strip(),
                                      "questions": questions, "answer": unescape("\n".join(answer)).strip()})
        elif kind == "quiz":
            qs = []
            for l in lines:
                if not l.strip():
                    continue
                tag, text = l[:2], plain(l[2:])
                if tag == "? ":
                    qs.append({"text": text, "options": [], "correct": [], "explanation": ""})
                elif not qs:
                    die(f"{self.where(line)}: строка теста до первого вопроса «? …»")
                elif tag in ("+ ", "- "):
                    if tag == "+ ":
                        qs[-1]["correct"].append(len(qs[-1]["options"]))
                    qs[-1]["options"].append(text)
                elif tag == "> ":
                    qs[-1]["explanation"] = (qs[-1]["explanation"] + " " + text).strip()
                else:
                    die(f"{self.where(line)}: строка теста должна начинаться с «? », «+ », «- » или «> »: {l!r}")
            for q in qs:
                if len(q["options"]) < 2 or not q["correct"]:
                    die(f"{self.where(line)}: вопросу «{q['text']}» нужны хотя бы два варианта и верный («+ »)")
            self.add("quiz", {"title": title, "questions": qs})
        elif kind == "glossary":
            terms = []
            for l in lines:
                if not l.strip():
                    continue
                term, sep, definition = l.partition(" — ")
                if not sep:
                    die(f"{self.where(line)}: строка словаря «Термин — определение»: {l!r}")
                terms.append({"term": plain(term), "definition": plain(definition)})
            self.add("glossary", {"terms": terms})
        elif kind == "video":
            url = args[0] if args else ""
            if not re.match(r"^https?://", url):
                die(f"{self.where(line)}: ссылка на видео должна начинаться с http:// или https://")
            self.add("video", {"url": url, "caption": title})
        else:
            die(f"{self.where(line)}: неизвестная вставка ```{kind} (есть callout, checklist, case, quiz, glossary, video)")

    # ── обычный Markdown ────────────────────────────────────────────────
    def parse(self, text):
        lines = text.splitlines()
        i = 0
        if lines and lines[0].strip() == "---":
            end = next((k for k in range(1, len(lines)) if lines[k].strip() == "---"), None)
            if end is None:
                die(f"{self.path}: не закрыт блок свойств (---)")
            for l in lines[1:end]:
                if l.strip():
                    k, _, v = l.partition(":")
                    self.meta[k.strip()] = v.strip()
            i = end + 1
        para = []

        def flush():
            if para:
                t = unescape("\n".join(para)).strip()
                if t:
                    self.add("text", {"text": t})
                para.clear()

        while i < len(lines):
            line = lines[i]
            if line.startswith("```"):
                flush()
                info, start, body = line[3:].strip(), i + 1, []
                i += 1
                while i < len(lines) and not lines[i].startswith("```"):
                    body.append(lines[i])
                    i += 1
                if i == len(lines):
                    die(f"{self.where(start)}: не закрыта вставка ```")
                self.fence(info, body, start)
                i += 1
                continue
            m = re.match(r"^(#{1,5})\s+(.*)$", line)
            if m:
                flush()
                level, title = len(m.group(1)), unescape(m.group(2)).strip()
                if level == 1:
                    self.meta.setdefault("title", title)
                elif level == 2:
                    self.cur = {"id": f"{self.prefix}-s{len(self.sections) + 1:02d}", "title": title, "blocks": []}
                    self.sections.append(self.cur)
                else:
                    self.add("heading", {"text": title, "level": level - 1})
                i += 1
                continue
            if line.strip() == "---":
                flush()
                self.add("divider", {})
                i += 1
                continue
            if line.startswith("|"):
                flush()
                rows = []
                while i < len(lines) and lines[i].startswith("|"):
                    cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                    if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                        rows.append([plain(c) for c in cells])
                    i += 1
                caption = ""
                lead = self.last("text")
                if lead and "\n" not in lead["text"] and len(lead["text"]) < 300 and lead["text"].endswith(":"):
                    caption = plain(lead["text"]).rstrip(":")
                    self.cur["blocks"].pop()
                self.add("table", {"caption": caption, "header": True, "rows": [{"cells": r} for r in rows]})
                continue
            if re.match(r"^\d+[.)]\s", line):
                flush()
                steps = []
                while i < len(lines) and re.match(r"^\d+[.)]\s", lines[i]):
                    steps.append(re.sub(r"^\d+[.)]\s+", "", lines[i]))
                    i += 1
                # Алгоритм — нумерованный список сразу после строки «**Название:**».
                lead = self.last("text")
                lt = lead["text"] if lead else ""
                if lt.startswith("**") and "\n" not in lt and len(lt) < 200 and (lt.endswith(":") or lt.endswith("**")):
                    self.cur["blocks"].pop()
                    self.add("checklist", {"title": plain(lt).rstrip(":"), "ordered": True, "steps": [plain(s) for s in steps]})
                else:
                    self.add("text", {"text": unescape("\n".join(f"{n}. {s}" for n, s in enumerate(steps, 1)))})
                continue
            if not line.strip():
                flush()
                i += 1
                continue
            para.append(line)
            i += 1
        flush()
        self.validate()
        return self

    def validate(self):
        m = self.meta
        for k in ("title", "discipline"):
            if not m.get(k):
                die(f"{self.path}: в свойствах нет «{k}»")
        for k, lim in CARD_LIMITS.items():
            if len(m.get(k, "")) > lim:
                die(f"{self.path}: «{k}» длиннее {lim} символов")
        for k in ("course", "semester"):
            m[k] = int(m.get(k) or 0)
        if not self.sections:
            die(f"{self.path}: нет ни одной темы (## …)")
        if len(self.sections) > MAX_SECTIONS:
            die(f"{self.path}: тем {len(self.sections)}, не больше {MAX_SECTIONS}")
        blocks = sum(len(s["blocks"]) for s in self.sections)
        if blocks > MAX_BLOCKS:
            die(f"{self.path}: блоков {blocks}, не больше {MAX_BLOCKS}")
        if len(self.content().encode()) > MAX_CONTENT:
            die(f"{self.path}: содержимое больше 4 МБ")

    def content(self):
        return json.dumps({"sections": self.sections}, ensure_ascii=False, separators=(",", ":"))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def manual_sql(m):
    js = m.content()
    if "$json$" in js:
        die(f"{m.path}: в тексте встречается $json$")
    c = m.meta
    return f"""-- +goose StatementBegin
INSERT INTO "library_manuals" ("discipline", "title", "specialty", "course", "semester", "authors", "annotation", "status", "draft", "published", "draft_changed", "updated_by", "created_at", "updated_at", "published_at")
SELECT {q(c['discipline'])}, {q(c['title'])}, {q(c.get('specialty', ''))}, {c['course']}, {c['semester']}, {q(c.get('authors', ''))}, {q(c.get('annotation', ''))}, 2, j, j, false, {q(SEED_BY)}, now(), now(), now()
FROM (SELECT $json${js}$json$::jsonb AS j) v
WHERE NOT EXISTS (SELECT 1 FROM "library_manuals" WHERE "discipline" = {q(c['discipline'])} AND "title" = {q(c['title'])});
-- +goose StatementEnd
"""


def load_items(path):
    items = json.load(open(path, encoding="utf-8"))
    if not isinstance(items, list):
        die(f"{path}: нужен массив изданий")
    for n, it in enumerate(items, 1):
        if not it.get("title"):
            die(f"{path}: у издания {n} нет title")
        if not re.match(r"^https?://", it.get("url", "")):
            die(f"{path}: «{it['title']}» — сид добавляет только ссылки, url с http:// или https://; файлы загружают через раздел «Библиотека»")
        for k, lim in ITEM_LIMITS.items():
            if len(str(it.get(k, ""))) > lim:
                die(f"{path}: «{it['title']}» — {k} длиннее {lim} символов")
        y = int(it.get("year") or 0)
        if y and not 1800 <= y <= 2100:
            die(f"{path}: «{it['title']}» — год издания четыре цифры")
        it["year"] = y
    return items


def items_sql(items):
    rows = ",\n".join(
        f"  ({q(it['title'])}, {q(it.get('authors', ''))}, {it['year']}, {q(it.get('publisher', ''))}, "
        f"{q(it.get('description', ''))}, {q(it.get('discipline', ''))}, {q(it['url'])})"
        for it in items
    )
    return f"""INSERT INTO "library_items" ("kind", "title", "authors", "year", "publisher", "description", "discipline", "url", "created_by", "created_at", "updated_at")
SELECT 2, v.title, v.authors, v.year, v.publisher, v.description, v.discipline, v.url, {q(SEED_BY)}, now(), now()
FROM (VALUES
{rows}
) AS v(title, authors, year, publisher, description, discipline, url)
WHERE NOT EXISTS (SELECT 1 FROM "library_items" i WHERE i."title" = v.title AND i."url" = v.url);
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="латиница через _, попадёт в имя файла миграции")
    ap.add_argument("--items", help="издания каталога (ссылки), JSON")
    ap.add_argument("--comment", default="", help="что сеет миграция — первая строка комментария")
    ap.add_argument("--out", help="путь миграции (по умолчанию migrations/library/<время>_library_<name>_seed.sql)")
    ap.add_argument("manuals", nargs="*")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9_]+", a.name):
        die("--name: только латиница, цифры и _")
    if not a.manuals and not a.items:
        die("нечего сеять: дайте файлы методичек и/или --items")

    manuals = [Manual(p, f"{a.name[:12]}{n}").parse(open(p, encoding="utf-8").read()) for n, p in enumerate(a.manuals, 1)]
    keys = [(m.meta["discipline"], m.meta["title"]) for m in manuals]
    if len(set(keys)) != len(keys):
        die("две методички с одинаковыми дисциплиной и названием")
    items = load_items(a.items) if a.items else []

    root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or os.getcwd()
    out = a.out or os.path.join(root, "apps/fesmu/api/migrations/library",
                                f"{datetime.datetime.now():%Y%m%d%H%M%S}_library_{a.name}_seed.sql")

    head = ["-- +goose Up", f"-- Seed: {a.comment}" if a.comment else "-- Seed: library content."]
    if manuals:
        head.append("-- Manuals (published; content is protojson of entity.Manual{sections}, draft = published):")
        head += [f"--   {m.meta['discipline']} — {m.meta['title']}" for m in manuals]
    if items:
        head.append(f"-- Catalog links: {len(items)}.")
    head.append("-- Rows already in the tables (same discipline and title / title and url) are left as they are.")
    body = "\n".join(head) + "\n" + "".join(manual_sql(m) for m in manuals) + (items_sql(items) if items else "")

    down = ["", "-- +goose Down"]
    for d, t in keys:
        down.append(f'DELETE FROM "library_manuals" WHERE "updated_by" = {q(SEED_BY)} AND "discipline" = {q(d)} AND "title" = {q(t)};')
    for it in items:
        down.append(f'DELETE FROM "library_items" WHERE "created_by" = {q(SEED_BY)} AND "title" = {q(it["title"])} AND "url" = {q(it["url"])};')
    with open(out, "w", encoding="utf-8") as f:
        f.write(body + "\n".join(down) + "\n")

    for m in manuals:
        print(f"методичка: {m.meta['title']} — тем {len(m.sections)}, блоков {sum(len(s['blocks']) for s in m.sections)}")
    if items:
        print(f"изданий-ссылок: {len(items)}")
    print(out)


if __name__ == "__main__":
    main()
