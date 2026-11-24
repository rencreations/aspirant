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
