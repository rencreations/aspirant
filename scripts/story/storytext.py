"""Parse the novel (`story/main.md`) into chapters and blocks.

The paragraph numbering here is the contract with the visual scripts (`visuals/cNN.json`) and
with the site: paragraph numbers start at 0 after the dateline and count every paragraph of the
chapter in order. A paragraph is a non-empty block of lines that is not a heading, a
`<!-- voice -->` marker, a scene break (`* * *`) or the dateline (the first block after the
heading, when it is wholly italic).

    python scripts/story/storytext.py            # prints a summary
    python scripts/story/storytext.py c05        # prints the numbered paragraphs of one chapter
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_SOURCE = "D:/ren/aspirant/story/main.md"
VOICE = re.compile(r"^<!--\s*voice:\s*audio/([^/]+)/(.+?\.flac)\s*-->$")
SCENE_BREAK = re.compile(r"^\*\s\*\s\*$")
DATELINE = re.compile(r"^\*([^*].*[^*]|[^*])\*$")
HEADING = re.compile(r"^## (Prologue|Chapter (\d+): (.+))$")


@dataclass
class Voice:
    slug: str  # audio folder name, the same as the site slug (angela, change, fanny, ...)
    file: str  # the flac file name
    n: int  # line number in voice.md (the number the file name starts with)


@dataclass
class Para:
    i: int  # paragraph number inside the chapter
    text: str  # markdown inline text (italics as *...*)
    voice: Voice | None = None


@dataclass
class Block:
    kind: str  # "p" | "break"
    para: Para | None = None


@dataclass
class Chapter:
    id: str  # c00 .. c87
    number: int  # 0 for the prologue
    title: str
    dateline: str | None
    blocks: list[Block] = field(default_factory=list)

    @property
    def paragraphs(self) -> list[Para]:
        return [b.para for b in self.blocks if b.kind == "p" and b.para]

    @property
    def words(self) -> int:
        return sum(len(re.findall(r"[A-Za-z0-9']+", p.text)) for p in self.paragraphs)


@dataclass
class Book:
    chapters: list[Chapter]
    characters: list[str]  # paragraphs of the back matter "Characters"
    timeline: list[str]  # paragraphs of the back matter "Timeline"


def source_path() -> Path:
    return Path(os.environ.get("ASPIRANT_STORY", DEFAULT_SOURCE))


def chapter_id(number: int) -> str:
    return f"c{number:02d}"


def _groups(lines: list[str]) -> list[list[str]]:
    out: list[list[str]] = []
    cur: list[str] = []
    for line in lines:
        if line.strip() == "":
            if cur:
                out.append(cur)
                cur = []
        else:
            cur.append(line.rstrip())
    if cur:
        out.append(cur)
    return out


def parse(path: Path | None = None) -> Book:
    text = (path or source_path()).read_text(encoding="utf-8").replace("\r\n", "\n")
    sections: list[tuple[str, list[str]]] = []
    for line in text.split("\n"):
        if line.startswith("## "):
            sections.append((line, []))
        elif sections:
            sections[-1][1].append(line)
    chapters: list[Chapter] = []
    characters: list[str] = []
    timeline: list[str] = []
    for heading, body in sections:
        m = HEADING.match(heading)
        if m:
            number = 0 if m.group(1) == "Prologue" else int(m.group(2))
            title = "Prologue" if number == 0 else m.group(3).strip()
            ch = Chapter(id=chapter_id(number), number=number, title=title, dateline=None)
            first = True
            n = 0
            for group in _groups(body):
                voices = [VOICE.match(g) for g in group]
                marker = next((v for v in voices if v), None)
                rest = [g for g, v in zip(group, voices) if not v]
                if not rest:
                    continue
                joined = " ".join(r.strip() for r in rest)
                if len(rest) == 1 and SCENE_BREAK.match(rest[0].strip()):
                    ch.blocks.append(Block("break"))
                    first = False
                    continue
                if first and DATELINE.match(joined) and marker is None:
                    ch.dateline = joined[1:-1]
                    first = False
                    continue
                first = False
                voice = None
                if marker:
                    file = marker.group(2)
                    num = re.match(r"(\d+)_", file)
                    voice = Voice(slug=marker.group(1), file=file, n=int(num.group(1)) if num else 0)
                ch.blocks.append(Block("p", Para(i=n, text=joined, voice=voice)))
                n += 1
            chapters.append(ch)
        elif heading.strip() == "## Characters":
            characters = [" ".join(g) for g in _groups(body)]
        elif heading.strip() == "## Timeline":
            timeline = [" ".join(g) for g in _groups(body)]
    return Book(chapters=chapters, characters=characters, timeline=timeline)


def by_id(book: Book) -> dict[str, Chapter]:
    return {c.id: c for c in book.chapters}


def anchor_of(text: str, words: int = 5) -> str:
    """The first words of a paragraph, as an anchor in a visual script (markdown marks removed)."""
    plain = text.replace("*", "")
    return " ".join(plain.split()[:words])


def _main() -> None:
    book = parse()
    if len(sys.argv) > 1:
        ch = by_id(book)[sys.argv[1]]
        print(f"{ch.id} {ch.title}  [{ch.dateline}]  {len(ch.paragraphs)} paragraphs, {ch.words} words")
        for p in ch.paragraphs:
            tag = f"  [voice {p.voice.slug} #{p.voice.n}]" if p.voice else ""
            print(f"{p.i:>3}: {p.text}{tag}")
        return
    total = 0
    for ch in book.chapters:
        total += ch.words
        print(f"{ch.id}  {ch.title:<34} {len(ch.paragraphs):>3} paras {ch.words:>5} words  {ch.dateline or ''}")
    print(f"{len(book.chapters)} chapters, {total} words, {len(book.characters)} character rows, {len(book.timeline)} timeline rows")


if __name__ == "__main__":
    _main()
