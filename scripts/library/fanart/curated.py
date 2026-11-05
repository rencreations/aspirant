"""Facts that only a look at the pictures can give: who is in a crowded piece, a plain title, the medium.
Keys are pieces of the source path of the group's largest copy."""

from __future__ import annotations

ALL8 = ["layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana"]

# Aspirants that can be seen in the picture (judged at preview size). An empty list means the
# picture shows ordinary MLBB heroes, not the Aspirants.
CHARS: dict[str, list[str]] = {
    "instagram_p_C4aPqrho3sW": ["layla", "ruby", "change", "lesley", "angela", "fanny"],
    "Aspirant-New-Year-Blessing-943311703": ["layla", "fanny", "ruby", "angela"],
    "layla-and-fanny/art/fanart/many/instagram_p_C-h41jqszw- (3).jpg": ["layla", "fanny", "ruby", "angela", "lesley", "change"],
    "layla-and-fanny/art/fanart/many/instagram_p_C-h41jqszw- (4).jpg": ["layla", "fanny", "ruby", "angela"],
    "layla-and-fanny/art/fanart/many/instagram_p_C-h41jqszw- (5).jpg": ["layla", "fanny", "ruby", "angela", "lesley", "change"],
    "layla-and-fanny/art/fanart/many/instagram_p_C-r0wAnsbVK (1).jpg": ["layla", "angela"],
    "layla-and-fanny/art/fanart/many/instagram_p_C-r0wAnsbVK (2).jpg": ["layla", "fanny", "ruby", "angela"],
    "layla-and-fanny/art/fanart/many/instagram_p_CjkOM99NVkd.jpg": [],
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (1).jpg": ["fanny", "guinevere", "vexana"],
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (2).jpg": ["fanny", "ruby", "lesley", "guinevere", "vexana"],
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (3).jpg": ALL8,
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (4).jpg": ["fanny", "guinevere"],
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (5).jpg": ["fanny", "guinevere"],
    "layla-and-fanny/art/fanart/many/instagram_p_Deyt9PyCc-y (2).jpg": ["layla", "fanny", "ruby", "guinevere", "selena"],
    "layla-and-fanny/art/fanart/many/instagram_p_Deyt9PyCc-y (3).jpg": ["layla", "ruby", "angela", "selena", "obsidia"],
    "lesley-and-change/art/fanart/many/instagram_p_C-r0wAnsbVK.jpg": ["angela", "change"],
    "ruby-and-angela/art/fanart/many/instagram_p_C-h41jqszw- (1).jpg": ["layla", "fanny", "ruby", "angela", "lesley", "change"],
    "ruby-and-angela/art/fanart/many/instagram_p_C-h41jqszw- (5).jpg": ["layla", "fanny", "ruby", "angela", "lesley", "change"],
    "ruby-and-angela/art/fanart/many/instagram_p_DP6H2gMAXjl (1).jpg": ["angela", "guinevere", "vexana"],
    "ruby-and-angela/art/fanart/many/instagram_p_Deyt9PyCc-y (2).jpg": ["angela", "selena"],
    "Mah gurlieees 🥰.heic": ["ruby", "guinevere", "selena", "obsidia"],
}

# A plain title. Anything not listed gets "<names>, fan art".
TITLES: dict[str, str] = {
    "instagram_p_C4aPqrho3sW": "Guess the heroes by their eyes",
    "instagram_p_ClyYQCyNvCO": "Ruby hero guide",
    "Aspirant-New-Year-Blessing-943311703": "New Year blessing",
    "instagram_p_CjkOM99NVkd": "MLBB 6th anniversary party",
    "layla-and-fanny/art/fanart/many/instagram_p_C-h41jqszw- (3).jpg": "The Aspirants on the steps",
    "layla-and-fanny/art/fanart/many/instagram_p_C-h41jqszw- (4).jpg": "Layla, Ruby, Angela and Fanny",
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (3).jpg": "The Aspirants, group selfie",
    "layla-and-fanny/art/fanart/many/instagram_p_DP6H2gMAXjl (4).jpg": "Fanny and Guinevere at dinner",
    "layla-and-fanny/art/fanart/many/instagram_p_Deyt9PyCc-y (2).jpg": "The Aspirants on the roof",
    "layla-and-fanny/art/fanart/many/instagram_p_Deyt9PyCc-y (3).jpg": "The Aspirants, camera view",
    "Mah gurlieees 🥰.heic": "Selena and Obsidia, panel collage",
    "ruby/https-www.facebook.com-groups-illustratorrajin-posts-1802014587360487/sketch": "Ruby, sketch step",
    "ruby/https-www.facebook.com-groups-illustratorrajin-posts-1802014587360487/lineart": "Ruby, line art step",
    "ruby/https-www.facebook.com-groups-illustratorrajin-posts-1802014587360487/coloring": "Ruby, coloring step",
    "ruby/https-www.facebook.com-groups-illustratorrajin-posts-1802014587360487/bg+effect": "Ruby, background and effects step",
    "ruby/https-www.facebook.com-groups-illustratorrajin-posts-1802014587360487/render": "Ruby, final render",
}

TAGS: dict[str, list[str]] = {
    "instagram_p_C4aPqrho3sW": ["digital", "humor"],
    "instagram_p_ClyYQCyNvCO": ["guide"],
    "instagram_p_CjkOM99NVkd": ["anniversary"],
    "illustratorrajin-posts-1802014587360487/sketch": ["sketch", "process"],
    "illustratorrajin-posts-1802014587360487/lineart": ["lineart", "process"],
    "illustratorrajin-posts-1802014587360487/coloring": ["digital", "process"],
    "illustratorrajin-posts-1802014587360487/bg+effect": ["digital", "process"],
    "illustratorrajin-posts-1802014587360487/render": ["digital", "process"],
    "Mah gurlieees 🥰.heic": ["collage", "digital"],
}

# Notes that only a person can write (kept to a plain sentence).
NOTES: dict[str, str] = {
    "instagram_p_ClyYQCyNvCO": "A guide graphic. The guide text is by @yonathan__p.",
}

# Hand made facts for the videos.
VIDEOS = [
    {
        "dir": "layla-and-fanny/art/fanart/fanny/tiktok_com_nibiru_234_video_7589262634805955848",
        "id": "nibiru-fanny-speedpaint",
        "title": "Fanny, speedpaint",
        "chars": ["fanny"],
        "tags": ["speedpaint", "digital"],
        "post": "tt:7589262634805955848",
    },
    {
        "dir": "ruby-and-angela/art/fanart/ruby/tiktok_com_nibiru_234_video_7589451715997388040",
        "id": "nibiru-ruby-speedpaint",
        "title": "Ruby, speedpaint",
        "chars": ["ruby"],
        "tags": ["speedpaint", "digital"],
        "post": "tt:7589451715997388040",
    },
    {
        "dir": "selena-and-obsidia/art/fanart/both/tiktok_com_isakochii__video_7695479424635997447",
        "id": "isakochii-selena-obsidia-speedpaint",
        "title": "Selena and Obsidia, speedpaint",
        "chars": ["selena", "obsidia"],
        "tags": ["speedpaint", "digital"],
        "post": "tt:7695479424635997447",
    },
    {
        "file": "selena-and-obsidia/art/fanart/obsidia/httpswww.tiktok.com@bomboclau_video7694259319201664277.mp4",
        "copies": ["selena-and-obsidia/art/fanart/selena/httpswww.tiktok.com@bomboclau_video7694259319201664277.mp4"],
        "id": "bomboclau-jealousy",
        "title": "Obsidia and Selena, Jealousy animation",
        "chars": ["selena", "obsidia"],
        "tags": ["animation"],
        "post": "tt:7694259319201664277",
    },
    {
        "file": "selena-and-obsidia/art/fanart/selena/httpswww.tiktok.com@hashirama1697video7681495176833027345.mp4",
        "id": "hashirama-selena-speedpaint",
        "title": "Selena, speedpaint",
        "chars": ["selena"],
        "tags": ["speedpaint", "digital"],
        "post": "tt:7681495176833027345",
    },
    {
        "dir": "layla-and-fanny/video/fanmade/badminton",
        "id": "badminton-animation",
        "title": "Fanny versus Layla, badminton animation",
        "chars": ["fanny", "layla"],
        "tags": ["animation", "voiced"],
        "post": "ig:CaJsFacr35J",
        "note": "Fan-made animation. Voices by @bleu_wolf99 (Fanny) and @mocacchi_desu (Layla).",
    },
    {
        "dir": "lesley-and-change/video/fanmade/change-dance",
        "id": "change-dance",
        "title": "Chang'e and Lesley, dance",
        "chars": ["lesley", "change"],
        "tags": ["dance", "edit"],
        "media": "3321342125059974059",
    },
    {
        "dir": "lesley-and-change/video/fanmade/lesley-dance",
        "id": "lesley-dance",
        "title": "Lesley, dance",
        "chars": ["lesley", "change"],
        "tags": ["dance", "edit"],
        "media": "3321976489127768574",
    },
    {
        "dir": "vexana-and-guinevere/video/fanmade-short-anim-funny",
        "id": "guinevere-vexana-funny-short",
        "title": "Guinevere and Vexana, funny short animation",
        "chars": ["guinevere", "vexana"],
        "tags": ["animation", "humor"],
        "post": "tt:7569881099917298964",
        "note": "A joke animation. The maker says it is not canon.",
    },
]

# The nine reels in selena-and-obsidia/video/_edits. Each is a post of the official account.
EDITS = {
    "cool-hand-window-animation-real-life": ("Hand window animation", ["selena", "obsidia"]),
    "lineart-edits": ("Obsidia, line art edit", ["obsidia"]),
    "love-me-edits": ("Love me edit", ["selena", "obsidia"]),
    "obsidia-edits": ("Obsidia, bare-handed edit", ["obsidia"]),
    "obsidia-evil-edits": ("Obsidia, dark edit", ["obsidia"]),
    "obsidia-selena-fight-edits": ("Obsidia and Selena, fight edit", ["selena", "obsidia"]),
    "projectile-spelling-name": ("Skills that spell the names", ["selena", "obsidia"]),
    "selena-edits": ("Selena, repeat edit", ["selena"]),
    "vexana-idle-edits": ("Selena, idle edit", ["selena"]),
}
