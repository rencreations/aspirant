# Canon and content rules

Every contributor follows these. They come from the author's own `CANON-NOTES.md` and `CLAUDE.md` in the source folder, plus the owner's brief.

## Sources

- `story/short-v2.md` is the text of the web novel (first-time-reader order). `story/novel.md` wins if they differ, but we ship `short-v2.md`.
- `story/CANON-NOTES.md`, `story/characters.md`, `audio/<name>/voice.md` for character facts.
- If a source does not say it, write "Not specified" or leave it out. Do not invent lore.

## Hard rules

1. **Spellings:** Terrinia (not Terenia, Terinia), Selrick, Storm Citadel. The owner's brief said "Terrenia"; use **Terrinia**.
2. **"Aspirant power", never "conviction".** In voice line translations replace "conviction" with "aspirant power".
3. **No em-dashes** (U+2014) or en-dashes (U+2013) in any shipped text. Fix quoted text too: use a comma, colon, period, or a plain hyphen where it joins words. Number ranges use "to" or a hyphen.
4. **Open by design.** Never resolve these: the outcome of the Matrix invasion; where the Ender Control Core is now (or whether it can be broken); the outcome of the Selena and Obsidia duel; whether Selena's needle ever finds the Core.
5. **The live-action video is a non-canon parody** ("Seiresk Academy", SHABO, Mr Imran). Never use it as lore. If shown at all, badge it "Non-canon parody".
6. The universe is A5-01, separate from main MLBB. Only Tigreal appears from the main game, only as Fanny's elder brother.
7. Aspirant names: Layla = Miss Hikari; Fanny = Blade of Kibou; Ruby = Mecha Maiden; Angela = Cyber Cherubin; Lesley = Deadeye Spectre; Chang'e = Tech Tensai; Vexana = Twilight Star; Guinevere = Daybreak Halo; Selena = Silverbolt Raiko; Obsidia = Imperatrix Arashi.
8. Ages, birthdays, MBTI: from `CANON-NOTES.md` sections 5 and 5b. Ages are as at the Academy's first winter. Chang'e's age is not specified (range 6 to 14: show "Not specified").
9. Japanese names (section 7): Layla ライラ, Fanny ファニー, Ruby ルビー, Angela アンジェラ, Lesley ラズリー, Chang'e 嫦娥, Vexana サナ, Guinevere グィネヴィア, Obsidia アイーダ, Selena セリナ.
10. Selena has two forms (combat suit, Ender form). Obsidia's shadowy figure in the top of her splash art is not her Ender form. Her weapon is the winged creature at lower left.
11. Vexana's Ender-form hair is blue-lavender fading to magenta (as in the splash art).
12. Fan art: always show artist credit and link. The source URL is encoded in each file name.
13. Excluded from relationship sections: Roger and Professor Joe (comic side characters).
14. Voice line translations come from `voice.md` as given. Lesley's lines 36 and 37 are addressed to Chang'e, not "Joker".

## Voice and style (our own copy)

- Formal English, friendly and direct, short sentences. Speak to the visitor.
- No filler and no cliches. Examples to avoid: "dive into", "embark", "tapestry", "unleash", "a testament to", "in a world where".
- Do not describe the site's own features with hype. Say what the thing does.
- Headings are short. Labels are literal.

## Automated check

`scripts/qa/scan-text.mjs` scans `apps/web/out` (and `src`, `public/data`) and fails on U+2014, U+2013, "conviction", "Terenia", "Terinia", "Terrenia", "Seiresk", "Windstorm Nest". Run before every push.
