# Story landing, interactive drama and the lore codex (design and plan)

Date: 11 Nov 2026. The request is in `2026-11-11-story-lore-request.md` (word for word). This file is the plan and the data contract. Rules that always apply: `CLAUDE.md`; transform and opacity only for anything that moves; WAAPI preferred; one version, no lite mode; no file or commit names an assistant or a tool; commits by named paths (`git commit -- <paths>`), conventional subject.

## 1. The work, in order

| #   | Piece                                                                                                                                  | Where                                                             | Notes                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Landing edits: the brief keeps its first paragraph and loses the facts; a special Continue card; the four portrait crops               | `features/story/landing/`                                         | `FACES` in `reader/portraits.ts`                                                  |
| 2   | The infinite page: no footer, no scroll bar; the white page leaves at the end, the hero returns, the page wraps                        | `features/story/landing/`                                         | one fixed hero (the same element at the top and at the end), a mirror of the rise |
| 3   | The interactive drama becomes `/story/interactive-drama/`; it is removed from Vexana's and Guinevere's pages and never mentioned there | `features/character/vexana/drama/` moves                          | preloads, nav tone, tests                                                         |
| 4   | Landing sections: the drama (special), the two canon comics with their dubbed film, the lore codex teaser                              | `features/story/landing/`                                         | after 3 and 5                                                                     |
| 5   | The lore codex: every person, creature, thing, place, group, idea and event of the story, with relationships and weapons               | data: `scripts/library/lore/codex/`; UI: `features/library/lore/` | a fourth view of the lore room                                                    |
| 6   | Popups with their own addresses: `/collection/lore/<slug>/`                                                                            | `app/collection/lore/`                                            | opens over the room, the address changes without a page change                    |
| 7   | Tooltips in the chapters: a quiet highlight on a few chosen words that explain themselves, with a button to the codex                  | `features/story/reader/`                                          | text never changes                                                                |

## 2. The codex entry (the data contract)

One JSON object per entry (`scripts/library/lore/codex/entries/<slug>.json`). Slugs are lowercase kebab-case, unique across kinds. The text of every field is plain English in the book's voice (short sentences), no dashes of any kind, US spelling, `aspirant power` never the banned word, `Terrinia`, `Selrick`, `Storm Citadel`. Nothing may be invented: every statement comes from the novel (`story/main.md` of the novel repo, with chapter and paragraph numbers as `scripts/story/storytext.py` prints them) or from the official texts. What a character only claims (Obsidia's account of the Will, the balance, the previous civilization) is written as her claim ("Obsidia says...").

```jsonc
{
  "slug": "storm-citadel",
  "kind": "person | creature | thing | place | group | idea | event",
  "sub": "free text, shown as the small label: android, family, weapon, school room, ender rank, ...",
  "name": "Storm Citadel",
  "aka": ["the Citadel"], // other names used in the book
  "line": "One line for lists (at most 90 characters).",
  "short": "The tooltip text, at most 150 characters, plain, no spoiler beyond the chapter it is shown in.",
  "summary": "Two to four sentences: what it is, in the order a new reader needs.",
  "details": [
    // everything the story says, in sections
    { "h": "What it is", "p": ["paragraph", "paragraph"] },
    { "h": "How it moves", "p": ["..."] },
  ],
  "facts": [
    ["Where", "Terrinia"],
    ["First seen", "Prologue"],
  ], // short label and value rows
  "weapons": [{ "name": "Cannon", "note": "She built it herself." }], // persons only, may be empty
  "relations": [
    // from this entry to another (the diagram is built from these)
    {
      "to": "obsidia",
      "type": "serves",
      "label": "Her ship",
      "note": "One or two sentences, from the book.",
    },
  ],
  "appears": [{ "n": 0, "p": [3], "note": "Seen as a black cloud over the bay." }], // chapters (0 = prologue) and paragraph numbers
  "first": 0, // the first chapter that shows or names it
  "reveal": 54, // the chapter from which the whole entry is safe to read (a reader who has not reached it sees a spoiler gate); null when it holds no spoiler
  "media": [{ "src": "_others/places/storm-citadel.png", "alt": "...", "credit": "Official art" }], // official files under D:\ren\aspirant\media, only ones that exist; may be empty
  "official": ["story/official/places.md"], // official files that say the same, may be empty
  "mark": {
    "n": 15,
    "p": 22,
    "phrase": "the Storm Citadel",
    "why": "Professor Joe explains it here.",
  }, // where a reader first needs it in the chapters (see 4), may be null
}
```

Relation types (a closed list so the diagram can colour them): `family`, `partner`, `friend`, `rival`, `teacher`, `student`, `ally`, `enemy`, `maker`, `creation`, `guardian`, `ward`, `leader`, `serves`, `member`, `owns`, `lives`, `found`, `part`. A relationship is stored on both entries (A to B and B to A with the mirrored label); the pair page is `<a>--<b>` with the two slugs sorted.

The ten Aspirants are entries too (`kind: person`, `sub: aspirant`), with `character: "<slug>"` pointing at their page `/character/<slug>`; the lore room shows them with a button to it.

## 3. Pipeline

1. **Candidates (one pass per part of the book):** every person, creature, thing, place, group, idea and event of their chapters, with the chapters and paragraphs, a few sentences of what the book says, where a reader first needs it explained. Output `scripts/library/lore/codex/candidates/<part>.json`.
2. **Registry (one pass):** merges the candidates, fixes the slugs and kinds, decides the entries (every named or explained thing; a minor extra only when the book explains it), assigns each entry to a writer. Output `registry.json`.
3. **Entries (one writer per kind):** write the entries to the contract, reading the whole book for their entries (grep `story/main.md`), the official texts (`story/official/`, the collection's lore texts) and the media folders for official pictures.
4. **Relationships (one writer per Aspirant pair):** the relations of every Aspirant and the important people around each, and a page per pair (`rel-*`): how they met, the turns, the chapters.
5. **Build and validate (`scripts/library/lore/codex/build.py`):** checks the contract (slugs, kinds, relation targets and mirrors, files exist, no dashes, lengths, chapters in range, paragraph numbers in range) and writes `apps/web/public/data/library/lore-codex.json`.
6. **UI:** the Codex view of the lore room, the popups and their addresses, the relationship diagram, search, the spoiler gate.
7. **Marks:** from the `mark` fields and a read of every chapter, `apps/web/public/data/story/marks.json` and the highlight in the reader.

## 4. Marks in the chapters (item 7)

A mark is a phrase of one paragraph that opens a tooltip (the entry's `short`) with a button to the entry. They are rare: at most about three in a chapter and most chapters none; never the same entry twice within five chapters; never a character the reader already knows (the ten, Joe, Karina after the first time); each is placed where the book first needs it or a reader would need a reminder (the Storm Citadel where Professor Joe explains it). The highlight is a thin dotted underline in the accent colour with a small mark, no motion except a one-time soft pulse when it first scrolls into view; a mark seen by the reader (hovered or opened) stops pulsing and is remembered (`aspirants:marks`, with the reader's save version).

## 5. What the landing becomes (items 1 to 4)

Order of the landing after the change: the hero (held), the white page rising over it with: About the story (the first paragraph only, no facts), Choose a chapter (a Continue card that cannot be missed), the interactive drama section, the two canon comics, the lore codex section, Meet the ten; then the white page leaves and the same hero is there again, and the page wraps to the top. The footer that led to the characters is gone. The scroll bar is hidden on this page.

The loop: the hero is one fixed layer behind the page (`position: fixed`); the page is a transparent spacer of one screen, the white page, and another spacer of one screen. At the top the white page rises over the hero (as now); at the end it leaves the same way in reverse (it narrows about its bottom edge, its bottom corners round) and the hero is revealed as it was at the top. When the scroll reaches the end it is put back to the top with no animation, and the same view is on screen, so the wrap cannot be seen. A stop inside the leave snaps after one second, as the rise does.

## 6. Open points for the owner

Recorded as they come up in `docs/HANDOFF.md`.
