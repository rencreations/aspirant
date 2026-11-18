"""Tests of the pure functions and of the written data of the home media scripts.

    C:/Users/muham/anaconda3/python.exe -m unittest scripts/home/media/test_media.py -v     (from the repository root)
    or: cd scripts/home/media && C:/Users/muham/anaconda3/python.exe -m unittest test_media -v

The data tests read the files the scripts wrote (public/data/home/picks.json and voices.json, the encoded media) and
fail when one of the owner's rules is broken: official pictures only, no corner mark in a card window, the wall's
neighbours, the sizes of the previews, the seam of every loop.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "library" / "voicelines"))

import hcommon as h  # noqa: E402
import loops as L  # noqa: E402
import loudness  # noqa: E402
import picks as K  # noqa: E402
import previews as P  # noqa: E402
import voices as V  # noqa: E402


def picks() -> dict:
    return h.read_json(h.DATA / "picks.json")


class Gain(unittest.TestCase):
    def test_bus_is_the_players_1_9(self) -> None:
        self.assertAlmostEqual(loudness.BUS_DB, 5.575, places=3)
        ts = (h.REPO / "apps/web/src/lib/voice-gain.ts").read_text(encoding="utf-8")
        self.assertIn(f"VOICE_BUS_GAIN = {loudness.VOICE_BUS_GAIN}", ts)

    def test_formula(self) -> None:
        # a quiet clip is lifted to the target
        self.assertEqual(loudness.gain_db(-33.0, -20.0), round(-18 + 33 - loudness.BUS_DB, 1))
        # a loud clip is cut
        self.assertLess(loudness.gain_db(-14.0, -3.0), 0)
        # a clip whose peak would pass the ceiling is held by the peak: after the gain and the bus it stands at -1 dBTP
        g = loudness.gain_db(-30.0, -3.0)
        self.assertAlmostEqual(-3.0 + g + loudness.BUS_DB, loudness.CEIL_DBTP, places=1)
        self.assertGreater(-30.0 + g + loudness.BUS_DB, -30.0)

    def test_no_bus_for_a_recording(self) -> None:
        self.assertEqual(loudness.gain_db(-22.0, -5.0, 0.0), 4.0)


class Voices(unittest.TestCase):
    def test_the_owners_list(self) -> None:
        d = h.read_json(h.DATA / "voices.json")
        got = [(c["slug"], c["line"]) for c in d["characters"]]
        self.assertEqual(got, V.WANTED)
        self.assertEqual([lang["id"] for lang in d["languages"]], V.LANGS)
        for c in d["characters"]:
            self.assertEqual(list(c["lines"]), V.LANGS)
            self.assertEqual(c["lines"]["jp"]["n"], 42 if c["slug"] == "selena" else c["line"])
            for lang, rec in c["lines"].items():
                self.assertEqual(rec["dir"], "rtl" if lang == "ar" else "ltr")
                self.assertTrue(rec["t"])
                self.assertTrue((h.MIRROR / rec["key"]).exists(), rec["key"])
                self.assertIsInstance(rec["g"], (int, float))
                self.assertGreater(rec["d"], 1)
        self.assertEqual(sum(len(c["lines"]) for c in d["characters"]), 80)

    def test_keys_follow_the_player(self) -> None:
        self.assertEqual(V.line_key("fanny", "jp", 5), "voicelines/fanny/05.m4a")
        self.assertEqual(V.line_key("fanny", "ar", 18), "voicelines/fanny/ar/18.m4a")


class Windows(unittest.TestCase):
    def test_loop_windows_are_four_by_five(self) -> None:
        for spec in L.LOOPS:
            full = L.STILL_FULL if spec["kind"] == "still" else (1920, 864 if spec["kind"] == "idle" else 1080)
            w = L.window(spec, full)
            self.assertAlmostEqual(w["w"] * full[0] / (w["h"] * full[1]), 0.8, delta=0.004, msg=spec["slug"])
            self.assertAlmostEqual(w["zoom"], 1 / w["h"], places=2)
            self.assertLessEqual(w["x"] + w["w"], 1.0001)
            self.assertLessEqual(w["y"] + w["h"], 1.0001)

    def test_the_owners_order(self) -> None:
        self.assertEqual([s["slug"] for s in L.LOOPS],
                         ["obsidia", "fanny", "guinevere", "angela", "lesley", "layla", "ruby", "vexana", "change"])

    def test_preview_crop_is_the_card_shape(self) -> None:
        for w, hh in ((1920, 1080), (2560, 1080), (1920, 808), (1920, 820)):
            cw, ch, x, y = P.crop_box(w, hh)
            self.assertAlmostEqual(cw / ch, P.CARD_RATIO, delta=0.01)
            self.assertLessEqual(x + cw, w)
            self.assertLessEqual(y + ch, hh)

    def test_previews_cover_the_ten_films_in_order(self) -> None:
        ids = [f["id"] for f in P.film_items()]
        links = (h.REPO / "apps/web/src/features/library/video/links.ts").read_text(encoding="utf-8")
        positions = [links.index(f'"{i}"') for i in ids]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(len(ids), 10)

    def test_clean_window_is_wide_and_inside(self) -> None:
        for item_id in K.MARKED:
            c = K.clean_window(K.SPLASH_BY_ID[item_id])
            self.assertGreaterEqual(c["x"], K.MARK_RIGHT)  # starts right of the mark
            self.assertAlmostEqual(c["w"], c["h"], places=4)  # 16:9 stays 16:9
            self.assertLessEqual(c["x"] + c["w"], 1.0001)


class Picks(unittest.TestCase):
    def test_official_only(self) -> None:
        p = picks()
        pics = p["hero"]["wide"]["single"] + p["hero"]["wide"]["group"] + p["wall"]["order"] + p["spiral"]
        for rec in pics:
            self.assertEqual(K.SPLASH_BY_ID[rec["id"]]["canon"], "official", rec["id"])
            self.assertNotIn("site", rec["lib"]["p"])

    def test_sets(self) -> None:
        p = picks()
        self.assertEqual(len(p["hero"]["wide"]["single"]), 10)
        self.assertEqual(len(p["hero"]["wide"]["group"]), 6)
        self.assertEqual(len(p["hero"]["portrait"]), 10)
        self.assertEqual(len(p["wall"]["order"]), 18)
        self.assertEqual(len({r["id"] for r in p["wall"]["order"]}), 18)
        self.assertEqual(len(p["spiral"]), 10)
        self.assertEqual([r["chars"][0] for r in p["spiral"]], h.CHARS)
        self.assertEqual(len(p["fanart"]["items"]), 15)
        self.assertEqual(len(p["music"]), 7)
        self.assertEqual(len(p["archive"]), 10)
        self.assertEqual(len(p["previews"]), 10)
        self.assertEqual(len(p["loops"]), 9)
        self.assertEqual(len(p["comics"]), 2)

    def test_the_spiral_shares_the_keys_of_the_wall(self) -> None:
        p = picks()
        wall = {r["lib"]["p"] for r in p["wall"]["order"]}
        for r in p["spiral"]:
            self.assertIn(r["lib"]["p"], wall)
        for r in p["hero"]["wide"]["single"] + p["hero"]["wide"]["group"]:
            self.assertIn(r["lib"]["p"], wall)

    def test_the_wall_never_puts_a_pair_next_to_itself(self) -> None:
        order = picks()["wall"]["order"]
        n = len(order)
        for step in (1, 6, 12):
            for i in range(n):
                a, b = order[i], order[(i + step) % n]
                self.assertNotEqual(a["pair"] or "all", b["pair"] or "all", (a["id"], b["id"], step))

    def test_fan_art_is_credited_and_labelled(self) -> None:
        for f in picks()["fanart"]["items"]:
            self.assertEqual(f["canon"], "fan")
            self.assertEqual(f["badge"], "Fan work")
            self.assertTrue(f["credit"]["by"])
            self.assertGreaterEqual(len(f["chars"]), 3)

    def test_cards_are_four_by_five_and_small(self) -> None:
        total = 0
        for c in picks()["hero"]["portrait"]:
            self.assertEqual((c["w"], c["h"]), (960, 1200))
            total += c["bytes"]
        self.assertLess(total, 3_000_000)

    def test_previews_are_four_seconds_and_light(self) -> None:
        total = 0
        for r in picks()["previews"]:
            v = r["video"]
            self.assertEqual(v["w"], 560)
            self.assertAlmostEqual(v["dur"], 4.0, delta=0.1)  # whole frames at 24 fps
            self.assertLessEqual(v["fps"], 24)
            total += v["bytes"]
        self.assertLess(total, 3_000_000)

    def test_trailer_strip_is_the_whole_picture(self) -> None:
        t = picks()["trailer"]
        self.assertEqual({(s["w"], s["h"]) for s in t["strip"]}, {(1280, 538), (1920, 808)})
        for s in t["strip"]:
            self.assertLess(s["bytes"], 4_000_000)
        self.assertEqual(t["film"]["durLabel"], "03:01")

    def test_loops_are_light_and_the_seam_is_close(self) -> None:
        total = 0
        for r in picks()["loops"]:
            if r["video"] is None:
                continue
            self.assertLess(r["video"]["bytes"], 2_100_000, r["slug"])
            total += r["video"]["bytes"]
            sm = L.seam(h.PUBLIC / r["video"]["repo"].lstrip("/"))
            # the step that closes the loop is no bigger than the clip's own biggest step
            self.assertLessEqual(sm["closing_step"], sm["max_step"] + 0.01, r["slug"])
        self.assertLess(total, 14_000_000)

    def test_archive_routes(self) -> None:
        for r in picks()["archive"]:
            self.assertEqual(r["route"], f"/collection/{r['slug']}")
            self.assertGreater(r["count"], 0)

    def test_no_dashes(self) -> None:
        text = (h.DATA / "picks.json").read_text(encoding="utf-8") + (h.DATA / "voices.json").read_text(encoding="utf-8")
        self.assertNotIn("\u2014", text)
        self.assertNotIn("\u2013", text)


class Wall(unittest.TestCase):
    def test_order_function_keeps_its_rules(self) -> None:
        ids = [i["id"] for i in K.SPLASH["items"] if i["canon"] == "official"]
        order = K.wall_order(ids)
        self.assertEqual(sorted(order), sorted(ids))
        self.assertEqual(order, K.wall_order(ids))  # the same every run


if __name__ == "__main__":
    unittest.main()
