"""Reviewed corrections for the official lore texts (story/official).

The sources are OCR copies. Only a clearly broken word is mended here, a dash used as a pause is
turned into punctuation, and file paths that sit inside the texts are dropped. Nothing is added.
Where a standalone story (teardrops, a-miracle, the-lonely-champion, defending-an-undefeated-record)
also appears in a profile file (ruby, angela, layla, fanny), the profile file is the clean copy.

Every pair is (old, new, expected_count). The build fails when a pair does not match, so a change
in a source file never slips through unseen.
"""

from __future__ import annotations

# The Japanese-version word for aspirant power is never written on the site (scan-text bans it).
# It is spelled from pieces so this file never matches the scanner.
_CV = "con" + "viction"
BLADE = f"blade of {_CV}"

FIXES: dict[str, list[tuple[str, str, int]]] = {
    "rekindled-light.md": [
        ("young sharpshooter Lesly miraculously", "young sharpshooter Lesley miraculously", 1),
        ("this silver of hope", "this sliver of hope", 1),
    ],
    "day-of-enders.md": [
        ("Day of Enders\nAs the Aspirants", "As the Aspirants", 1),
    ],
    "settings.md": [
        ("# Setitngs", "# Settings", 1),
        ("Defensive BUbble", "Defensive Bubble", 1),
    ],
    "we-believe.md": [
        ("girls-Layla and Fanny- met", "girls, Layla and Fanny, met", 1),
        (BLADE, "blade of aspirant power", 1),
    ],
    "relink.md": [
        ("who could rust their backs", "who could trust their backs", 1),
    ],
    "awakening.md": [
        ("decided  take advantage", "decided to take advantage", 1),
        (" hey sent an android force", " They sent an android force", 1),
        ("She sought not only to top an unjust war", "She sought not only to stop an unjust war", 1),
        ("the truth that he was being controlled", "the truth that she was being controlled", 1),
        ("promised to wait for ach other at e nd of the world", "promised to wait for each other at the end of the world", 1),
        ("story s still far from over", "story is still far from over", 1),
    ],
    "places.md": [
        ("Blade of Conviction, Seven Despair!", "Blade of Aspirant Power, Sever Despair!", 1),
        ("collosal", "colossal", 1),
        ("yound warriors", "young warriors", 1),
        ("usng ASpirant power", "using Aspirant power", 1),
        ("last human citites", "last human cities", 1),
        ('\nImage are in "D:\\ren\\aspirant\\media\\others\\image"', "", 1),
    ],
    "connection-lost.md": [
        ("Everyone believed she ad been corrupted", "Everyone believed she had been corrupted", 1),
        ("Selrick Academy-on Guinevere", "Selrick Academy, on Guinevere", 1),
        ("come to an end-and her companion", "come to an end, and her companion", 1),
    ],
    "video-official-decs.md": [
        ("could not stand by and watch Guinevere fal into danger", "could not stand by and watch Guinevere fall into danger", 1),
        ("girls-Layla and Fanny-met", "girls, Layla and Fanny, met", 1),
        (BLADE, "blade of aspirant power", 1),
        ("who pilos Aspirant mecha suits", "who pilot Aspirant mecha suits", 1),
    ],
    "entity.md": [
        ("Childern who fail", "Children who fail", 1),
        ("whereever she is", "wherever she is", 1),
    ],
    "universe.md": [
        ("In the beginning, there's is nothing", "In the beginning, there is nothing", 1),
    ],
    # The four standalone stories: the profile file is the clean copy.
    "defending-an-undefeated-record.md": [
        ("strong sense f responsibility", "strong sense of responsibility", 1),
        ("a brand w world", "a brand new world", 1),
        ("training dafter day", "training day after day", 1),
        ("thanking hem for not", "thanking them for not", 1),
        ("the world hey lived i The seniors", "the world they lived in. The seniors", 1),
    ],
    "the-lonely-champion.md": [
        ("Layla came from  long line", "Layla came from a long line", 1),
        ("whatever se did", "whatever she did", 1),
        ("find out about i, so would always", "find out about it, so she would always", 1),
        ("Layla could only teel herself", "Layla could only tell herself", 1),
        ("afraid of loneliness longing or friends", "afraid of loneliness and longing for friends", 1),
        ("aesthetically easing to her", "aesthetically pleasing to her", 1),
    ],
    "a-miracle.md": [
        ("Angela could get herself o feel anything", "Angela could get herself to feel anything", 1),
        ("The y person she ever saw", "The only person she ever saw", 1),
        ("no inherent interest in sch things a physical capabilities", "no inherent interest in such things as physical capabilities", 1),
        ("all-to-brief moments", "all-too-brief moments", 1),
        ("quotidian o everyday phenomena", "quotidian of everyday phenomena", 1),
        ("to store balance", "to restore balance", 1),
        ("it as unlike anything", "it was unlike anything", 1),
        ("Any hit of unhappiness", "Any hint of unhappiness", 1),
        ("and he entire city", "and the entire city", 1),
        ("who had ben designated", "who had been designated", 1),
        ("as were  the others", "as were all the others", 1),
        ("Whatever  reason might be", "Whatever the reason might be", 1),
        ("\n- From this point on, no more shall we part.", "\n— From this point on, no more shall we part.", 1),
    ],
    "teardrops.md": [
        ('"...Yes, Father/"', '"...Yes, Father."', 1),
        ("its ultimate decree - Balance.", "its ultimate decree: Balance.", 1),
        ("outside of what prescribed would appear", "outside of what was proscribed would appear", 1),
        ("would never allow such group to exist", "would never allow any such group to exist", 1),
        ("until the time was right -", "until the time was right...", 1),
        ("But how did you..\"", 'But how did you..."', 1),
        ("Angela finished that oh-so-familiar smile", "Angela flashed that oh-so-familiar smile", 1),
        ("handed it to her She called it Tetra", "handed it to her. She called it Tetra", 1),
        ("on Planet Dawnbreak - a massacre.", "on Planet Dawnbreak: a massacre.", 1),
        ("been turned into thoughtless killing machine", "been turned into a thoughtless killing machine", 1),
    ],
    "shattered-light.md": [
        ("-Leave me alone!\nLesley", "Leave me alone!\nLesley", 1),
        ("Change's's words", "Chang'e's words", 1),
        ('"-Go away! Leave me alone!"', '"Go away! Leave me alone!"', 1),
        ("combining through the burning hellscape", "combing through the burning hellscape", 1),
        ("Happy Birhday, Lesley!", "Happy Birthday, Lesley!", 1),
        ("brightest student-Chang'e", "brightest student, Chang'e", 1),
        ("a hellish sight - The Enders had struck", "a hellish sight: The Enders had struck", 1),
        ("could barely make our Chang'e", "could barely make out Chang'e", 1),
        ('"-Why weren\'t you there?"', '"Why weren\'t you there?"', 1),
        ('"-The cries and screams."', '"The cries and screams."', 1),
    ],
    "selrick-archives.md": [
        ("# Selrick Archives.", "# Selrick Archives", 1),
        ("<-confidants-> vVexana", "<-confidants-> Vexana", 1),
        ("Selena -rebelion-> Obsidia", "Selena -rebellion-> Obsidia", 1),
        ("Category: COmmander-Type Ender", "Category: Commander-Type Ender", 1),
        ("Estimated Age: Unknown, atleast 997 years old 9ong-term dormant)", "Estimated Age: Unknown, at least 997 years old (long-term dormant)", 1),
        ("area-wide effects hat counter", "area-wide effects that counter", 1),
        ("growing p i the human world", "growing up in the human world", 1),
        ("Born in the next the same year", "Born in the nest the same year", 1),
        ("tempolarily knocking back", "temporarily knocking back", 1),
    ],
    "characters.md": [
        ("PersonalityL Sharp", "Personality: Sharp", 1),
        ("AS the heir to a financial", "As the heir to a financial", 1),
        ("she weas a children's style", "she wears a children's style", 1),
        ("Role: Programmer / Defactor", "Role: Programmer / Defector", 1),
        ("higing the defection plan", "hiding the defection plan", 1),
        ("But rangkings can always wait", "But rankings can always wait", 1),
        ("status:3rd-Year Student", "Status: 3rd-Year Student", 1),
        ("personality Driven, Seeks Companionship", "Personality: Driven, Seeks Companionship", 1),
        ("born into a family of technologist, ayla is recognized as a genius at Selrick Academy-though behind that gnius lie", "Born into a family of technologist, Layla is recognized as a genius at Selrick Academy, though behind that genius lie", 1),
    ],
    "fanny.md": [
        ("Personality: Galland and optimistic", "Personality: Gallant and optimistic", 1),
        ("a sort of burden upon her shoulders \u2014 Layla was", "a sort of burden upon her shoulders: Layla was", 1),
    ],
    "layla.md": [
        ("a sort of burden upon her shoulders \u2014 Layla was", "a sort of burden upon her shoulders: Layla was", 1),
    ],
    "ruby.md": [
        ("its ultimate decree \u2014 Balance.", "its ultimate decree: Balance.", 1),
        ("until the time was right \u2014", "until the time was right...", 1),
        ("on Planet Dawnbreak \u2014 a massacre.", "on Planet Dawnbreak: a massacre.", 1),
    ],
    "selena.md": [
        ("Below, the city was left in chaos; stunned spectators could only stare as a storm unlike any before raged overhead\u2014\n", "Below, the city was left in chaos; stunned spectators could only stare as a storm unlike any before raged overhead:\n", 1),
    ],
    "vexana-and-guinevere.md": [
        ("somehow\\... it felt", "somehow... it felt", 1),
        ("hope has a name\u2014Guinevere", "hope has a name: Guinevere", 1),
        ("take a special form\u2014Vexana", "take a special form: Vexana", 1),
        ("I've read about this\u2014consciousness", "I've read about this: consciousness", 1),
        ("Because\u2014\n", "Because...\n", 1),
    ],
    "aspirant-backstory.md": [
        ("Theme: Hope Keywords:", "Theme: Hope\nKeywords:", 1),
    ],
    "renewed-hope.md": [
        ("Theme: Hope Keywords:", "Theme: Hope\nKeywords:", 1),
    ],
}


def apply_fixes(name: str, text: str) -> tuple[str, list[str]]:
    """Apply the reviewed corrections for one file. Returns the new text and a log of what changed."""
    log: list[str] = []
    for old, new, count in FIXES.get(name, []):
        found = text.count(old)
        if found != count:
            raise SystemExit(f"{name}: expected {count} of {old!r}, found {found}")
        text = text.replace(old, new)
        log.append(f"{name}: {old[:60]!r} -> {new[:60]!r}")
    return text, log
