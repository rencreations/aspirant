# Home page tools

Small scripts for looking at the home page (`/`) on a running site, and for serving a build. They were made during the nine rounds of the home rebuild (18 to 21 Nov 2026) and used on every round. They need real Chrome (`channel: "chrome"`), because the site's videos are H.264 and Playwright's bundled Chromium cannot play them. Playwright itself comes from `apps/web`.

All of them take the address of the site as their first argument, so they work on `http://localhost:3000/`, a build served by `scripts/qa/static-server.cjs`, or the live site `https://aspirant.cc/`. `docs/VERIFY.md` says when to use which.

| Script                | What it does                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sheet.cjs`           | Jumps to a list of scroll positions (in screens) with `window.__home.seek`, waits for the actors, takes a screenshot at each and prints which actors are visible.            |
| `arrival.cjs`         | A real fresh visit: the loader, the tap gate ("Touch anywhere to continue") and the intro, shot every 1.5 s. Prints how long the gate took.                                  |
| `sections.cjs`        | Prints the sections, where each starts and how long it is. Run it against the live site to see which build is there.                                                         |
| `failed-requests.cjs` | Walks the page and lists every request that failed or answered 400 or more. A 404 on a `__next.*.txt` file is a framework prefetch and harmless; a failed media file is not. |
| `stitch.py`           | Joins screenshots into one labelled contact sheet so a whole walk can be read in one picture. Run it with the anaconda Python and `-I`.                                      |

Related tools one level up (`scripts/qa/`): `static-server.cjs` (serve a build; it survives the burst of file opens that crashes the `serve` package on Windows), `shot.cjs` (one screenshot of any page), `pending.cjs` (which requests are still pending after N seconds), and the older probes in `probes/` (`home.cjs` and `home-*.cjs`, with their own README).

A typical look at the whole page:

```
node scripts/qa/static-server.cjs apps/web/out 3000
node scripts/qa/home/sheet.cjs http://localhost:3000/ 1440 900 %TEMP%\home-sheet 0,6,13,19,27,34,42,50
python -I scripts/qa/home/stitch.py %TEMP%\home-sheet.png 4 0.4 %TEMP%\home-sheet\s0_1440.png ...
```

Then open the sheet and read it. Looking at the frames yourself is the check: a green test does not say that a scene looks right.

`window.__home` (the probe the page exposes) has `seek(screens)`, `freeze(on)`, `state()`, `plays()`, `snap()`, `skipIntro()`, `lab(name)`, `unpin(name)`, `actor(name)` and `sections()`. `docs/design/home/kernel.md` says what each returns.

## `wheel-track.cjs`: look for a pop in Tetra's body

`node scripts/qa/home/wheel-track.cjs <fromS> <toS> [--back] [--px 40] [--gap 16] [--video dir]` scrolls with a real mouse wheel and records Tetra's channels every frame she is drawn (it hangs a hook on `tweak`), then prints the biggest second difference of each channel and where it was. A smooth swing has a small second difference and a jump has the size of the jump: above about 0.15 radians on a body turn, look at the frames. A `seek` is a jump on purpose, so only a wheel shows a pop. `--video dir` records the run (cut frames with `ffmpeg -i page.webm -vf fps=5 fr_%03d.png`).

## `vanish-track.cjs`: does Tetra vanish while she is on the screen?

`node scripts/qa/home/vanish-track.cjs --base http://localhost:3000/ --turns 36.95,37.35,41.05,41.65,42.55` scrolls down to each turning point and back up (twice) with a real wheel and prints every frame in which Tetra was drawn and the next one she was not while her head was still on the screen (a vanish), and every frame in which her head moved more than 60 pixels (a jump). `--px 120` is a fast wheel. It reads her through `window.__home.peek("tetra")`.

## `speed-track.cjs`: does a hard scroll skip or cut a scene?

`BLIND=70 RANGES="40.8-41.9,42.07-44.31" node scripts/qa/home/speed-track.cjs http://localhost:3000/ 40.2 45.4 150 14 down` scrolls with a real wheel (a deltaY of 150 every 14 ms) and prints every frame in which an actor that was drawn is not, in which the funny words went from 1 to 0, or in which the scene jumped, then the time spent in each range (a section's `topSpeed`, in absolute screens: read them from `window.__home.sections()`). Read the time in a range, not one frame: a stalled headless browser can draw two frames a few milliseconds apart.

## `voices-trigger.cjs`: the voices' way in

`node scripts/qa/home/voices-trigger.cjs http://localhost:3000/` scrolls into the voices section slowly, with a hard flick, with page down keys, upward from the rest, with a hard flick upward, against the play, and by a seek, and prints for each how long the play ran, whether the page moved while it was held, the biggest step of the section's value in a frame and where it ended.

## `flick-walk.cjs`: does a hard scroll skip, cut or break anything?

`node scripts/qa/home/flick-walk.cjs http://localhost:3000/ 32.5 60 flick` scrolls a stretch with a real input and prints, section by section, the scene's top speed (over 50 ms windows, since a headless browser's frame times jitter), every frame in which the scene stepped more than `STEP` screens, every actor that was drawn and then was not, every block of words whose opacity moved more than 0.35 in a frame, and how far the page ran ahead of the scene. Modes: `flick` (400 px every 16 ms), `brisk`, `slow`, `flip` (down, back up, down again) and `touch` (390x844, the browser's own touch flings). `VIDEO=<dir>` records the run and `SHEET=<fps>` cuts it into contact sheets: read them, the numbers flag false alarms too (an actor that leaves the screen counts as hidden, two sections that hand over the same words count as a change). Stop short of the page's end, or the way to About opens.

## `voices-white.cjs`: stop in the white before the voices

`node scripts/qa/home/voices-white.cjs http://localhost:3000/ 30.80` scrolls down through Selena's way out and stops in the white: the voices' way in must start by itself after a moment and play over about two seconds (the value of the play rises frame by frame), not land on its rest.
