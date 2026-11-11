# Arts, Splash art: the reference (east64films.com home)

The owner asked (11 Nov 2026) for `/collection/arts` (Splash art) to copy the home page of <https://www.east64films.com/> "exactly, 1:1" in our design system. Their words are in [`docs/superpowers/specs/2026-11-11-arts-request.md`](../superpowers/specs/2026-11-11-arts-request.md), the plan in [`2026-11-11-arts-redesign.md`](../superpowers/specs/2026-11-11-arts-redesign.md). This file says how the reference works, with measured numbers, so the page can be built without opening it. Frames are in [`collection-reference/east64/`](collection-reference/east64/README.md), named `home-NN-...` here.

Nothing of the reference's code, art, fonts or wording is used. The page is rebuilt with our own code, pictures, type and words. I read the reference's public scripts only to learn the mechanics, and I describe what they do. Numbers marked (code) come from reading it, numbers marked (measured) come from Chrome.

How it was studied: real Chrome through Playwright, at 1440x900, 1920x1080, 1280x720, 1024x768, 2560x1440, 820x1180 and a 390x844 touch phone (2x). Frame sequences came from the browser's own screencast (about 60 frames a second, with timestamps) and from a per frame sampler of the page's transforms. All times below are for a 60 Hz screen unless it says otherwise (see 2.3, this matters).

## 1. What the page is

The home page of the reference is **one fixed screen, not a long page**. The page does not scroll at all: the body is `overflow: hidden` at one screen high, the document height equals the viewport height (measured: 900 at 900), and the smooth scroll library is stopped on this page. A wheel turn, a swipe or an arrow key moves a stack of ten pictures by one place. There are no sections in the DOM. "One image per section" in the owner's words is one picture per step of the stepper.

What is on the screen at rest (1440x900, `home-01`, `home-02`):

| Layer (back to front) | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground                | One flat colour (dark grey, #222). Nothing else: no texture, no grid, no gradient except the bottom fade.                                                                                                                                                                                                                                                                                                                                         |
| Pictures              | A vertical stack of "windows". Each window is a plain rectangle with hard corners and no border, no shadow, no radius. The one in the middle is the current picture. From the second picture on, a part of the previous one shows at the top edge of the screen (the lower 137 px of it, running under the header) and a part of the next one shows at the bottom (its upper 138 px). Only the current one plays (these were short films, muted). |
| Bottom fade           | A static gradient, 260 px high, from the ground colour (opaque at the bottom) to transparent. It sits over the next picture and under the caption, so the next picture rises out of the ground. Nothing fades the top.                                                                                                                                                                                                                            |
| Caption               | Centred under the middle picture, over the top of the next one: the title (44 px condensed serif, two lines: the work and the brand), and under it one line of meta in capitals (client / category, 20 px). Its letters change with a wave (see 2.6).                                                                                                                                                                                             |
| Title list            | Ten rows of small capitals, 23 px apart, crossing the screen at the exact middle, on top of the pictures. The row of the current picture is bright, has a small triangle in front, and the rows around it fade away (1, 0.8, 0.5, 0.2, 0.1). The list slides one row for each step. Columns: number, "Title - Brand", client, category, year.                                                                                                     |
| Header                | Fixed, no background. Left: two lines of small capitals ("creative production company / at Tokyo, Japan"). Centre: the logo. Right: four links (TOP, WORKS, ARTISTS, ABOUT) and "JP / EN". The previous picture runs under it.                                                                                                                                                                                                                    |
| Footer                | Bottom left: "FOLLOW US" and two small icons. Bottom right: a white box with a black triangle and "CONTACT" (90 by 24 px). Only on screens 1024 px wide and more.                                                                                                                                                                                                                                                                                 |
| Cover                 | The first load shows a dark cover (#151515) with one line of text. See 2.9.                                                                                                                                                                                                                                                                                                                                                                       |

What is not there: no page scroll, no scrollbar, no scroll hint, no counter, no progress bar, no custom cursor (the pointer is a plain hand over the current window, the caption and the current row), no hover effect on pictures, no sound. The list of ten is clamped: it stops at the first and the last (measured, `home-03`). It does not loop. **The loop is the owner's addition** (section 3).

The home page has no "sections" in the sense of a long page. The other pages of the reference (the works index, a work, artists, about) are ordinary pages with smooth scroll. The work page matters here because the press on a picture opens it with a morph (section 5), and its "Gallery" of sliding rows is covered by the Scene study. A short note on the works index is at the end (section 8).

### Measured geometry (the reference, desktop)

Everything is a function of the viewport **width**. The stage box is the full width and 16:9 high, centred on the screen. The viewport height only moves the caption (anchored to the bottom) and the centre line.

| Viewport          | Stage box (w x h, top) | Window (visible picture) | Picture behind the window ("pane") | Step (pitch of pictures) | Window parallax | Inner parallax |
| ----------------- | ---------------------- | ------------------------ | ---------------------------------- | ------------------------ | --------------- | -------------- |
| 1440 x 900        | 1440 x 810, y 45       | 726.7 x 417.2            | 1172 x 673                         | 648                      | 126.9           | 127.8          |
| 1920 x 1080       | 1920 x 1080, y 0       | 928.2 x 532.8            | 1497 x 859                         | 864                      | 172.8           | 163            |
| 1280 x 720        | 1280 x 720, y 0        | 659.5 x 378.6            | 1064 x 611                         | 576                      | 108.6           | 116            |
| 1024 x 768        | 1024 x 576, y 96       | 552 x 317                | 890 x 511                          | 461                      | 79.1            | 97             |
| 2560 x 1440       | 2560 x 1440, y 0       | 1196.9 x 687             | 1930 x 1108                        | 1152                     | 230.4           | 210.6          |
| 390 x 844 (phone) | 390 x 219.4, y 312     | 347.6 x 199.6            | 496.6 x 285                        | 274.3                    | 16.3            | 42.8           |

The boxes, windows and panes are measured in Chrome at every size. The two parallax columns are measured at 1440, 1920 and on the phone and computed from the same rules at the others. How they are made (code, checked against the measured numbers):

- Window width: `(817 / 1440 x viewport width + 165 px) x 0.74` on screens 1024 and wider, `x 0.9` below. The window has the ratio 817:469 (1.742). The owner said 16:9, so we use 16:9 (see 2.4).
- Pane: the window is a hole cut (a static `clip-path: inset(...)`) in a bigger picture. The inset is **19 percent** on each side at 1024 and wider and 15 percent below. So the pane is the window divided by 0.62 (or 0.70), and the window shows only the **middle 62 percent of the picture in each direction**. At rest the reference crops each film to its centre. The press then opens the hole, and the rest of the picture is revealed (section 5).
- Step: `stage height x (1 - 0.2)` on screens 768 and wider (the windows are closer than their own height apart: 648 px pitch, 417 px window, a 231 px gap at 1440). On a phone it is `stage height x 1.25` (274 px pitch, 200 px window, a 74 px gap, so three pictures show at once).

## 2. The scroll mechanic

### 2.1 What it is

A **virtual stepper**. One number, `position`, is the place in the list in pictures (0 is the first). Input only changes a `target`. A frame loop eases `position` after `target` and draws everything from `position`. No browser scroll is involved. The reference does this and the smooth scroll library is stopped on this page.

Our site already has the same kind of page: the Films room (`features/library/video/films/`) is fixed to the screen, has `data-lenis-prevent`, takes the wheel, pointer and keys itself on `window` and `root`, keeps one place value (`FilmMotion` in `motion.ts`) and wraps the index with `mod`. **Build the Splash stage the same way: one position value is the one scroll source, and Lenis is not part of it.** Reason: a quantized stepper that also had a native scroll beside it would jitter, and the page has no height to scroll anyway. Use the Films room's recipe: `position: fixed`, `height: 100dvh`, `overflow: hidden`, `overscroll-behavior: none`, `touch-action: none` on the stage, and `preventDefault()` on the wheel (not passive; the reference can use passive listeners only because nothing scrolls under it). Pause Lenis (`useLenis().pause()` and `resume()` on leave) if the provider ever tries to take the wheel.

### 2.2 Input rules (code, rewritten in words)

Wheel (one source, the vertical delta only):

1. A turn with a delta below 4 is ignored.
2. A step fires when the wheel has been idle for more than 120 ms, **or** when this delta is bigger than 0.9 times the biggest delta of the previous 80 ms window. This lets a trackpad swipe give one step: its long tail of shrinking deltas is not "sustained", so it is dropped. A new, harder swipe is bigger than the tail, so it fires.
3. Two steps are at least 200 ms apart. A hard continuous wheel therefore gives at most five steps a second. A flick of twelve events 35 ms apart gave exactly three steps (measured).
4. A step first rounds the target to a whole place, then adds one in the direction of the delta (down is next).
5. The reference reads `deltaY` as it is. In Firefox a notch can be 3 "lines", under the threshold of 4, so it may not step there. We must normalise `deltaMode` (the Films room's `wheelImpulse` does) and ignore `ctrlKey` (pinch). Not tested in Firefox.

Keys: Arrow Down and Arrow Up step by one (default prevented). Enter opens the current picture. We may also add Page Down, Page Up and Space (a step), which the reference does not have.

Touch (see section 6 for numbers): a vertical drag follows the finger up to one step, a release past a short distance commits one step.

### 2.3 The motion (this is the part that is easy to get wrong)

The reference follows its target with **a fixed fraction per frame**: each frame `position` moves 9 percent of what is left (0.09), and snaps to the target when it is closer than 0.05 px (of the 23 px unit, so about 0.002 of a picture). That is frame rate dependent. My traces were recorded in a headless browser that ran frames every 6 ms (165 Hz), so they look 2.7 times too fast. The table is the same rule at 60 Hz, which is what the owner sees on a normal screen (on a 120 Hz screen the reference is twice as fast; we should not copy that):

| Time after the first frame | Fraction of the way done (60 Hz) |
| -------------------------- | -------------------------------- |
| 50 ms                      | 0.25                             |
| 100 ms                     | 0.43                             |
| 150 ms                     | 0.57                             |
| 200 ms                     | 0.68                             |
| 300 ms                     | 0.82                             |
| 400 ms                     | 0.90                             |
| 600 ms                     | 0.97                             |
| 800 ms                     | 0.99                             |
| 1000 ms                    | 0.997                            |

Our version is **frame rate independent**: use `damp(current, target, lambda, dt)` from `@/lib/math` (it is `lerp` by `1 - exp(-lambda x dt)`) with `lambda = 5.66` per second (that is `-ln(0.91) x 60`). It gives the table above on any screen. Stop the frame loop when `|target - current| < 0.002` and nothing else runs, and start it again on input (the reference never stops its loop, we must; the shelf and the Films room render on demand).

Every step is a smooth ease out (fast first, a long soft end). There is no overshoot, no bounce, no snap animation, no time based tween for the stepper.

### 2.4 What moves, and how far (code, verified against the frames)

Let `p` be the position (fractional, in pictures) and `k` the index of a picture. `d = k - p` is its signed offset. `dc` is `d` limited to between -1 and 1.

| Thing                                                          | Rule                                                                                                                                                                                                                                                                                                    | Direction                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window of picture `k` (y from its resting place in the middle) | `d x step - dc x A` where `A` is the window parallax                                                                                                                                                                                                                                                    | Up on a step to the next picture. The window moves 20 percent less than the pitch while it is within one place of the middle (about 521 of 648 px at 1440), then the full pitch.                                     |
| Picture inside its window (the pane)                           | `-sign(dc) x abs(dc)^1.8 x B` where `B` is the inner parallax, rounded to a whole pixel                                                                                                                                                                                                                 | Opposite to the window: a picture arriving from below has its content shifted up by `B` and settles to 0 in the middle. So inside the window the picture moves less than the window does. This is the "reveal" look. |
| Title list                                                     | Slides `1 row` (23 px) up for each step.                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                      |
| Row opacity                                                    | By distance from the current row `r`: `1 - 0.2 r` up to 1, then `0.8 - 0.3 (r - 1)` up to 2, then `0.5 - 0.3 (r - 2)` up to 3, then `max(0.1, 0.2 - 0.1 (r - 3))`. Values: 0 gives 1, 1 gives 0.8, 2 gives 0.5, 3 gives 0.2, 4 and more give 0.1. Written to the row only when it changes by a percent. |                                                                                                                                                                                                                      |
| Active picture                                                 | The one at `round(p)`. It changes **halfway** through a move. The row's bright colour fades over 0.45 s (a plain colour transition) and its triangle fades and slides in 6 px over 0.4 s.                                                                                                               |                                                                                                                                                                                                                      |
| Video                                                          | Only the pictures within one place of the middle load. Only the one within half a place of the middle plays (muted, loop).                                                                                                                                                                              |                                                                                                                                                                                                                      |

`A = max(0, min(0.2 x step, G x (step - window height)))` with `G = 0.55` at 768 and wider, `0.22` on a phone. `B = pane height x inset` (the reference inset: 0.19 or 0.15). Checked at 1440: `A = min(129.6, 0.55 x 230.9) = 127`. Checked on the phone: `A = 16.3`, `B = 42.8`.

Only `transform` is written for motion (the reference does the same for the pictures; its rows write `opacity`). The static clip on the pane is not animated. That fits our rules.

**Decisions for our version (calls made):**

- **Ratio 16:9**, not 817:469 (1.742). The owner said 16:9 and our pictures are cut to it (`frame` in the data). Use the same width formula: `(0.5674 x viewport width + 165 px) x 0.74` (0.9 under 1024), which at 1440 wide is 727 x 409 and at 1920 is 928 x 522, at 390 is 348 x 196. Cap the window height at half the viewport height (the reference breaks on a short window, I did not measure that).
- **A smaller inset: 0.10 on desktop, 0.08 on a phone**, not 0.19 and 0.15. The reference shows only the middle 62 percent of each picture in each direction at rest. The owner asked to keep the crop as small as possible, and art is not film. At 0.10 the window shows 80 percent in each direction, and the press reveals the rest. The cost is a quieter inner parallax: `B` is 51 px at 1440 instead of 128. It is one constant, tune it by eye. (Do not go to 0: with no inset there is nothing to move inside the window.)
- The picture in the pane is the picture's `frame` (the 16:9 cut chosen by the data helper, with its `focus`), scaled to cover the pane. The zoom shows the whole `img` (section 5).
- Window parallax `A` and the pitch follow the same formulas as above with our window size. At 1440: pane 908 x 511, step 648, `A` about 130, `B` 51.

### 2.5 Build recipe (transform and opacity only, one scroll source)

State, all plain numbers in a class like `FilmMotion`: `pos` (float, unbounded), `target`, a running flag, a last-step time, the wheel window, a touch gesture.

Each frame (only while `pos` is not at `target`, or the entrance runs): `pos = damp(pos, target, 5.66, dt)`, snap when close; then for each mounted window `k` write `translate3d(0, y_k, 0)` on the window and `translate3d(0, iy_k, 0)` on its picture (whole pixels); write the list rows' `transform` and `opacity`; if `round(pos)` changed, tell React the new active index (one state change per step, not per frame), which starts the caption change.

DOM: one root (fixed, as in 2.1), a stage layer, `n` window elements (`overflow: hidden` with a static inset clip on an inner pane), the list, the caption, the fades, the chrome. Mount only the windows with `|d| < 2.5` (five) and only the rows within five of the middle. Give the layers `will-change: transform`.

Pictures: use the `p` size (1280) when the pane width times the pixel ratio is 1280 or less, else `f`. Never use `t` in the stage. Decode the pictures one place beyond the ones shown before they are needed (`decode()` on a spare image), or a step will show a blank window.

Accessibility and no-JS: the list is a real ordered list of links in the HTML at build time (the reference has none of this: its list is filled by script). The stage is a region with `aria-roledescription="carousel"` and the caption is a polite live region. Keyboard works without the pointer. The text of the letter wave is split into spans that are `aria-hidden`, with the full title in an `aria-label`.

### 2.6 The caption (text animation)

Each line is split into words, and each word into characters. Every character sits in a mask (`overflow: hidden`, with 0.1 em padding above and 0.2 em below so descenders are not cut) and its inner box moves in `y` only. The order is a **wave from the centre outwards**: each character's delay is `distance from the centre of the whole caption / the largest distance x spread`, so the middle letters go first and the edges last.

| Phase                                                | What                                                | Time   | Easing                    | Wave spread |
| ---------------------------------------------------- | --------------------------------------------------- | ------ | ------------------------- | ----------- |
| Leaving                                              | letters go up out of their masks (to -110 percent)  | 0.28 s | accelerating (power2.in)  | 0.18 s      |
| (the text is replaced when the last letter has left) |                                                     |        |                           |             |
| Arriving                                             | letters come up from below (from +110 to 0 percent) | 0.40 s | decelerating (power3.out) | 0.40 s      |

The change starts when the active picture changes (halfway through the move). The whole thing takes about 1.3 s: 0.28 + 0.18 for leaving, 0.40 + 0.40 for arriving. In the frames (`home-05`) the old title is empty about 0.46 s after the change and the new one is complete about 1.26 s after it. The direction is always the same (out up, in from below), also when the step goes up. If another step comes while this runs, the running animation is cancelled and the letters that are still there leave from where they are. The first caption at page open is only the arriving phase.

The title has two lines (the work, then the brand) and the meta one line: client, two spaces, a slash, two spaces, category. For us: see 4.

### 2.7 Timeline of one step (60 Hz)

| After the wheel | What                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| 0 ms            | The target moves one place.                                                            |
| one frame       | The first frame of motion.                                                             |
| about 120 ms    | The window is halfway: the active picture and row change, the caption starts to leave. |
| about 400 ms    | The pictures are 90 percent there.                                                     |
| about 580 ms    | The old title is gone. The new one starts to arrive.                                   |
| about 800 ms    | The pictures are at rest (99 percent).                                                 |
| about 1400 ms   | The new title is fully in.                                                             |
| 200 ms          | The earliest moment for the next step.                                                 |

### 2.8 Hover and focus

There is almost nothing. The current window, the current row and the caption have a hand cursor and open the work on a press (on 1024 wide and up). There is no hover change of any picture. The only hover effect on the page is on the header links and the contact box: the label rolls (4.3). Nothing has a focus style of its own that I saw.

### 2.9 The opening (what we keep and what we do not)

The reference opens with a dark cover (#151515) over the page with one line of text in the condensed face ("We Create Commercials, Films, ..."). Its letters rise out of their masks (0.6 s power2.out, wave spread 0.4 s, starting 0.25 s after fonts are ready), the line holds 0.6 s, then the cover fades out over 0.6 s (`home-07` shows the line). At the start of that fade the stage is revealed: the whole stage rises 300 px and fades in from 0 to 1 over 1 s (decelerating, power3.out), while `position` glides from 3 to 0 (it starts three places down, the first caption arrives only when it has landed). So the pictures sweep past once, the first one lands, the caption's letters come in (`home-06`).

**Do not copy the cover or its text.** Our site already has its own loading gate and logo curtain that report real work, and a text screen with a fixed length would look like the fake progress the site forbids. Keep **the entrance after the curtain opens**: the stage rises 300 px from nothing over 1 s (decelerating), `position` glides from 3 to 0 with the damp above, and the first caption arrives when it has landed. Start it when the room says it is ready (`expectReady`), not on a timer. Because the glide passes pictures 1, 2 and 3, and the loop shows the last picture as the previous one at the top, **the waited list must hold the pictures at places -1, 0, 1, 2 and 3** (the `p` size, `f` for the first), or one of them will pop in during the entrance.

## 3. The loop

The reference does not loop. Both ends stop (`home-03`: the last picture, with nothing below it). Endless is the owner's request. It costs nothing here because the stage is virtual:

- Keep `pos` and `target` as unbounded numbers. A picture's offset is `d = wrap(k - pos)` where `wrap(x) = x - n x round(x / n)` puts it in -n/2 to n/2. Draw the window of `k` at `d`. Show the index `mod(round(pos), n)` in the caption and the list (the Films room's `mod`, `filmAt` and `rebase` are the model). Nothing is copied and nothing ever jumps: a window leaves at one end while far outside the screen and comes in at the other.
- The list is not one translated strip any more: place each row on its own at its wrapped offset from the middle, and draw only the rows within five (opacity ladder of 2.4, with 0.1 at four, 0.06 at five, then none). Ten ghost rows at 0.1 were fine in the reference with ten works, but with a hundred pictures they would fill the screen with faint text.
- Needs `n` of at least 5. Splash art has far more.

**Does the story landing's trick fit?** No. The landing duplicates its first section at the end of a native scroll and jumps with `lenis.scrollTo(0, { immediate: true, force: true })` when the scroll is within 3 px of the end, so the same frame is on screen before and after. That works for a page with a real scroll height. This page has none, and the stepper has to wrap in both directions, which the duplicate and jump cannot do without a second copy at the top and a lock while it jumps. The modular index does it with no jump at all. If the page were ever rebuilt on native scroll, use the landing's trick, with a copy at each end.

Deep link: `?i=<id>` opens the zoom of that picture and puts the stage on it (a jump of the position, no sweep). The position is not written to the address while stepping.

## 4. Text and navigation blocks

### 4.1 What to keep, what to rename

| Reference                                                                    | Keep                                                         | For our art archive                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title list rows: number, "Title - Brand", client, category, year             | the look, the five columns, the opacity ladder, the triangle | number, title, **characters** (their canon names), **artist** (or "Official" when nothing says who), **year** (leave the cell empty when the data has no date) |
| Caption title, two lines: the work, the brand                                | two lines, centred, the letter wave                          | line 1: the picture's title (short, six words at most). Line 2: the character or characters.                                                                   |
| Caption meta: "client / category" in capitals                                | one line, capitals                                           | "Artist / Splash art", or just "Splash art" when the artist is null. Fan work is not in this room.                                                             |
| Header left: two lines of small capitals ("creative production company ...") |                                                              | the page name, "Official art" and a second line "Splash art" (our bar already shows the page name on the right; see 4.4 for where the rest goes)               |
| Header nav: TOP, WORKS, ARTISTS, ABOUT                                       | the idea: text links with a rolling label                    | the six sub-pages: Splash art, Scene, Comic, Game, Design, Others. The current one is marked with the triangle.                                                |
| "JP / EN"                                                                    | no                                                           | drop it                                                                                                                                                        |
| Footer left: "FOLLOW US" and icons                                           | no                                                           | drop it                                                                                                                                                        |
| Footer right: the white "CONTACT" box                                        | the box                                                      | the takedown line of `core/chrome.tsx` (`TAKEDOWN_URL`), as a quiet box in the same corner. The contract says every page ends with it.                         |
| The cover line                                                               | no                                                           | see 2.9                                                                                                                                                        |

### 4.2 Type and colour in our design system

The reference uses a condensed high contrast serif for the caption (a licensed web font, so it cannot be used), a plain grotesque for the list, nav and boxes, and a warm off white on dark grey.

- **Light, daybreak** (the site's default, and the brief for this task). Ground `--bg`. Text `--text`. Inactive list rows `--text-faint` with the opacity ladder. A static edge fade from `--bg` to transparent, 260 px at the bottom. The write-up works on the dark `storm` theme too: every colour above is a token, so a one line change to `data-theme="storm"` on the room root turns it into the reference's dark look. The owner may ask for that, because the reference's look is dark. I did not pick it because CLAUDE.md says dark is only for the story.
- **Caption:** Instrument Serif (the site's `serif` voice, the closest to the reference's narrow face we have), 46 px over 1.2 for the title on desktop, `clamp(30px, 4vw, 46px)`, regular, centred, a 700 px maximum width. The meta line: the same face in capitals, 20 px over 1.75. Check by eye that it is as dense as the reference; Instrument Serif has a smaller x height, so it may need 48 px.
- **List, nav, boxes:** Hanken Grotesk (the body face), capitals, 13 px for the list, 11 px for the nav, tracking 0 to 0.03 em. Not the mono face: the reference's list is a plain grotesque. Numbers with tabular figures.
- Radius 0 and no shadow, no glow, no gradient except the two edge fades. The pictures have no border.

### 4.3 Hover rolls

Header links and the box roll their label on hover: each letter is in a mask one line high that holds the letter twice, one above the other, and moves up one line (`translateY` from -50 percent to 0 of the pair) in **0.4 s with `cubic-bezier(0.65, 0, 0.35, 1)`**, each letter 0.02 s after the one before (from the left). On leave it rolls back the same way. The box has a 7 px triangle in front of the label (a clipped square). `home-11` shows it. This is the one hover effect, keep it (transform only).

### 4.4 Where our chrome goes

Our top bar is already in the places of the reference's header: the menu and sound buttons on the left, the big logo in the middle, the page name on the right, at `--nav-h` (4 rem, 5 rem wide). The back button (`BackToCollection`) sits under the bar on the left. So:

- **Do not draw a second header.** The previous picture runs under our bar like it runs under the reference's header, but our bar has dark or ink content that would sit on a picture. Add a **static top fade** of the same kind as the bottom one: `--bg` solid for the bar's height, fading to transparent over about 40 px more. It is a deviation: the previous picture's peek shrinks to about 40 to 70 px of visible picture. Without it the bar is unreadable on a dark picture.
- **Sub-page buttons:** bottom left, one row, at the place of "FOLLOW US" (20 px from the left and from the bottom, 16 px between links, the reference's 11 px capitals, rolling labels). Six links of about 80 px fit. The current page has the triangle and `aria-current="page"`. They are `TLink`s (the curtain transition), they are buttons to other routes, not tabs.
- **Takedown:** bottom right, the box of the reference.
- **Back to the collection:** the existing `BackToCollection`, under the bar on the left. On a phone it overlaps the previous picture (its box spans y 76 to 110 and the previous window spans about y 64 to 264), so give it a solid `--bg` plate on this page.
- **Phone:** the six links go in one row at the very bottom (flex, no wrap, the row scrolls sideways with the scrollbar hidden, as the reference does with its works filter), above the safe area. The caption and its button end at 797 of 844, so a row at 806 to 826 fits.

## 5. The cursor and the zoom morph

### 5.1 What the reference has

The home page has **no custom cursor**. The window, the caption and the current row have a plain hand. The closest thing is on the work page, the "Play on Vimeo" cursor (`home-10`): a plain text label with no plate or circle, 11 px capitals, weight 500, white, that follows the pointer with a lag (0.8 s, a decelerating ease on x and y separately, `power3`), fades in over 0.25 s and out over 0.2 s, shows only in the first screen and below the header (roughly the first 70 to 100 px are a dead zone), only on devices that hover, and stays at about 28 px right of and 19 px above the pointer (measured). I did not check whether the system arrow is hidden there. So the "Zoom In" cursor is ours to design. Take from the reference: **a label, not an icon; a lagging follower; a short fade; a dead zone under the bar**.

### 5.2 The cursor we need

Two states: "Zoom In" over the current window, "Zoom Out" over the open picture. Over the previous and next windows nothing (they are not interactive, as in the reference). Nothing on a touch device.

Two ways, for the Zoom helper to choose (it owns `arts/core/zoom/`):

- **A, no shared file changed:** the way the Films room does "Play". Put `data-cursor="Zoom In"` on the current window (and `"Zoom Out"` on the open picture) and `cursor: none` on it. The lantern (`components/lantern-cursor.tsx`) shows a short label in its ring. Cheap, consistent with the site. I do not know whether its label has room for a plus or minus sign.
- **B, its own element:** a small fixed element moved with `transform` only (`z-index: var(--z-cursor)`): an ink plate (`--text` fill, `--bg` text), 28 px high, cut corners, 11 px mono capitals with 0.14 em tracking ("ZOOM IN", with a plus sign in a 12 px square in front of it; "ZOOM OUT" with a minus). It follows the pointer with the reference's lag shortened to about 0.35 s (`damp`, lambda about 9), fades 0.2 s, is centred on the pointer, and hides when the pointer leaves the window or goes over the bar. It needs the lantern to stand down while it shows. The lantern has no switch for that (I read its code), so the main session would add one. No glow.

My pick is A first, B only if the owner wants more than a label.

### 5.3 The morph, as the reference does it

On a press on the current window, caption or row, the page fades out. Then (starting 0.3 s after the press) the picture goes from its window to the work page's full screen media in **1 s with a decelerating curve (`power3.out`, `cubic-bezier(0.165, 0.84, 0.44, 1)`)**. It does this by animating the picture's `left`, `top`, `width` and `height` and, at the same time, its `clip-path` from the window's inset to zero. The caption is carried over and fades 0.3 s after it lands (`home-08`). The picture ends full bleed, cover, so it is cut. The work page then reacts to the first wheel by shrinking the full bleed picture into a frame, 78 percent of the box that fits 16:9 in the viewport, in 1.2 s (`power3.inOut`), and reverses when the page is back at the top (`home-09`). We do not need that second step.

Both `left/top/width/height` and `clip-path` animations break our rules (transform and opacity only). We map it to the story morph.

### 5.4 The morph, in our rules

Use the idea of `features/story/morph/morph-math.ts`: the visible window is **two nested clips that only translate** and the picture is a layer that only translates and scales, so nothing is stretched and every layer is linear in the eased progress. Two keyframes per layer and one easing give the exact picture at every frame (`windowFrames`, `clipLayers`, `composeLayers`, `place`). Reuse those functions as they are.

- **From:** the window rect of the current picture on screen, read at the press (the stage may still be moving, use the live position: window `y = vh/2 + d x step - dc x A - window height / 2`). The content is the picture's `frame` region covering the pane: scale `s0 = pane width / frame width in picture pixels`, placed so the frame fills the pane, plus the inner shift `iy`.
- **To:** the whole picture contained in the viewport: scale `f = min(vw / picture width, vh / picture height)` (it is fit **width** for the usual wide picture, and fit height only when the picture is taller than the screen at fit width, so nothing is cut). The window is the picture's own box: `Fw = picture width x f`, `Fh = picture height x f`, centred. The content is placed at its top left with scale `f`.
- **Size and easing:** about 0.9 s to open and 0.7 s to close, both with the reference's curve above (a fast start and a long soft landing). Close goes to the window of the same picture at the stage's _current_ place.
- **Around it:** the rest of the stage (list, caption, neighbours, fades, sub-page buttons, takedown) goes to opacity 0 within the first 0.25 s (opacity only) and comes back in the last 0.3 s of the close. The ground stays `--bg`, so the zoom is a clean page. Hold the stage: the wheel, keys and swipes do nothing while open. Esc, a press anywhere, the browser's Back and (on touch) a tap close it.
- **Picture:** make the overlay from the same `f` file the stage already decoded, so there is no flash. If `f` has not arrived, show `p` and swap when `f` is ready (the Zoom helper's load rule).
- Nothing of this may write per frame to `html` or `body`.

## 6. The phone (390x844, touch, measured and read)

| Thing      | Reference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header     | The logo at the left (20, 28; 102 x 33). A two bar menu button at the right (32 x 7 at x 338, y 30). It opens a full screen menu on the ground colour: TOP, WORKS, ARTISTS, ABOUT in the condensed face at 32 px, centred, then three small links, "JP / EN" and a copyright line. The links rise out of masks (translate from 110 percent, 0.5 s, 0.1 s delay). The bars cross into an X.                                                                                                                                  |
| Stage      | Window 347.6 x 199.6 (89 percent of the width), pitch 274 px, so **three pictures show at once** (previous at the top, current in the middle at y 422, next under the caption). The title list is not shown (it is `display: none` under 1024 px). The footer is not shown.                                                                                                                                                                                                                                                 |
| Caption    | Title 30 px over 37.5, at most 332 px wide, meta 18 px over 31.5 with 16 px under it, then a white box "VIEW MORE" (13 px, 4 px 8 px padding, a triangle in front), all centred, the box ending 47 px above the bottom.                                                                                                                                                                                                                                                                                                     |
| Open       | **A tap on the picture does nothing.** Only the "VIEW MORE" box (or Enter) opens the work. The picture is not a button on touch.                                                                                                                                                                                                                                                                                                                                                                                            |
| Touch step | Vertical only. A touch with more than one finger cancels. A dead zone of 6 px. While the finger is down the target follows it at half the finger's distance in "row" units, limited to one place, so one place is reached after about 52 px of finger movement (46 plus the dead zone) and then it holds there (it feels like a quick peek). On release, a move of more than 16 px commits one step in the direction of the move, less goes back (`home-13`, `home-14`). There is no inertia and no flick beyond one place. |
| Gaps       | The step uses a phone spacing (a positive gap of 25 percent of the stage height, against the desktop's overlap of 20 percent). Window parallax 16 px, inner parallax 43 px.                                                                                                                                                                                                                                                                                                                                                 |
| Tablet     | Between 768 and 1023 px the desktop spacing (overlap) and the phone style (no list, "VIEW MORE" shown, 0.9 window factor, 0.15 inset) are used together (820 x 1180, `home-15`). The window is 567 x 325 there.                                                                                                                                                                                                                                                                                                             |

Our changes, on purpose:

- **A tap on the picture zooms.** The contract says tap to zoom and tap to close, and a hidden affordance is bad on touch. Keep the reference's box under the caption and label it "Zoom In" (the cursor label does not exist on touch). Both work.
- A phone has more room than the reference uses for the caption. Keep its numbers.
- `touch-action: none` on the stage and `overscroll-behavior: none` on the root, so a pull does not refresh the page in Chrome on Android. Not tested on a real phone.
- The sub-page row and the back button: see 4.4.

## 7. What the owner would notice if we got it wrong

1. **One picture per wheel notch.** Not a free scroll. A trackpad swipe is one step, not eight. The ease is soft and long, about 0.8 s.
2. **The window is a porthole**, about half the screen wide, not a full width banner. The previous picture shows at the top and the next at the bottom, **the next one under the caption**, rising out of a fade.
3. **The picture moves inside its window the opposite way** and slower than the window. A flat slide with no inner motion looks dead.
4. **The title list in the middle of the screen**, ten rows, the current one bright with a triangle, the others fading 1, 0.8, 0.5, 0.2, 0.1. The list slides 23 px a step, not the whole picture pitch.
5. **The letters of the caption** leave upward from the middle outward and arrive from below the same way. They do not fade and do not slide as one line.
6. **The caption changes halfway through the move,** not at the end.
7. **The entrance:** after the curtain, the stage rises and glides in from three places down, then the title arrives. It is not a still image that fades in.
8. **The press opens a window to the full picture,** not a lightbox that pops in. The window grows in a smooth long ease, and the other things fade.
9. **No page scroll, no scrollbar, nothing at the foot of the page.** The corners hold small items: the sub-page links and the takedown box.
10. **The header and footer labels roll** letter by letter on hover.
11. **On a phone three pictures are on screen** and a drag moves them with the finger up to one place.
12. **No loading text screen.** The reference has one, we deliberately do not (2.9). Mention it if the owner asks why.
13. **Deliberate differences from a 1:1 copy** (the owner can reverse them): daybreak ground instead of the dark one; 16:9 windows and a smaller crop (inset 0.10); the top fade under our bar; sub-page links at the bottom left; tap to zoom on a phone; the loop.

## 8. The works index (the other list page), two paragraphs

`/works/` is an ordinary scrolling page (smooth scroll on). At the top left is the filter row: a bright "ALL WORKS" lead item with a one pixel line above it, then eight small grey capitals (Music Video, Official Video, Ads, Brand Movie, Event, Fashion, Interview, Media), 11 px, 25 to 34 px apart, one line that scrolls sideways on a phone with its scrollbar hidden; the one in use is white. Below it the works are a grid of **four columns on 1024 and wider (two on a phone)**, 20 px between columns and 48 px between rows, each a 16:9 thumbnail (334:188) with a title and "Category / Year" under it. On hover a muted video fades over the thumbnail in 0.3 s and plays, and stops and rewinds on leave (`home-16`). It is a "wall", not the stepper: that is the difference from the home page. For the Scene, Game, Others and Fanart rooms it shows how plain the chrome should be: one filter row, one grid, no extra labels.

The work page's Gallery (two rows of pictures that slide sideways with the page's scroll, one to the left and one to the right, measured at two rows of 18 pictures, 254 px high, 1440 wide) is the model for the flow rooms. It is a separate study.

## Not checked

- Firefox and Safari, a real phone, a short window (for example 1440 x 600), and a 120 Hz screen. The wheel on Firefox (line mode) is read from the code only.
- Whether the system arrow is hidden under the work page's label cursor.
- The reference's other pages beyond the works index and one work page.
- Behaviour of the reference at widths between 600 and 1023 with a wide short window (only 1024 x 768 and 820 x 1180 were looked at).
- How our dark theme looks with these rules. The tokens support it, I did not build anything.
