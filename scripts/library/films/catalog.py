"""The catalog of the Others room (Video, Others): what each video is, where it comes from and how it is made.

The ten official films (`FILM_IDS` in `features/library/video/links.ts`) are not here: they belong to
the Films room. The videos that other rooms already encode (promo reels, emotes, gameplay clips,
official edits and fan videos) are in `reuse.py`.

Every entry names a source video under `media/` (`src`, a path that may hold one `*` when the file
name is long or in Japanese) and a plan:

  mode "encode"  re-encode to H.264 High at most 1080p (CRF 20, 22 or 23)
  mode "copy"    the source is already H.264 High, yuv420p, AAC and not too heavy: remux with faststart
  mode "local"   the site already ships a file of the same picture and size (`local`, a path in
                 `apps/web/public/`): nothing is encoded, only the poster, captions and chapters

The titles and the descriptions are written here in plain words (the readme files of the source
folders are not copied: they have typos and unofficial wording). No dashes, no banned words.
"""

from __future__ import annotations

from typing import Any

PAIR_CHARS: dict[str, list[str]] = {
    "fanny-layla": ["layla", "fanny"],
    "ruby-angela": ["ruby", "angela"],
    "lesley-change": ["lesley", "change"],
    "guinevere-vexana": ["guinevere", "vexana"],
    "selena-obsidia": ["selena", "obsidia"],
}

V = "layla-and-fanny/video/official"
R = "ruby-and-angela/video"
L = "lesley-and-change/video/official"
G = "vexana-and-guinevere/video"
S = "selena-and-obsidia/video"


def film(
    src: str,
    title: str,
    kind: str,
    pair: str | None,
    desc: str,
    *,
    chars: list[str] | None = None,
    canon: str = "official",
    mode: str = "encode",
    local: str | None = None,
    crf: int = 24,
    crop: str | None = None,
    captions: str | None = None,
    manifest: str | None = None,
    tags: list[str] | None = None,
    poster_t: float | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "src": src,
        "title": title,
        "kind": kind,
        "pair": pair,
        "chars": chars if chars is not None else (PAIR_CHARS[pair] if pair else []),
        "desc": desc,
        "canon": canon,
        "mode": mode,
        "local": local,
        "crf": crf,
        "crop": crop,
        "captions": captions,
        "manifest": manifest,
        "tags": tags or [],
        "poster_t": poster_t,
        "extra": extra or {},
    }


FILMS: list[dict[str, Any]] = [
    # ---------------------------------------------------------------- Layla and Fanny
    film(
        f"{V}/lore/teaser/001_2753027083653666852.mp4",
        "We Believe!, teaser",
        "teaser",
        "fanny-layla",
        "A short teaser for the first Aspirants trailer, with the voice actress and the composer of the theme song. It was posted a few days before the trailer.",
        mode="copy",
        manifest=f"{V}/lore/teaser",
        poster_t=6,
        tags=["we believe"],
    ),
    film(
        f"{V}/other/short-animation/short-animation-final.mp4",
        "Layla and Fanny, short animation",
        "lore",
        "fanny-layla",
        "A light short about Layla and Fanny in freeform training at Selrick Academy. Layla is sure she will beat Fanny this time.",
        mode="copy",
        captions=f"{V}/other/short-animation/english.srt",
        tags=["training", "short film"],
    ),
    film(
        f"{V}/other/skin-showcase/skin.webm",
        "Layla and Fanny, skin showcase",
        "showcase",
        "fanny-layla",
        "The Layla skin Miss Hikari and the Fanny skin Blade of Kibou in action, shown in the game.",
        tags=["skin", "miss hikari", "blade of kibou"],
    ),
    film(
        f"{V}/other/music-video/music.webm",
        "We Believe!, music video",
        "music",
        "fanny-layla",
        "The music video of We Believe!, the theme of the Aspirants. Yasuharu Takanashi composed it, Funta7 wrote the lyrics and Yoshino Nanjo sings.",
        tags=["we believe", "song", "music video"],
    ),
    film(
        f"{V}/other/idea-bts/idea.webm",
        "The first Aspirant ideas, behind the scenes",
        "behind-the-scenes",
        "fanny-layla",
        "Inside the Mobile Legends studio, the team explains how the first Aspirant ideas took shape. The talk has English subtitles in the picture.",
        tags=["studio", "making of"],
    ),
    film(
        f"{V}/other/music-bts/music-bts.webm",
        "We Believe!, the composer talks",
        "behind-the-scenes",
        "fanny-layla",
        "The composer of We Believe! talks about the Aspirants, the story, the characters and the music, and about what was hard in writing the song. English subtitles are in the picture.",
        mode="local",
        local="/video/fanny-layla/music-bts.mp4",
        tags=["we believe", "composer", "music talk"],
    ),
    film(
        f"{V}/other/music-producer-talk/music-producer-talk.webm",
        "We Believe!, the music producer",
        "behind-the-scenes",
        "fanny-layla",
        "The music producer talks about We Believe!, the new song for the Aspirants.",
        mode="local",
        local="/video/fanny-layla/music-producer-talk.mp4",
        tags=["we believe", "producer", "music talk"],
    ),
    film(
        f"{V}/other/va-bts/video.mp4",
        "We Believe!, Yoshino Nanjo in the studio",
        "interview",
        "fanny-layla",
        "Yoshino Nanjo, the voice of Layla and the singer of We Believe!, talks about Layla and about recording the song. English subtitles are in the picture.",
        mode="copy",
        tags=["we believe", "voice actress", "studio"],
    ),
    film(
        f"{V}/other/event-overview/001_2749282352243681631.mp4",
        "The Aspirants event overview",
        "event",
        "fanny-layla",
        "A walk through the Aspirants event: what you can get, the skins, the bonuses and how to earn them.",
        mode="copy",
        tags=["event", "rewards"],
    ),
    film(
        f"{V}/other/live-action/live-action.webm",
        "Live-action parody",
        "parody",
        "fanny-layla",
        "A live-action comedy that plays Layla and Fanny as school rivals. It is a parody made outside the story, and nothing in it counts as canon.",
        canon="non-canon",
        captions=f"{V}/other/live-action/english.srt",
        tags=["parody", "live action", "non-canon"],
    ),
    # ---------------------------------------------------------------- Ruby and Angela
    film(
        f"{R}/qna/qna-final.mp4",
        "Angela and Ruby, event introduction",
        "event",
        "ruby-angela",
        "Angela introduces herself, her friend Tetra and her best friend Ruby, then invites everyone to the Aspirants Unite event on 3 December.",
        mode="copy",
        captions=f"{R}/qna/english.srt",
        tags=["q and a", "tetra", "event"],
    ),
    film(
        f"{R}/skin-showcase/skin-final.mp4",
        "Ruby and Angela, skin showcase",
        "showcase",
        "ruby-angela",
        "The Ruby skin Mecha Maiden and the Angela skin Cyber Cherubin in action, shown in the game.",
        mode="copy",
        tags=["skin", "mecha maiden", "cyber cherubin"],
    ),
    film(
        f"{R}/revamp/revamp-final.mp4",
        "Ruby and Angela, revamp",
        "event",
        "ruby-angela",
        "The revamped Ruby and Angela in the game, with their new effects.",
        tags=["revamp", "gameplay"],
    ),
    film(
        f"{R}/rerun/rerun.webm",
        "The Aspirants rerun",
        "event",
        "ruby-angela",
        "A vertical animated short about the return of the Aspirants skins.",
        tags=["rerun", "short"],
    ),
    film(
        f"{R}/mbti/001_3993299453120900879.mp4",
        "The Aspirants MBTI",
        "social",
        "ruby-angela",
        "A short cartoon in which Angela shares the MBTI types of the Aspirants.",
        chars=["angela"],
        tags=["mbti", "social"],
    ),
    film(
        f"{R}/angela-portrait/001_3981461864613790631.mp4",
        "Angela, portrait card",
        "social",
        "ruby-angela",
        "A short portrait card for the return of Angela Cyber Cherubin.",
        chars=["angela"],
        tags=["portrait", "social"],
    ),
    film(
        f"{R}/ruby-portrait/001_3982427966118152447.mp4",
        "Ruby, portrait card",
        "social",
        "ruby-angela",
        "A short portrait card for the return of Ruby Mecha Maiden.",
        chars=["ruby"],
        tags=["portrait", "social"],
    ),
    # ---------------------------------------------------------------- Lesley and Chang'e
    film(
        f"{L}/teaser/001_3307542160288522496.mp4",
        "Rekindled Light, teaser",
        "teaser",
        "lesley-change",
        "A teaser told in four short letters from Chang'e to Lesley, from a happy lab memory to a burning city. It ends by announcing the Rekindled Light trailer.",
        mode="copy",
        manifest=f"{L}/teaser",
        tags=["letters"],
    ),
    film(
        f"{L}/short-trailer/001_3655463914612092690.mp4",
        "Lesley and Chang'e, short trailer",
        "trailer",
        "lesley-change",
        "A 50 second cut for the return of Chang'e Tech Tensai and Lesley Deadeye Spectre on 18 June. It runs from the lab memory through the burning city and into the game.",
        mode="copy",
        manifest=f"{L}/short-trailer",
        poster_t=20,
        tags=["rerun", "short"],
    ),
    film(
        f"{L}/skin-showcase/final.mp4",
        "Lesley and Chang'e, skin showcase",
        "showcase",
        "lesley-change",
        "The Chang'e skin Tech Tensai and the Lesley skin Deadeye Spectre in action, shown in the game.",
        tags=["skin", "tech tensai", "deadeye spectre"],
    ),
    # ---------------------------------------------------------------- Guinevere and Vexana
    film(
        f"{G}/comic/comic-jp.mp4",
        "Guinevere and Vexana, comic film",
        "lore",
        "guinevere-vexana",
        "The Guinevere and Vexana comic as a motion comic with sound, in Japanese. It opens on Vexana kneeling in rubble and goes back three hours to show how she got there.",
        mode="local",
        local="/video/vexana/comic-jp.mp4",
        manifest=f"{G}/comic",
        tags=["comic", "motion comic", "japanese"],
    ),
    film(
        f"{G}/skin-showcase/skin-showcase.webm",
        "Guinevere and Vexana, skin showcase",
        "showcase",
        "guinevere-vexana",
        "The Guinevere and Vexana skins in action, shown in the game.",
        tags=["skin", "twilight star"],
    ),
    film(
        f"{G}/livestream-challenge/live-guin.webm",
        "Guinevere, live challenge",
        "livestream",
        "guinevere-vexana",
        "A vertical livestream of Guinevere for The Aspirants Live Challenge, held on 23 September. English subtitles are in the picture.",
        chars=["guinevere"],
        mode="local",
        local="/video/guinevere/live-guin.mp4",
        tags=["live challenge", "stream"],
    ),
    film(
        f"{G}/livestream-challenge/live-vexana.webm",
        "Vexana, live challenge",
        "livestream",
        "guinevere-vexana",
        "A vertical livestream of Vexana for The Aspirants Live Challenge, held on 24 September. English subtitles are in the picture.",
        chars=["vexana"],
        mode="local",
        local="/video/vexana/live-vexana.mp4",
        tags=["live challenge", "stream"],
    ),
    film(
        f"{G}/3d-process/3d-process.webm",
        "The 3D process",
        "behind-the-scenes",
        "guinevere-vexana",
        "A short look at a character's 3D model, shown as a plain grey render turning in space.",
        mode="local",
        local="/video/vexana/3d-process.mp4",
        tags=["3d", "making of"],
    ),
    film(
        f"{G}/heart-short-dance/heart-short-dance.webm",
        "Heart, short dance",
        "short",
        "guinevere-vexana",
        "A 12 second vertical dance of Guinevere and Vexana.",
        mode="local",
        local="/video/vexana/heart-dance.mp4",
        tags=["dance", "short"],
    ),
    film(
        f"{G}/sleeping/sleeping.webm",
        "Sleeping",
        "short",
        "guinevere-vexana",
        "A vertical animation of Vexana and Guinevere asleep.",
        tags=["short", "animation"],
    ),
    film(
        f"{G}/splash-art-showcase/short-splash-art-showcase.webm",
        "Splash art showcase, short",
        "short",
        "guinevere-vexana",
        "A short vertical showcase of splash art that moves across the screen.",
        tags=["splash art", "short"],
    ),
    # ---------------------------------------------------------------- Selena and Obsidia
    film(
        f"{S}/character-preview/001_4018546186318517193.mp4",
        "Selena and Obsidia, character preview",
        "short",
        "selena-obsidia",
        "A 15 second cinematic preview of Selena and Obsidia in their new skins.",
        tags=["preview", "short"],
    ),
    film(
        f"{S}/skin-showcase/001_3999520529387107465.mp4",
        "Selena and Obsidia, skin showcase",
        "showcase",
        "selena-obsidia",
        "Obsidia Imperatrix Arashi and Selena Silverbolt Raiko in action, shown in the game. Obsidia takes a mecha suit form and Selena summons a mechanical hound.",
        tags=["skin", "silverbolt raiko", "imperatrix arashi"],
    ),
    film(
        f"{S}/selena-portrait/001_3995413678144712649.mp4",
        "Selena, portrait card",
        "social",
        "selena-obsidia",
        "A short portrait card for the debut of Selena Silverbolt Raiko, an ordinary student at Selrick Academy and a pawn in Obsidia's hands.",
        chars=["selena"],
        tags=["portrait", "social"],
    ),
    film(
        f"{S}/obsidia-portrait/001_3994507436480489700.mp4",
        "Obsidia, portrait card",
        "social",
        "selena-obsidia",
        "A short portrait card for the debut of Obsidia Imperatrix Arashi, a commander of the Enders and Selena's creator.",
        chars=["obsidia"],
        tags=["portrait", "social"],
    ),
    film(
        f"{S}/music-collection/001_4013351897154849593.mp4",
        "The Aspirants soundtrack",
        "music",
        "selena-obsidia",
        "Fourteen minutes of music from the Aspirants series, from We Believe! to Lullaby of Oblivion and Gray New World.",
        chars=["selena", "obsidia", "layla", "fanny"],
        crf=25,
        tags=["music", "soundtrack", "we believe"],
    ),
    film(
        f"{S}/match/*.webm",
        "Aspirants Unite, the showmatch",
        "match",
        "selena-obsidia",
        "A showmatch of Team Selena against Team Obsidia, played by creators who talk through the game with their cameras on. It runs 28 minutes.",
        crf=27,
        tags=["match", "showmatch", "gameplay"],
    ),
]

# The interactive drama: 21 official episode ids, 13 different films (eight are posted under two or
# three ids). The site already ships the 13 films (`public/video/vexana/drama/<file>.mp4`). Titles
# and summaries follow the drama of Vexana's page (`features/character/vexana/drama/drama-graph.ts`).
DRAMA_DIR = "vexana-and-guinevere/video/interactive-drama"
DRAMA: list[dict[str, Any]] = [
    {
        "chapter": 1,
        "code": "1",
        "codes": ["1"],
        "file": "1",
        "title": "Arrival at Selrick",
        "summary": "A new student arrives at Selrick Academy and hears of its ace duo, Guinevere and Vexana. A strange badge and a signal from the rooftop catch the eye.",
    },
    {
        "chapter": 2,
        "code": "2A",
        "codes": ["2A"],
        "file": "2a",
        "title": "The Emblem",
        "summary": "Guinevere says the badge is an Emblem of Hope. She and Vexana made it together, as proof of their bond.",
    },
    {
        "chapter": 2,
        "code": "2B",
        "codes": ["2B"],
        "file": "2b",
        "title": "The Rooftop Signal",
        "summary": "Angela, Ruby and Guinevere track an unstable energy signal. Ruby fears it is an Ender, and that it is a lure.",
    },
    {
        "chapter": 3,
        "code": "3A1",
        "codes": ["3A1", "3A2"],
        "file": "3a",
        "title": "Where They Met",
        "summary": "Guinevere remembers how she and Vexana became partners. Her emblem still glows, and she is sure Vexana is waiting.",
    },
    {
        "chapter": 3,
        "code": "3B1",
        "codes": ["3B1", "3B2"],
        "file": "3b",
        "title": "Alarm at the Singularity",
        "summary": "Students report a dangerous signal from the Singularity. The emblem flashes, and Guinevere decides to go alone.",
    },
    {
        "chapter": 4,
        "code": "4A1",
        "codes": ["4A1", "4A2"],
        "file": "4a",
        "title": "The Partner Test",
        "summary": "Guinevere tests the newcomer as a temporary partner. Layla judges the aim, and Guinevere admits she fears losing another partner.",
    },
    {
        "chapter": 4,
        "code": "4B1",
        "codes": ["4B1", "4B2"],
        "file": "4b",
        "title": "Rescue Briefing",
        "summary": "The Aspirants gather before a map of the Singularity. The Enders are mobilizing, and the team is ready to bring Vexana back.",
    },
    {
        "chapter": 5,
        "code": "5A",
        "codes": ["5A"],
        "file": "5a",
        "title": "The Argument",
        "summary": "Guinevere admits she and Vexana quarreled the day Vexana vanished. Vexana had seen a doomed future, and Guinevere now sees she only meant to protect her.",
    },
    {
        "chapter": 5,
        "code": "5B",
        "codes": ["5B"],
        "file": "5b",
        "title": "Fall Back",
        "summary": "The newcomer calls a retreat. Guinevere puts everything on the line and entrusts the academy to the newcomer.",
    },
    {
        "chapter": 5,
        "code": "5C",
        "codes": ["5C"],
        "file": "5c",
        "title": "Into the Battle",
        "summary": "Guinevere warns that this is real battle. An Ender strikes, and Vexana and Guinevere each try to shield the other.",
    },
    {
        "chapter": 6,
        "code": "6A1",
        "codes": ["6A1", "6A2"],
        "file": "6a",
        "title": "Witness Our Moment",
        "summary": "Vexana believes there is no other choice. Guinevere answers that the choice is theirs together, and the two strike as partners.",
    },
    {
        "chapter": 6,
        "code": "6B1",
        "codes": ["6B1", "6B2"],
        "file": "6b",
        "title": "A New Future",
        "summary": "Guinevere will not let Vexana sacrifice herself. Their light destroys the Control Core, the Singularity disappears, and they stand together at sunset.",
    },
    {
        "chapter": 6,
        "code": "6C1",
        "codes": ["6C1", "6C2", "6C3"],
        "file": "6c",
        "title": "United Light",
        "summary": "The whole squad stands behind Guinevere. They say that hope never dies and charge the Singularity together.",
    },
]

# The shelves of the Others room, in order. A shelf holds the kinds it lists. The same list is
# `SHELVES` in `apps/web/src/features/library/video/others/video-data.ts`, and a unit test reads the
# data file to make sure every kind has a shelf.
ROWS = [
    ("parody", "Live-action parody", ["parody"]),
    ("trailers", "Trailers and short films", ["trailer", "teaser", "lore"]),
    ("shorts", "Shorts and cards", ["short", "social"]),
    ("showcases", "Skin showcases", ["showcase"]),
    ("music", "Music and making of", ["music", "behind-the-scenes"]),
    ("interviews", "Interviews and events", ["interview", "event"]),
    ("drama", "Interactive drama", ["drama"]),
    ("live", "Streams and the match", ["livestream", "match"]),
    ("reels", "Promo reels", ["reel"]),
    ("gameplay", "Gameplay clips", ["gameplay"]),
    ("emotes", "Emotes", ["emote"]),
    ("edits", "Official edits", ["edit"]),
    ("fan", "Fan videos", ["fan"]),
]

# Source videos that are in the library but are deliberately not films of their own.
IGNORED: dict[str, str] = {
    "ruby-and-angela/video/revamp/video.mp4": "Lower quality copy of revamp/revamp-final.mp4 (same film, same length).",
    f"{DRAMA_DIR}/3A2.webm": "Same film as 3A1 posted under a second id; the Others room carries it as an alias of the 3A1 film.",
    f"{DRAMA_DIR}/3B2.webm": "Same film as 3B1 posted under a second id; the Others room carries it as an alias of the 3B1 film.",
    f"{DRAMA_DIR}/4A2.webm": "Same film as 4A1 posted under a second id; the Others room carries it as an alias of the 4A1 film.",
    f"{DRAMA_DIR}/4B2.webm": "Same film as 4B1 posted under a second id; the Others room carries it as an alias of the 4B1 film.",
    f"{DRAMA_DIR}/6A2.webm": "Same film as 6A1 posted under a second id; the Others room carries it as an alias of the 6A1 film.",
    f"{DRAMA_DIR}/6B2.webm": "Same film as 6B1 posted under a second id; the Others room carries it as an alias of the 6B1 film.",
    f"{DRAMA_DIR}/6C2.webm": "Same film as 6C1 posted under a second id; the Others room carries it as an alias of the 6C1 film.",
    f"{DRAMA_DIR}/6C3.webm": "Same film as 6C1 posted under a third id; the Others room carries it as an alias of the 6C1 film.",
}
