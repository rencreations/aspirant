"""Hand written facts about the promotional posts of the Design room.

The pipeline reads the pictures and the English captions from the source library. What a machine
cannot know is written here: a short title for each post, the campaign it belongs to, the
Aspirants it shows, and the few posts that are community work shown by an official account.

Every title is written from the caption: the campaign or the event, never a hashtag.
"""

from __future__ import annotations

FANNY, LAYLA, RUBY, ANGELA = "fanny", "layla", "ruby", "angela"
LESLEY, CHANGE, GUINEVERE, VEXANA, OBSIDIA, SELENA = "lesley", "change", "guinevere", "vexana", "obsidia", "selena"

FIRST_FOUR = [FANNY, LAYLA, RUBY, ANGELA]
TEN = [FANNY, LAYLA, RUBY, ANGELA, LESLEY, CHANGE, GUINEVERE, VEXANA, OBSIDIA, SELENA]

# This post lives in the Fanart room (an MGL creator's fan art), not here.
EXCLUDED = {"C4aPqrho3sW": "Fanart room: MGL creator fan art posted by @mobilelegendsgame"}

# Reels that are videos, not designs (the owner, 13 Nov 2026). They are built as before, but they are
# written to moved-reels.json instead of design.json. `films/reuse.py` reads that file, so they stay in
# Video, Others with the same record and the same keys (design/design-<code>/v.mp4, already in the
# bucket). Dd0tPihiEpW is also in Fanart (arts_rooms/curation/promo-fanart.json).
TO_VIDEO = {
    "DdyIX9wEk_7",  # Pick your girl
    "Dd0tPihiEpW",  # What is Selena up to in class?
    "Dd6LYQYDdbi",  # Obsidia against Selena
    "Delakn4Cb9E",  # Feel the power of the Aspirants
    "DetJAmclG5M",  # Who saw that ending coming?
    "De6qFyvt0uP",  # Maybe we could be...
}

# Campaigns, listed in the order they began. `line` is one plain sentence. Every post below
# names its campaign by id. `from` and `to` are worked out from the posts.
CAMPAIGNS: list[dict] = [
    {
        "id": "layla-fanny-arrive",
        "title": "Layla and Fanny arrive",
        "line": 'The first anime skins in MLBB: the voice cast, the trailer, the countdown and release day.',
    },
    {
        "id": "themed-events-2022",
        "title": "The themed events of January 2022",
        "line": "Browser events and supply draws that ran beside the first skin launch.",
    },
    {
        "id": "recreation-contest",
        "title": "The re-creation contest",
        "line": "A contest that asked players to re-create the skins, from the call to the winners.",
    },
    {
        "id": "unite-layla-fanny",
        "title": "Aspirants Unite: Layla and Fanny",
        "line": 'The draw event for Layla "Miss Hikari" and Fanny "Blade of Kibou", with free Passes.',
    },
    {
        "id": "layla-fanny-return-2022",
        "title": "Layla and Fanny return",
        "line": "The first two skins come back for a limited time, with polls and a last chance.",
    },
    {
        "id": "ruby-angela-arrive",
        "title": "Ruby and Angela arrive",
        "line": 'Ruby "Mecha Maiden" and Angela "Cyber Cherubin" join the series, with the first hero guides.',
    },
    {
        "id": "unite-ruby-angela",
        "title": "Aspirants Unite: Ruby and Angela",
        "line": "The draw event for Ruby and Angela, from free Passes to the last days.",
    },
    {
        "id": "ruby-angela-return-2023",
        "title": "Ruby and Angela return",
        "line": "Ruby and Angela come back for a limited time at the end of 2023.",
    },
    {
        "id": "lesley-change-arrive",
        "title": "Lesley and Chang'e arrive",
        "line": 'Lesley "Deadeye Spectre" and Chang\'e "Tech Tensai", the first Aspirants, with their backstory.',
    },
    {
        "id": "first-four-return-2024",
        "title": "The first four return",
        "line": "Layla, Fanny, Ruby and Angela return in summer 2024, and Moonton's anniversary gives free draw tokens.",
    },
    {
        "id": "lesley-change-return-2025",
        "title": "Lesley and Chang'e return",
        "line": "Lesley and Chang'e return for a limited time in the middle of 2025.",
    },
    {
        "id": "vexana-guinevere-arrive",
        "title": "Vexana and Guinevere arrive",
        "line": 'Vexana "Twilight Star" and Guinevere "Daybreak Halo" join the series, darkness against light.',
    },
    {
        "id": "unite-vexana-guinevere",
        "title": "Aspirants Unite: Vexana and Guinevere",
        "line": "The draw event for Vexana and Guinevere, and a match show on MPL Malaysia.",
    },
    {
        "id": "mlabel",
        "title": "TheMLabel gallery",
        "line": "A gallery for signature skin series. The Aspirants are the first series in it.",
    },
    {
        "id": "ruby-angela-return-2026",
        "title": "Ruby and Angela return again",
        "line": "Ruby and Angela return again for a limited time, with free Passes and a last chance.",
    },
    {
        "id": "enders-arrive",
        "title": "The Enders arrive",
        "line": "Selena and Obsidia enter the series: the announcement, the character bios and short clips.",
    },
    {
        "id": "unite-selena-obsidia",
        "title": "Aspirants Unite: Selena and Obsidia",
        "line": "The draw event for Obsidia and Selena, with free Tokens and match clips.",
    },
    {
        "id": "relationship-hub",
        "title": "The Skin Relationship Hub",
        "line": "A hub where fans connect all ten characters and define their own relationships.",
    },
]

# code -> (title, campaign id, tags, extras). Extras may hold: chars, canon, by, note.
P = dict[str, object]

META: dict[str, tuple[str, str, list[str], P]] = {
    # ---- Layla and Fanny arrive -----------------------------------------------------------
    "CYisWWHF-ER": ("The voice cast is announced", "layla-fanny-arrive", ["reveal", "skin", "voice"], {}),
    "CYjOsKIlkkv": ("Face to face with Fanny and Layla", "layla-fanny-arrive", ["poll", "community"], {}),
    "CYloDQelwQA": ("If MLBB were an anime", "layla-fanny-arrive", ["poll", "community"], {}),
    "CYtK73goIsC": ("New patch preview", "layla-fanny-arrive", ["event", "skin"], {}),
    "CY1EvyxlPAH": ("Layla and Fanny: friends or foes?", "layla-fanny-arrive", ["poll", "community"], {}),
    "CY534JgoUCG": ("Launch offers, coming soon", "layla-fanny-arrive", ["draw", "guide", "skin"], {}),
    "CY9M9RoI_ML": ("A livestream with a mystery guest", "layla-fanny-arrive", ["livestream", "event"], {}),
    "CY_7c--FyG2": ("The cinematic trailer and the mystery code", "layla-fanny-arrive", ["trailer", "event"],
                    {"chars": [FANNY, LAYLA]}),
    "CZBl2SIl54I": ("The first anime skins are available", "layla-fanny-arrive", ["launch", "draw", "skin"], {}),
    "CZG_n5qFRYd": ("A quick guide for Layla and Fanny", "layla-fanny-arrive", ["guide", "community"],
                    {"canon": "fan", "by": "@sire.plays (MGL Designer)",
                     "note": "Designed by @sire.plays. Guides written by Tatsumi (Layla) and @iTzuey (Fanny)."}),
    "CZRDyqnL1af": ("The comic begins", "layla-fanny-arrive", ["story", "comic"], {}),
    "CZUXhSLrFg9": ("Layla and Fanny: easy to win or lose?", "layla-fanny-arrive", ["poll", "community"], {}),
    # ---- The themed events of January 2022 ------------------------------------------------
    "CYn15izlDz1": ("Event guide: The Aspirants themed events", "themed-events-2022", ["event", "guide"], {}),
    "CYyJFc6PsqM": ("Combat Drill: pick Layla's or Fanny's team", "themed-events-2022", ["event"], {}),
    "CY31ArZLK39": ("Academy Supplies", "themed-events-2022", ["event", "draw"], {}),
    "CY8zOEPL2o1": ("Free permanent skin, last days", "themed-events-2022", ["event"], {}),
    # ---- The re-creation contest ----------------------------------------------------------
    "CYvI4PupARM": ("Re-creation contest: the rewards", "recreation-contest", ["contest", "community"], {}),
    "CY371zcLhWI": ("Re-creation contest and a gift code", "recreation-contest", ["contest"], {}),
    "CZRlUbxLbqQ": ("Re-creation works wanted", "recreation-contest", ["contest", "community"],
                    {"note": "The picture shows entries by community creators, named in the picture."}),
    "CZwJ5xTLf7o": ("The contest ends in one week", "recreation-contest", ["contest"], {}),
    "CaMQ-A7LtE9": ("Fanart contest winners", "recreation-contest", ["contest", "community"],
                    {"note": "The slides name the winning artists."}),
    # ---- Aspirants Unite: Layla and Fanny -------------------------------------------------
    "CZTnYvjLq7l": ("Free Pass, January 29", "unite-layla-fanny", ["tokens", "draw"], {}),
    "CZbxRnyLVGk": ("The Aspirants Unite draw is still on", "unite-layla-fanny", ["draw"], {}),
    "CaKAr9yLjkY": ("Pre-registration Pass, February 19", "unite-layla-fanny", ["tokens", "draw"], {}),
    "CaMeruKrjK0": ("Last chance for the first skins", "unite-layla-fanny", ["draw"], {}),
    # ---- Layla and Fanny return -----------------------------------------------------------
    "Ci5Gaz_rgOX": ("The skins return: encore offers", "layla-fanny-return-2022", ["return", "draw"], {}),
    "Ci7WnzBLU_R": ("Who would you choose as a companion?", "layla-fanny-return-2022", ["poll", "community"], {}),
    "CjH5-aKJDhc": ("Layla against Fanny: who wins?", "layla-fanny-return-2022", ["poll", "community"],
                    {"canon": "fan", "by": "@sire.plays (MGL Designer)"}),
    "CkAjbcjL-XG": ("The Recall Effect, last chance", "layla-fanny-return-2022", ["return", "event"], {}),
    "CkAqU6dLbrp": ("Complete tasks for more draws", "layla-fanny-return-2022", ["tokens", "draw"], {}),
    # ---- Ruby and Angela arrive -----------------------------------------------------------
    "ClQy8jJrB95": ("Ruby and Angela are announced", "ruby-angela-arrive", ["reveal", "skin"], {}),
    "ClszGOoroXA": ("Event guide: Ruby and Angela", "ruby-angela-arrive", ["guide", "draw"], {}),
    "CltA4RhrGhr": ("The new Aspirants skins are available", "ruby-angela-arrive", ["launch", "draw"], {}),
    "Cl0hiYNg5ZA": ("Which equipment first?", "ruby-angela-arrive", ["poll", "guide"], {"chars": [ANGELA]}),
    "Cl0ocFEO5NV": ("The Angela hero guide", "ruby-angela-arrive", ["guide", "community"],
                    {"chars": [ANGELA], "canon": "fan", "by": "@sire.plays (MGL Designer)",
                     "note": "Designed by @sire.plays. Guide written by @yonathan__p."}),
    "Cl1D5i5vAxx": ("Cute is justice: Angela", "ruby-angela-arrive", ["poll", "community"], {"chars": [ANGELA]}),
    "CmDwhnPrRay": ("The Aspirants: Awakening themed page", "ruby-angela-arrive", ["story", "event"], {}),
    # ---- Aspirants Unite: Ruby and Angela -------------------------------------------------
    "CmDb-a4OK3L": ("Free Aspirants Pass, December 10", "unite-ruby-angela", ["tokens", "draw"], {}),
    "CmJuJRQJn3C": ("Win the Aspirants Unite Pass", "unite-ruby-angela", ["tokens", "event"], {}),
    "CmV5AO-LutE": ("The draw for Angela and Ruby", "unite-ruby-angela", ["draw"], {}),
    "Cmvo_5YvkhK": ("Ending soon, January 4", "unite-ruby-angela", ["draw"], {}),
    "CnQ5fcwuxMq": ("Where do you like to sit?", "unite-ruby-angela", ["poll", "community"],
                    {"chars": [ANGELA], "canon": "fan", "by": "@slinckapril (MGL Designer)"}),
    # ---- Ruby and Angela return -----------------------------------------------------------
    "Cz0tE5PhPAg": ("Ruby and Angela return", "ruby-angela-return-2023", ["return"], {}),
    "C0EXhpiqUzc": ("Free draw token, November 25", "ruby-angela-return-2023", ["tokens"], {}),
    "C0o075yyqy4": ("The event is back, December 9", "ruby-angela-return-2023", ["tokens"], {}),
    "C0qj_LurYLk": ("Draw tokens for Angela and Ruby", "ruby-angela-return-2023", ["draw", "tokens"], {}),
    "C1UFT3mpTlj": ("Last chance, December 31", "ruby-angela-return-2023", ["draw"], {}),
    # ---- Lesley and Chang'e arrive --------------------------------------------------------
    "C3pNr50vmqU": ("Event guide: Lesley and Chang'e", "lesley-change-arrive", ["guide", "launch"], {}),
    "C3w1MN9vje2": ("Aspirants Unite is coming soon", "lesley-change-arrive", ["draw", "launch"], {}),
    "C3znuCOPWCM": ("In the Name of Hope: the backstory", "lesley-change-arrive", ["story"], {}),
    "C34jltRPISN": ("Renewed Hope: the first Aspirants", "lesley-change-arrive", ["story"], {}),
    "C4FiywBrd08": ("Lesley and Chang'e are available", "lesley-change-arrive", ["launch", "draw"], {}),
    "C4fO5Oxsucj": ("The skins are hot on sale", "lesley-change-arrive", ["draw"], {}),
    "C42WpFrL9vw": ("Complete tasks for two draw tokens", "lesley-change-arrive", ["tokens"], {}),
    # ---- The first four return ------------------------------------------------------------
    "C99UOwZJRHj": ("Aspirants Unite, reignited", "first-four-return-2024", ["return", "event"],
                    {"chars": FIRST_FOUR}),
    "C-FQRahp-GP": ("The skins return for a limited time", "first-four-return-2024", ["return", "draw"],
                    {"chars": FIRST_FOUR}),
    "C-M7OdxJkux": ("Free Pass, August 3", "first-four-return-2024", ["tokens"], {"chars": FIRST_FOUR}),
    "C-ugdBOs0zk": ("Moonton's 10th anniversary draw tokens", "first-four-return-2024", ["anniversary", "tokens"],
                    {"chars": FIRST_FOUR}),
    "C-uPQGgCk3D": ("The return is halfway through", "first-four-return-2024", ["return", "draw"],
                    {"chars": FIRST_FOUR}),
    "C_C_5YwBrad": ("One week left to get the skins", "first-four-return-2024", ["return", "draw"],
                    {"chars": FIRST_FOUR}),
    # ---- Lesley and Chang'e return --------------------------------------------------------
    "DLCzr1YolY-": ("Chang'e and Lesley return", "lesley-change-return-2025", ["return", "draw"], {}),
    "DLZ0qYBJ9-7": ("Free Pass, June 27", "lesley-change-return-2025", ["tokens"], {}),
    "DLuGXYYMRaa": ("The Aspirants Unite event is here", "lesley-change-return-2025", ["draw"], {}),
    "DL9qBrCyBcr": ("Free Token, July 11", "lesley-change-return-2025", ["tokens"], {}),
    # ---- Vexana and Guinevere arrive ------------------------------------------------------
    "DOxk_zYibYa": ("Darkness or light?", "vexana-guinevere-arrive", ["launch", "reveal"], {}),
    "DPOOYLMCbct": ("How to get the new skins", "vexana-guinevere-arrive", ["guide", "draw"], {}),
    "DPQsQzHCf4i": ("From Hope Comes Miracles", "vexana-guinevere-arrive", ["story", "bio"], {}),
    "DPVu-usiTsA": ("The new skins are here", "vexana-guinevere-arrive", ["launch", "draw"], {}),
    "DPWDlsHCUIr": ("The Aspirants Conquest draw", "vexana-guinevere-arrive", ["draw"], {}),
    # ---- Aspirants Unite: Vexana and Guinevere --------------------------------------------
    "DPnz-Aejngf": ("Earn Tokens, October 10", "unite-vexana-guinevere", ["tokens"], {}),
    "DP3GdBlAGnm": ("The Mini Show on MPL Malaysia", "unite-vexana-guinevere", ["event"], {}),
    "DP6UcBziSxy": ("Earn Tokens, October 17", "unite-vexana-guinevere", ["tokens"], {}),
    "DP8W5q1CW_l": ("The Aspirants Unite draw is live", "unite-vexana-guinevere", ["draw"], {}),
    "DQRYufAjacr": ("Last chance, November 4", "unite-vexana-guinevere", ["draw"], {}),
    # ---- TheMLabel gallery ----------------------------------------------------------------
    "DdIZTBHj4UA": ("Photos of the new semester", "mlabel", ["gallery", "reveal"], {"chars": TEN}),
    "DdL7_qOoArH": ("TheMLabel is live", "mlabel", ["gallery", "guide"],
                    {"chars": [FANNY, LAYLA, RUBY, ANGELA, LESLEY, CHANGE, GUINEVERE, VEXANA]}),
    "DdOFQNEEkbd": ("Become the hero of your own story", "mlabel", ["gallery", "trailer"], {"chars": []}),
    # ---- Ruby and Angela return again -----------------------------------------------------
    "DdWc0hWl-mM": ("Ruby and Angela return again", "ruby-angela-return-2026", ["return", "draw"], {}),
    "Ddavd8MAazh": ("Free Pass, September 18", "ruby-angela-return-2026", ["tokens"], {}),
    "DdsqKOvIxF0": ("Free Pass, September 25", "ruby-angela-return-2026", ["tokens"], {}),
    "DeGTPeWG9ki": ("Last chance, October 8", "ruby-angela-return-2026", ["draw"], {}),
    # ---- The Enders arrive ----------------------------------------------------------------
    "Ddp3rPII7ll": ("The Aspirants against the Enders", "enders-arrive", ["reveal", "launch"], {}),
    "DdyIX9wEk_7": ("Pick your girl", "enders-arrive", ["poll", "community"], {"chars": TEN}),
    "Dd0tPihiEpW": ("What is Selena up to in class?", "enders-arrive", ["short"], {"chars": [SELENA]}),
    "Dd6LYQYDdbi": ("Obsidia against Selena", "enders-arrive", ["anniversary", "launch", "short"],
                    {"chars": [OBSIDIA, SELENA]}),
    "Dd8G74gCTKW": ("A Game of Storms: Obsidia's character bio", "enders-arrive", ["story", "bio"], {}),
    "Dd-k3JQAWxT": ("Thunder's Gambit: Selena's character bio", "enders-arrive", ["story", "bio"], {}),
    "DeI4HaDI_OE": ("Event guide: Selena and Obsidia", "enders-arrive", ["guide", "launch"], {}),
    # ---- Aspirants Unite: Selena and Obsidia ----------------------------------------------
    "DeRIwUHo3lu": ("Obsidia and Selena are available", "unite-selena-obsidia", ["launch", "draw"], {}),
    "DeTLRP_jOAm": ("Limited-time sale: the Interactive Effect", "unite-selena-obsidia", ["draw"], {}),
    "DeioBzkG8H8": ("Free Token, October 16", "unite-selena-obsidia", ["tokens"], {}),
    "Delakn4Cb9E": ("Feel the power of the Aspirants", "unite-selena-obsidia", ["gameplay", "short"], {"chars": []}),
    "DeqWX2sG66I": ("The Aspirants Unite draw, for a limited time", "unite-selena-obsidia", ["draw"], {}),
    "DetJAmclG5M": ("Who saw that ending coming?", "unite-selena-obsidia", ["gameplay", "short"],
                    {"chars": [SELENA]}),
    "DfENMAHmyKW": ("The Aspirants Unite draw is in full swing", "unite-selena-obsidia", ["draw"], {}),
    # ---- The Skin Relationship Hub --------------------------------------------------------
    "Deqq-LbGwFb": ("The Skin Character Connection Hub", "relationship-hub", ["relationship"], {"chars": TEN}),
    "De0pnaNG6UO": ("The Skin Relationship Hub is here", "relationship-hub", ["relationship", "guide"],
                    {"chars": TEN}),
    "De6qFyvt0uP": ("Maybe we could be...", "relationship-hub", ["relationship", "short"], {"chars": TEN}),
    "De8lqz8DNH2": ("Skin relationships, defined by you", "relationship-hub", ["relationship"], {"chars": TEN}),
}
