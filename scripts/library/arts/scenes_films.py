"""The films that get scene stills, and what the room says about each (title, pair, characters).

Source files are read from the source library (`common.MEDIA`, read only). A film id is
`film-` plus `common.slugify` of the path under `media/` without its extension, the same id the
Films room uses, so a still can link to `/collection/films?i=<film id>&t=<seconds>`.

Counted: the official animated films (trailers, teasers, character films, Connection Lost,
Re:Link, Rekindled Light, We Believe, the short animation, the comic film, the Selena preview and
the interactive drama). Not counted: the live-action parody, fan edits, gameplay, fan made
videos, skin showcases, streams, matches, promo reels, in-game animation.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

FL = ["fanny", "layla"]
LC = ["lesley", "change"]
RA = ["ruby", "angela"]
SO = ["selena", "obsidia"]
VG = ["guinevere", "vexana"]


@dataclass(frozen=True)
class FilmSpec:
    rel: str  # path under media/, forward slashes
    title: str
    pair: str
    chars: tuple[str, ...]
    kind: str
    # Path under media/ of the footage manifest (None when the film has none).
    manifest: str | None = None

    @property
    def path(self) -> Path:
        return common.MEDIA / self.rel

    @property
    def id(self) -> str:
        return "film-" + common.slugify(self.rel.rsplit(".", 1)[0])


def _f(rel, title, pair, chars, kind, manifest="auto") -> FilmSpec:
    if manifest == "auto":
        folder = rel.rsplit("/", 1)[0]
        mp = f"{folder}/footages/manifest.json"
        manifest = mp if (common.MEDIA / mp).exists() else None
    return FilmSpec(rel, title, pair, tuple(chars), kind, manifest)


_D = "vexana-and-guinevere/video/interactive-drama"
# The 13 distinct episodes of the interactive drama (3A1 = 3A2, 3B1 = 3B2, 4A1 = 4A2, 4B1 = 4B2,
# 6A1 = 6A2, 6B1 = 6B2 and 6C1 = 6C2 = 6C3, so one copy of each is kept: the first).
DRAMA = [
    ("1", "Episode 1"),
    ("2A", "Episode 2A"),
    ("2B", "Episode 2B"),
    ("3A1", "Episode 3A"),
    ("3B1", "Episode 3B"),
    ("4A1", "Episode 4A"),
    ("4B1", "Episode 4B"),
    ("5A", "Episode 5A"),
    ("5B", "Episode 5B"),
    ("5C", "Episode 5C"),
    ("6A1", "Episode 6A"),
    ("6B1", "Episode 6B"),
    ("6C1", "Episode 6C"),
]


def _drama() -> list[FilmSpec]:
    out = []
    for stem, label in DRAMA:
        out.append(
            FilmSpec(
                f"{_D}/{stem}.webm",
                f"Interactive drama, {label[0].lower()}{label[1:]}",
                "guinevere-vexana",
                tuple(VG),
                "interactive drama",
                f"{_D}/footages/{stem}/manifest.json",
            )
        )
    return out


def films() -> list[FilmSpec]:
    lf = "layla-and-fanny/video/official"
    lc = "lesley-and-change/video/official"
    ra = "ruby-and-angela/video"
    so = "selena-and-obsidia/video"
    vg = "vexana-and-guinevere/video"
    trailer_rekindled = next((common.MEDIA / lc / "trailer").glob("*.webm"))
    rekindled_rel = trailer_rekindled.relative_to(common.MEDIA).as_posix()
    out = [
        # Layla and Fanny
        _f(f"{lf}/lore/teaser/001_2753027083653666852.mp4", "Layla and Fanny teaser", "fanny-layla", FL, "teaser"),
        _f(f"{lf}/lore/trailer/trailer.webm", "We Believe", "fanny-layla", FL, "trailer"),
        _f(f"{lf}/other/short-animation/short-animation-final.mp4", "Layla and Fanny short animation", "fanny-layla", FL, "short animation"),
        _f(f"{lf}/other/music-video/music.webm", "We Believe, the song", "fanny-layla", FL, "music video"),
        # Lesley and Chang'e
        _f(f"{lc}/teaser/001_3307542160288522496.mp4", "Lesley and Chang'e teaser", "lesley-change", LC, "teaser"),
        _f(f"{lc}/short-trailer/001_3655463914612092690.mp4", "Lesley and Chang'e short trailer", "lesley-change", LC, "trailer"),
        _f(rekindled_rel, "Rekindled Light", "lesley-change", LC, "trailer"),
        # Ruby and Angela
        _f(f"{ra}/trailer/trailer-final.mp4", "Awakening", "ruby-angela", RA, "trailer"),
        _f(f"{ra}/ruby/ruby-final.mp4", "Ruby character film", "ruby-angela", RA, "character film"),
        _f(f"{ra}/angela/angela-final.mp4", "Angela character film", "ruby-angela", RA, "character film"),
        # Selena and Obsidia
        _f(f"{so}/trailer/001_3994447231709070185.mp4", "Selena and Obsidia trailer", "selena-obsidia", SO, "trailer"),
        _f(f"{so}/selena/video.mp4", "Selena character film", "selena-obsidia", ["selena"], "character film"),
        _f(f"{so}/obsidia/001_3997406762701005025.mp4", "Obsidia character film", "selena-obsidia", ["obsidia"], "character film"),
        _f(f"{so}/character-preview/001_4018546186318517193.mp4", "Selena character preview", "selena-obsidia", ["selena"], "preview"),
        # Vexana and Guinevere
        _f(f"{vg}/connection-lost/final_video.mp4", "Connection Lost", "guinevere-vexana", VG, "short film"),
        _f(f"{vg}/relink/final_video2.mp4", "Re:Link", "guinevere-vexana", VG, "short film"),
        _f(f"{vg}/comic/comic-jp.mp4", "Guinevere and Vexana, the comic film", "guinevere-vexana", VG, "comic film"),
    ]
    out += _drama()
    return out


# Videos in the same folders that are left out, and why (printed by scenes.py).
SKIPPED = {
    "layla-and-fanny/video/official/other/live-action/live-action.webm": "the live-action parody (non-canon)",
    "layla-and-fanny/video/official/other/skin-showcase/skin.webm": "skin showcase",
    "layla-and-fanny/video/official/other/event-overview/001_2749282352243681631.mp4": "event overview (promo)",
    "layla-and-fanny/video/official/other/idea-bts/idea.webm": "behind the scenes talk",
    "layla-and-fanny/video/official/other/music-bts/music-bts.webm": "behind the scenes talk",
    "layla-and-fanny/video/official/other/music-producer-talk/music-producer-talk.webm": "talk",
    "layla-and-fanny/video/official/other/va-bts/video.mp4": "behind the scenes talk",
    "lesley-and-change/video/official/skin-showcase/final.mp4": "skin showcase",
    "ruby-and-angela/video/revamp/revamp-final.mp4": "promo (gameplay and splash art)",
    "ruby-and-angela/video/revamp/video.mp4": "promo (gameplay and splash art)",
    "ruby-and-angela/video/rerun/rerun.webm": "anniversary promo (chibi event animation)",
    "ruby-and-angela/video/mbti/001_3993299453120900879.mp4": "promo post (MBTI chibi)",
    "ruby-and-angela/video/qna/qna-final.mp4": "interview",
    "ruby-and-angela/video/skin-showcase/skin-final.mp4": "skin showcase",
    "ruby-and-angela/video/angela-portrait/001_3981461864613790631.mp4": "portrait promo clip",
    "ruby-and-angela/video/ruby-portrait/001_3982427966118152447.mp4": "portrait promo clip",
    "selena-and-obsidia/video/obsidia-portrait/001_3994507436480489700.mp4": "portrait promo clip",
    "selena-and-obsidia/video/selena-portrait/001_3995413678144712649.mp4": "portrait promo clip",
    "selena-and-obsidia/video/skin-showcase/001_3999520529387107465.mp4": "skin showcase",
    "selena-and-obsidia/video/music-collection/001_4013351897154849593.mp4": "music compilation",
    "vexana-and-guinevere/video/sleeping/sleeping.webm": "promo loop",
    "vexana-and-guinevere/video/splash-art-showcase/short-splash-art-showcase.webm": "splash art showcase",
    "vexana-and-guinevere/video/heart-short-dance/heart-short-dance.webm": "dance short",
    "vexana-and-guinevere/video/3d-process/3d-process.webm": "3D process clip",
    "vexana-and-guinevere/video/skin-showcase/skin-showcase.webm": "skin showcase",
    "vexana-and-guinevere/video/livestream-challenge": "livestreams",
    "selena-and-obsidia/video/match": "match recording",
    "selena-and-obsidia/video/_edits": "fan edits",
    "selena-and-obsidia/video/_gameplay": "gameplay",
    "_others/in-game-animation": "in-game animation",
    "_others/promotional": "promo reels",
    "vexana-and-guinevere/video/interactive-drama (duplicates)": "3A2, 3B2, 4A2, 4B2, 6A2, 6B2, 6C2, 6C3 are the same video as their first copy",
}
