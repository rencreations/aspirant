# East64 Gallery rows: how they move and how we build them

The owner asked (11 Nov 2026) for Scene, Game, Others and Fanart to be "a flow of images": rows that slide sideways with the scroll, one way going down and the other way going up, row after row. The reference is the Gallery section of <https://www.east64films.com/works/hodinkee-x-g-shock/>. This file says exactly how that section works, with measured numbers, and how our page does the same for any number of rows and up to 600 pictures. The owner's words are in `docs/superpowers/specs/2026-11-11-arts-request.md`. The contract for the Flow code is in `2026-11-11-arts-redesign.md`. The frames and charts are in `docs/design/collection-reference/east64-gallery/` (its README lists them). The home page of the same site is studied in `docs/design/arts-reference.md`.

Measured on 11 Nov 2026 in a real Chrome (Playwright, channel `chrome`) at 1440x900, 1920x1080 and 390x844 touch. The reference's code was read to learn the mechanics. Our page is our own code: nothing of the reference is copied, and this file describes it in words.

## 1. The short version

- Every row is one strip of pictures at the same height, with the same gap between pictures and between rows, and no side padding. The strip is far wider than the screen and sits inside a box that clips it.
- The strip moves with `translateX` only. Its position is a straight line of the page scroll. It has no easing and no clock of its own: when the scroll stops, the rows stop. Scrolling back retraces the path exactly.
- Row 1 moves right while the visitor scrolls down. Row 2 moves left. The next one moves right again. Scrolling up reverses each of them.
- A row travels only a part of its own length. A few hundred pixels of a long strip slide through the screen.
- The reference has no hover state, no cursor change, no link and no lightbox on its gallery. The outline, the cursor and the zoom are ours.
- The reference has two rows. We need up to about 300. So each of our rows gets its own scroll window, the position of every row comes from the data and not from the DOM, and only the rows near the screen exist.

## 2. What the reference does

### 2.1 Structure

In words, from its markup and styles:

- The section holds a centred title ("Gallery", 24 px, 20 px on a phone, 33 px above the rows) and a column of rows. The section clips its content. It has a margin of 300 px above and 160 px below (100 px and 124 px under 1024 px wide).
- The column is a flex column. The gap between rows is 40 px (20 px under 1024 px wide).
- A row is a full width box that clips its content. Inside it is one track: a flex strip as wide as its pictures, marked as moving (`will-change: transform`).
- A picture is a flex item that never shrinks, with a right margin of 40 px (20 px) and a height of `clamp(160px, 22vw, 254px)`. The image fills that height and has automatic width, so it keeps its own ratio. The margin is also on the last picture.
- There are two rows, marked "left to right" and "right to left". The set of pictures is written twice in each track (the second copy hidden from screen readers). Row 2 usually holds the same pictures in reverse order (on a few pages a different order). On the 12 works pages that have a gallery the count is always 2 rows of 6 to 10 pictures.
- The pictures are lazy (`loading="lazy"`) and carry no width or height attribute.

### 2.2 Motion

A scroll library (GSAP ScrollTrigger) ties each track's `translateX` to the scroll in "scrub" mode: the value follows the scroll position directly, with no smoothing and no easing of its own.

- The trigger is the whole Gallery section. The motion starts when the top of the section meets the bottom of the screen and ends when the bottom of the section meets the top of the screen. The pass is therefore the section height plus the screen height.
- Row 1 goes from minus 0.2 D to 0. Row 2 goes from 0 to minus 0.2 D. D is half of the track's width, that is the width of one set of pictures, margins included. So the travel is 20 percent of one set's width.
- D is read when the page measures itself (at load, on a resize), not on every frame.
- Outside the pass the value stays at its end. Under the system's "reduce motion" setting the gallery does not move at all, and the smooth scroll is switched off too.
- The smooth scroll under it is Lenis 1.3 with a duration of 1.1 s and smooth wheel on, driven by the GSAP ticker. Each Lenis scroll event updates the scroll library. On touch the page scrolls natively.

### 2.3 Measured values

Rows follow the scroll in a straight line. Over about 900 frames per run (one sample on every animation frame, 6 ms apart) the row position fits a straight line of the scroll with a worst error of 0.001 px, so the rows have no lag of their own. See `mapping.png`.

| Value                                       | 1440x900                                                  | 1920x1080               | 390x844 touch                   |
| ------------------------------------------- | --------------------------------------------------------- | ----------------------- | ------------------------------- |
| Row height                                  | 254 px                                                    | 254 px                  | 160 px                          |
| Gap between pictures and between rows       | 40 px                                                     | 40 px                   | 20 px                           |
| Picture width (668x376 source, 16:9)        | 451.25 px                                                 | 451.25 px               | 284.25 px                       |
| One set of 9 pictures with margins (D)      | 4421.25 px                                                | 4421.25 px              | 2738.25 px                      |
| Track width (set twice)                     | 8842.5 px                                                 | 8842.5 px               | 5476.5 px                       |
| Section height (title, 33, two rows, gap)   | 625.25 px                                                 | 625.25 px               | 409.88 px                       |
| Pass (section plus screen)                  | 1525.25 px                                                | 1705.25 px              | 1253.88 px                      |
| Travel the code intends (0.2 D)             | 884.25 px                                                 | 884.25 px               | 547.65 px                       |
| Speed the code intends, px per px of scroll | 0.580 (measured 0.5799)                                   | 0.519 (measured 0.5187) | 0.437 (measured 0.4368)         |
| Row 1 at the start of the pass              | translateX -884 (first picture 884 px left of the screen) | -884                    | -548                            |
| Row 1 at the end of the pass                | 0 (first picture flush with the left edge)                | 0, but see below        | 0                               |
| Row 2                                       | the mirror: 0 at the start, -884 at the end               | the same                | 0 at the start, -548 at the end |

Other facts:

- The rows bleed off both sides of the screen. There is no side padding. A picture is cut by the screen edge for most of the time.
- At 1920x1080 the page is not long enough for the whole pass: the scroll stops at 3680 px while the pass ends at 3752 px, so the rows stop at -37 and -847 instead of 0 and -884. Rows do not always reach their ends.
- The two rows are in step, mirrored around their middle. At the middle of the pass both are at -442. Adjacent rows are 294 px apart (254 plus 40).
- The two ends of the travel are reached when the section is just off screen (its top at the bottom of the screen, its bottom at the top). Nobody sees them. The positions a visitor sees are in the middle part of the pass. See `1440-pass-states.jpg`.
- One wheel notch of 100 px under Lenis: the page gains 29 px in 55 ms, 50 px in 110 ms, 75 px in 220 ms, 90 px in 380 ms and 100 px at about 820 ms. That is an exponential ease out over 1.1 s (`mapping.png`, right). The rows follow the page's scroll, so they follow this curve.
- Nothing is time based. There is no marquee loop. The "ltr" and "rtl" classes only tell the direction of the scrubbed move.

### 2.4 The travel is not constant: two values to pick from

The code intends a travel of 20 percent of one set's width: 0.58 px per px of scroll at 1440. What a visitor gets depends on how many pictures had loaded when the page last measured its tracks, because a picture that is still lazy has zero width.

| Case                                                  | Travel at 1440x900 | Speed, px per px |
| ----------------------------------------------------- | ------------------ | ---------------- |
| Page just loaded (one picture counted per row)        | 162 px             | 0.11             |
| First visit, first run (two pictures per row counted) | 252 px             | 0.17             |
| First visit, second run (about 6 pictures counted)    | 585 to 613 px      | 0.38 to 0.40     |
| Every picture loaded, then measured again             | 884 px             | 0.58             |

At 1920 a first visit gave about 760 px (0.45) before the page end cut the pass. On the phone a first visit gave 548 px (0.44). So the live gallery moves between 0.11 and 0.58 px per px, and whatever the owner saw was in that range. `1440-first-visit.jpg` and `1440-scroll-down.jpg` show the two ends.

**Our call:** one named constant, `FLOW_SPEED_GOAL = 0.4` px of sideways travel per px of scroll. It is the middle of what the live page showed (second first-visit run, 0.38 to 0.40), between the quiet 0.17 and the code's intent of 0.58. Rows deviate from it (section 4.2). With our real pictures they land between 0.2 and 0.9. That is inside what the reference does.

### 2.5 What the reference does not have

Checked in the browser (pointer over a picture, then a click):

- No hover state: the cursor stays `auto`, no outline, no transform, no opacity change.
- Not a link, no lightbox, the address does not change on a click.
- No custom cursor on the gallery (the site has one on its hero only).

All of that is ours to design: the outline on hover, the "Zoom In" cursor and the morph. See the zoom contract.

### 2.6 Faults of the reference that we must not copy

1. **Pictures with no size.** A lazy picture has zero width until it loads. The strip is shorter than it should be, and the travel is measured from that. Our pictures get their width from the data before they load.
2. **A set written twice.** It only makes the track long enough. With 600 unique pictures a repeated picture would be noticed. We never repeat a picture.
3. **A pass that includes the time the section is off screen.** The ends of the travel are never seen. In ours a row travels while at least half of it is on screen.
4. **Ends not reached.** At 1920 the page ended 72 px before the pass did, so the rows stopped short. In ours the rows at the foot of the page would do the same and their last pictures would never show. 4.4 ends each row's window at the end of the page for that reason.
5. **Reduce motion switches it off.** Ours does not read that setting (owner decision, 1 Nov 2026).
6. **On a phone the scroll library ignores a resize that changes nothing.** A measurement taken early stays. Ours measures from data and has nothing to go stale.

## 3. What changes for our page

The reference has one trigger for two rows. With 100 or more rows one shared trigger would give each row a tiny share of motion, and the rows far down the page would never be at the right place. So:

- **Each row has its own scroll window.** A row slides while it crosses the screen, from the moment it is half in (its middle at the bottom edge) to the moment it is half out (its middle at the top edge). That is exactly one screen of scroll (`vh`). The formula is in 4.4.
- **Positions come from the data, never from the DOM.** Each picture's width is the row height times its ratio (`img.w / img.h`, the whole picture, never cropped). A row's content width, its travel and the top of every row are plain arithmetic. No `getBoundingClientRect` in the scroll path, no stale measurements, and the virtual list is trivial because every row has the same pitch.
- **Every picture is unique and reachable.** The number of pictures in a row comes from their widths (section 4.2). A picture is never repeated and never placed where the row cannot show it.

## 4. Build recipe

### 4.1 Constants

| Name              | Value                                       | Where it comes from                                                                                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ROW_H`           | `clamp(160, 0.22 * vw, ROW_H_MAX)` px       | The reference's own rule. 254 on a laptop or larger, 160 on a phone. `ROW_H_MAX = 254`.                                  |
| `GAP`             | 40 px from 1024 px wide, else 20 px         | The reference. It is the gap between pictures and also between rows (one number, so "the same padding" holds both ways). |
| `SLIDE`           | `vh` (the large viewport height)            | One screen of scroll, while at least half of the row is on screen.                                                       |
| `FLOW_SPEED_GOAL` | 0.4                                         | Section 2.4. Goal travel is `0.4 * SLIDE`.                                                                               |
| `FLOW_SPEED_MIN`  | 0.2                                         | Floor for a full row. A row that cannot slide at least `0.2 * SLIDE` takes one more picture.                             |
| `HEAD`            | set by the chrome (search, filter, buttons) | Space above row 1. 200 px on a laptop is enough for the bar and the filter. Row 1 is the first thing under it.           |
| `OVERSCAN`        | 0.75 `vh` above and below                   | How far from the screen rows are mounted (4.6).                                                                          |

All of them are named constants in one file (`arts/core/flow/layout.ts`), so the owner can tune by eye in one place. The reference's own row height (254) was kept. Real Scene pictures are wide (372 of 617 are 2.37:1), so at 254 px a row holds 3 of them at 1440. If the owner wants 4 or more per row at 1440, lower `ROW_H_MAX`: at 200 the same Scene data gives 4 to 8 per row (4 at the median, pictures 21 percent smaller).

### 4.2 Sizing a row from a list of ratios

Input: the pictures in display order, each with `ratio = img.w / img.h`. Output: rows, each with the pictures it holds, its `content` width and its `travel`.

A picture's width is `ROW_H * ratio`. The content of a row is the sum of its picture widths plus `GAP` between them (no gap after the last one). The row slides `travel = max(0, content - vw)` px. That is exactly what makes sliding safe:

- At the start of the slide the screen shows the strip from 0 to `vw`. At the end it shows `travel` to `travel + vw`, which is `content`. At no point does the screen show anything outside the strip. **No empty edge can appear.**
- Everything in the strip is seen at some moment, so **no picture is lost**.

How many pictures a row takes (greedy, in order, nothing is reordered, nothing is repeated):

1. Take pictures one by one until `content - vw >= FLOW_SPEED_MIN * SLIDE`.
2. Look at one more picture. If adding it brings `content - vw` closer to `FLOW_SPEED_GOAL * SLIDE`, take it.
3. Close the row and start the next one.

```ts
// Our own sketch. vw and vh are the viewport width and the large viewport height.
const rowH = clamp(0.22 * vw, 160, ROW_H_MAX);
const gap = vw >= 1024 ? 40 : 20;
const goal = FLOW_SPEED_GOAL * vh;
const floor = FLOW_SPEED_MIN * vh;

function planRows(items: { ratio: number }[]) {
  const rows: { from: number; to: number; content: number; travel: number }[] = [];
  let i = 0;
  while (i < items.length) {
    let content = 0;
    let k = 0;
    while (i + k < items.length) {
      content += (k ? gap : 0) + rowH * items[i + k].ratio;
      k++;
      if (content - vw >= floor) break;
    }
    const filled = content - vw >= floor;
    if (filled && i + k < items.length) {
      const more = content + gap + rowH * items[i + k].ratio;
      if (Math.abs(more - vw - goal) < Math.abs(content - vw - goal)) {
        content = more;
        k++;
      }
    }
    rows.push({ from: i, to: i + k, content, travel: Math.max(0, content - vw) });
    i += k;
  }
  return rows;
}
```

Special rows:

- **A row that cannot fill the screen** (the last row, or a short filter result): if `content < vw` it is static. It is centred (`translateX = (vw - content) / 2`) and does not slide. If `vw <= content < vw + floor` it slides a little. It never shows an empty edge.
- **A picture wider than the screen** (a 5:1 strip on a phone): it is shown at the row height, whole, and slides like any other. It can be seen whole only in the zoom.
- **A tall sliver** (ratio 0.45): 114 px wide at 254 px. Fine as it is.

The count per row is a result, not a setting. How it comes out for one ratio (rows of 40 equal pictures):

| Ratio  | 1440x900 (row 254)             | 1920x1080 (row 254)            | 390x844 (row 160)             |
| ------ | ------------------------------ | ------------------------------ | ----------------------------- |
| 16:9   | 4 pictures, travel 486 (0.54)  | 5 pictures, travel 498 (0.46)  | 2 pictures, travel 199 (0.24) |
| 2.37:1 | 3 pictures, travel 446 (0.50)  | 4 pictures, travel 608 (0.56)  | 2 pictures, travel 388 (0.46) |
| 1:1    | 6 pictures, travel 284 (0.32)  | 8 pictures, travel 392 (0.36)  | 4 pictures, travel 310 (0.37) |
| 4:5    | 8 pictures, travel 466 (0.52)  | 10 pictures, travel 472 (0.44) | 5 pictures, travel 330 (0.39) |
| 9:16   | 10 pictures, travel 349 (0.39) | 13 pictures, travel 417 (0.39) | 7 pictures, travel 360 (0.43) |

The speed goes up and down with the pictures' widths because a picture is a whole step. Rows of one repeating ratio get one repeating speed. That is how the reference behaves too, since its travel is 20 percent of the content.

`planRows` is a pure function. It has a unit test with these cases: the invariants below, 0, 1, 2, 3 and 17 pictures, all narrow, all wide, one very wide picture.

Invariants (checked by brute force on the five real data sets in section 5 and on the odd cases):

- For every scroll position, the screen window `[-x, -x + vw]` lies inside `[0, content]` whenever `content >= vw`.
- Every picture no wider than the screen is whole inside the screen window at some scroll position of its row's slide (the left-moving rows on the first screen are the one exception, 4.4).
- Every input picture is placed in exactly one row.

### 4.3 Where rows sit and how the page is built

- Row `r` (0 based) has `rowTop(r) = HEAD + r * (rowH + gap)`. The pitch is constant. Page height is `HEAD + n * (rowH + gap) - gap + FOOT`.
- A spacer `div` with that height makes the page. Mounted rows are absolutely positioned at `top: rowTop(r)` (a static position, never animated).
- Each row is `position: absolute; left: 0; width: 100%; height: rowH; overflow: clip; contain: layout paint;`. Inside is the strip: `display: flex; gap; width: content` with a fixed width and height on every picture.
- **Use `overflow: clip`, never `overflow: hidden`, on rows and on the page wrapper.** A box with `overflow: hidden` is a scroll container: when a picture inside takes keyboard focus, the browser scrolls that box sideways to show it, and the row jumps away from the position we computed. `clip` cannot be scrolled. The wrapper also needs `overflow-x: clip` so a page never gets a horizontal scrollbar.
- Row 1 is the first row under `HEAD`. At scroll 0 it is already part way through its slide (about 0.6), so its first picture is partly cut on the left. That is expected and the same as the reference.

### 4.4 From scroll to position

Row `r` slides while it crosses the screen, from the moment it is half in to the moment it is half out. Progress:

```
start = rowTop + rowH / 2 - vh                 // the row's middle is at the bottom edge of the screen
end   = min(rowTop + rowH / 2, maxScroll)      // its middle is at the top edge, or the page ends first
q = clamp((scrollY - start) / (end - start), 0, 1)
x = (r % 2 === 0) ? -travel * (1 - q)          // moves right while scrolling down
                  : -travel * q                // moves left while scrolling down
if (content < vw) x = (vw - content) / 2       // short row: static and centred
x = Math.round(x * dpr) / dpr                  // a whole device pixel, so pictures stay sharp
```

`maxScroll` is the page height minus `vh`. The `min` is for the rows at the foot of the page. Without it the page would end while the last rows are about halfway through their slide, and the last pictures of those rows could never be reached. With it they finish their slide as the page ends, a little faster than the rest (at most about twice as fast for the very last row, over the last screen of scroll). The first rows are the opposite case and are left alone: at scroll 0 they are already part way in (about 0.6 for row 1), like the reference. A row that moves left on the first screen therefore never shows the first 30 percent of its travel, about 140 px of its first picture's left side. The zoom shows it whole.

- It is a pure function of `scrollY`: scrolling up retraces exactly.
- Row 1 (`r = 0`) moves right when the visitor scrolls down, as the reference's first row does. The direction is by the row's index in the current list, so after a filter row 1 is again the one that moves right.
- At `q = 0` the row is half in at the bottom. At `q = 1` it is half out at the top. The ends of the strip are seen while half or more of the row is on screen. In the reference the ends are reached only when the section is gone.
- The row at the middle of the screen is at `q` about 0.5, halfway through its travel. Neighbours are offset by `pitch / vh` of the travel (about 0.33 at 1440x900), in opposite directions. `plan-scene-1440.png` shows it.
- Write `style.transform = translate3d(x px, 0, 0)` on the strip. Animate nothing else.

### 4.5 One scroll source

The site scrolls the window with Lenis (`components/smooth-scroll.tsx`, `lerp: 0.12`, `syncTouch: false`), so `window.scrollY` already holds the smoothed position. Read it and nothing else.

- Add one passive `scroll` listener on `window` (as `useScrollProgress` in `lib/hooks.ts` does), coalesced into one `requestAnimationFrame`. Read `window.scrollY` once there.
- Do not subscribe with `getLenis()?.on("scroll", ...)` in an effect of the flow component: React runs child effects before parent effects, and `SmoothScrollProvider` creates Lenis in a parent effect, so `getLenis()` may still be `null` on a first load. The window event works everywhere (a phone scrolls natively and fires it too).
- The rows are at most one frame behind the page. A page scrolling 40 px a frame (2400 px a second) leaves a row 16 px behind sideways at 0.4 px per px. Nobody can see that.
- The feel of the smoothing differs a little from the reference (Lenis with `lerp: 0.12` here, a 1.1 s ease out there). Both settle in about half a second. Leave it as the site has it.
- Do not add a ScrollTrigger per row (hundreds of triggers). Do not run a second smoothing on top of Lenis. Do not add a frame loop that runs when nothing scrolls.
- On every event: compute the mounted range (4.6), set the transform of each mounted row. That is about 9 to 13 writes. No layout reads.

### 4.6 Virtualization

Only rows near the screen exist. 600 pictures are 150 to 300 rows, tens of thousands of pixels tall.

- Mount row `r` when `rowTop(r) + rowH >= scrollY - 0.75 * vh` and `rowTop(r) <= scrollY + 1.75 * vh`. That is about 9 rows (about 30 pictures) on a laptop and about 13 rows (30 to 50 pictures) on a phone, whatever the total.
- Compute the first and last mounted index from `scrollY` by arithmetic (the pitch is constant). Put them in React state only when they change. Row components are memoised and render the same markup every time. Their transform is written by ref.
- A row that mounts has its transform set in a layout effect from the current scroll, before the first paint. No jump, no flash at `x = 0`.
- Rows leave the DOM when they leave the window. No placeholder is needed, the heights are fixed.
- A fast fling can mount and unmount many rows. Each picture's request starts on mount. Start the pictures of a row after it has stayed mounted for about 120 ms, so rows that fly by are never requested. This is a scroll debounce, not progress.
- Keep the rows' pictures out of the loading bar: only the first screen goes in the room's `preload.ts` (4.8).

### 4.7 Order, filters, search, resize

- **Order.** Rows follow the order of the data in the current list, top to bottom, left to right. The order of the list belongs to the room (for example by place count, then by date). The flow never shuffles and never reorders to fill a row. A picture's row changes when the list changes.
- **Filter or search change.** The list is new, so `planRows` runs again and every old row leaves. Scroll to the top in the same frame (`scrollTo(0, { immediate: true })` from `useLenis`, because positions mean nothing after the list changed). Row 1 is the one that moves right again. Fade the whole flow in with `opacity` over 150 to 250 ms. Do not slide pictures from their old places to the new ones (hundreds of pictures, no way to make it smooth).
- **Count check.** The filter chips show counts. The number of pictures placed in the rows is the length of the list, always. The unit test checks it.
- **Resize.** Run `planRows` again when the width changes (debounce 150 ms), because the row height, the gap and the widths change. Keep the anchor: take the picture in the row at the middle of the screen before, and after the new layout scroll so that its row is at the same place. A change of height only (a phone's address bar) must not re-plan: use the large viewport height (`100lvh`, measured once from a hidden element) for `vh` everywhere in this file. On a laptop it equals `innerHeight`.
- **Back and reload.** The layout is a pure function of the list and the width, so a restored scroll position puts every row where it was.

### 4.8 Pictures

- Every picture box has its final width and height before anything loads (`ROW_H * ratio` by `ROW_H`), and its dominant colour `img.c` as the background while the file loads. The picture fades in with `opacity` when it has loaded. Never leave a zero-size box.
- Use `srcset` with the real widths of the two small files and `sizes` set to the picture's CSS width, so the browser picks by the display (`t` is 480 on the long side, `p` is 1280). A 2.37:1 picture at 254 px high is 602 px wide. Its `t` file is 480 px wide, which is already short at pixel ratio 1 and less than half of what a pixel ratio 2 screen needs. With `srcset` the browser takes `p` there and keeps `t` for narrow pictures (a 9:16 picture needs only 143 px of width). Pick by the display only, as the site allows. `f` is only for the zoom.
- No `loading="lazy"`: mounting is the lazy mechanism. Add `decoding="async"`, `draggable="false"`, and the item's `alt`.
- The first screen is the only part in the loading list: the data file, the chunk, and the pictures of the rows that cover `[0, vh]`. `planRows` gives them (rows 0 to `ceil((vh - HEAD) / pitch)`), computed with `innerWidth` and `innerHeight` at that moment. The rest loads as rows mount.

### 4.9 Hover, zoom, deep link, keyboard

- Each picture is a `button` (the zoom target). Hover and `:focus-visible` draw `outline: 2px solid <accent>; outline-offset: -2px`. The offset is negative so the row's clip cannot cut the outline. Hover only under `@media (hover: hover)`. No scale on hover, no `filter`.
- The cursor ("Zoom In") belongs to the zoom code. It reads the pointer over any picture.
- When the zoom opens, the page's scroll is paused (`pause()` from `useLenis`), so no row moves while the picture morphs. The morph starts from the picture's rect. That rect can be partly or wholly outside the screen horizontally (the row clips it), so the zoom code clamps its start to the screen.
- **Deep link `?i=<id>` and the search overlay.** Find the picture's row `r` and its centre `c` in the strip. Choose `q` so that the picture's centre lands in the middle of the screen and keep it between 0.25 and 0.75:
  - for a row that moves right: `q = 1 - (c - vw / 2) / travel`; for a row that moves left: `q = (c - vw / 2) / travel`;
  - then `scrollY = rowTop + rowH / 2 - vh + q * vh`, set immediately, and the zoom opens after the row has mounted.
  - If `travel` is 0 the row is static and any `q` works.
- **Keyboard.** The Tab order is the DOM order. When a picture takes focus and is off screen, scroll with the same formula (do not let the browser do it, `overflow: clip` stops it). Esc closes the zoom (zoom code).

### 4.10 Phone (390x844)

- Same recipe, with `ROW_H = 160` and `GAP = 20` (the reference does the same). 22vw would be 86 px, so the 160 floor decides. A 2.37:1 picture is 379 px, almost the width of the screen. A 16:9 picture is 284 px.
- Rows hold 2 pictures (wide ones) to 7 (portrait ones). The strip is about 600 to 800 px long and the travel is about 200 to 400 px, up to one screen width. Section 5 has the page heights.
- Scrolling is native touch scrolling. The rows follow within a frame. On a fling the page scrolls on the compositor and the rows on the main thread, so a row can trail by a frame. Nothing to fix. Do not add `touch-action` rules and do not catch touch events.
- No hover. A tap opens the zoom and a tap closes it. The outline shows only on `:focus-visible`.
- The address bar changes `innerHeight` while scrolling. That is why `vh` in this file is `100lvh` (4.7).
- The row is small, so the picture is only a thumbnail. That is the purpose of the zoom. If the owner finds 160 px too small on a phone, raise the floor in `ROW_H`.

### 4.11 Performance checklist

- Transform and opacity only. No `filter`, `backdrop-filter` or `mix-blend-mode` over the pictures, no animated `width`, `left`, `top` or `margin`.
- No CSS custom property or inline style on `<html>` or `<body>` per frame. Write only on the mounted strips.
- Rows get `will-change: transform` while mounted (about 9 to 13 layers). Pictures never do.
- No layout reads in the scroll path. Row tops, widths and travel are arithmetic.
- No timer that moves rows. If nothing scrolls, nothing runs.
- Judge speed on the production build with `scripts/perf/weak.mjs`, not on `pnpm dev`.
- Effects are never gated on the device. If the rows cost too much, make them cheaper for everyone (fewer mounted rows, smaller overscan), never turn them off for some.

## 5. What it gives on our real pictures

`planRows` was run on the real pictures of `D:\ren\aspirant\media\_all` (the deduplicated groups from `scripts/library/arts_rooms/catalog.py`) and on the 149 fanart pictures of the old `fanart.json` (videos and cosplay left out). Pictures per row, slide speed (px of travel per px of scroll) and page height exclude the header and footer. The "last row" is left out of the per row and speed columns.

What the pictures are like: Scene is 617 pictures, 372 of them 2.37:1, 206 of them 16:9, 25 of them 2.34:1 and 9 of them 9:16. Game is 159 pictures, 146 of them 2.22:1. Others is 67 pictures with ratios from 0.57 to 1.94. Fanart is 149 pictures, 77 of them square, 25 of them 4:5, from 0.45 to 1.91. The widest picture at 254 px is 602 px. The narrowest is 114 px.

| Room (pictures)    | Screen    | Rows | Per row (min / median / max) | Speed (min / median / max) | Page height (screens) |
| ------------------ | --------- | ---- | ---------------------------- | -------------------------- | --------------------- |
| Scene (617)        | 1440x900  | 186  | 3 / 3 / 7                    | 0.21 / 0.50 / 0.88         | 54,644 px (60.7)      |
| Scene (617)        | 1920x1080 | 142  | 4 / 4 / 8                    | 0.26 / 0.56 / 0.74         | 41,708 px (38.6)      |
| Scene (617)        | 390x844   | 304  | 2 / 2 / 5                    | 0.24 / 0.46 / 0.57         | 54,700 px (64.8)      |
| Game (159)         | 1440x900  | 52   | 3 / 3 / 4                    | 0.37 / 0.37 / 0.73         | 15,248 px (16.9)      |
| Game (159)         | 1920x1080 | 39   | 4 / 4 / 5                    | 0.21 / 0.42 / 0.72         | 11,426 px (10.6)      |
| Game (159)         | 390x844   | 77   | 2 / 2 / 3                    | 0.40 / 0.40 / 0.64         | 13,840 px (16.4)      |
| Others (67)        | 1440x900  | 12   | 5 / 5 / 7                    | 0.21 / 0.47 / 0.61         | 3,488 px (3.9)        |
| Others (67)        | 1920x1080 | 10   | 6 / 7 / 8                    | 0.28 / 0.40 / 0.56         | 2,900 px (2.7)        |
| Others (67)        | 390x844   | 19   | 3 / 4 / 5                    | 0.29 / 0.41 / 0.52         | 3,400 px (4.0)        |
| Fanart (149)       | 1440x900  | 24   | 5 / 6 / 8                    | 0.32 / 0.41 / 0.56         | 7,016 px (7.8)        |
| Fanart (149)       | 1920x1080 | 18   | 7 / 8 / 9                    | 0.28 / 0.39 / 0.55         | 5,252 px (4.9)        |
| Fanart (149)       | 390x844   | 36   | 3 / 4 / 5                    | 0.28 / 0.37 / 0.53         | 6,460 px (7.7)        |
| 600 mixed pictures | 1440x900  | 180  | 3 / 3 / 7                    | 0.21 / 0.50 / 0.88         | 52,880 px (58.8)      |
| 600 mixed pictures | 1920x1080 | 138  | 4 / 4 / 8                    | 0.26 / 0.56 / 0.74         | 40,532 px (37.5)      |
| 600 mixed pictures | 390x844   | 295  | 2 / 2 / 5                    | 0.24 / 0.46 / 0.57         | 53,080 px (62.9)      |

- Every picture was placed once, every row passed the invariants (no empty edge, every picture whole on screen at some position).
- "So many scroll below" is true: about 60 screens of scroll at 1440 for 600 pictures. A page of 55,000 px is well inside what a browser and Lenis allow. The mounted part stays at about 30 to 50 pictures.
- The owner's example said 4 to 9 pictures a row. At 1440 and 254 px, Scene rows have 3 (the pictures are wide). Game rows have 3 or 4. On a phone, rows have 2 to 5. At 1920 Scene, Game and Others are inside 4 to 9. Fanart is 5 to 9 on a laptop. The count is the result of the row height and the pictures' widths, not a rule. Lower `ROW_H_MAX` to 200 to get 4 or more on Scene at 1440.
- The odd cases: 1, 2 or 3 pictures give one static centred row at 1440 (on a phone 2 or 3 pictures slide a little). 17 mixed pictures give 4 rows. 40 pictures of 9:16 give rows of 10 at 1440 and 7 at 390. A 5:1 strip among 16:9 pictures makes its row slide 1306 px at 1440 (1.45 px per px, the fastest case) and is wider than a phone screen at 390. The widest real picture is 2.37:1, so that case does not happen with our data.

## 6. What the owner would notice if we got it wrong

1. **Rows that do not alternate**, or that all move the same way, or row 1 moving left when scrolling down. Row 1 moves right going down.
2. **Rows that keep moving when the scroll stops** (a marquee). They must follow the scroll and nothing else.
3. **An empty gap at the end of a row** while it slides. The strip must always cover the screen window.
4. **A picture that is never shown, or shown twice.** The filter's count must equal the pictures in the flow.
5. **Different gaps** sideways and between rows, **different row heights**, **cropped or stretched pictures**. One gap, one height, the whole picture.
6. **Rows that lag or step**, and **soft pictures while they move** (half pixel positions). Round to a device pixel.
7. **Pictures that pop in late or push the row** (a box with no size before it loads). The box has its size and its colour from the start.
8. **A page that jumps** when the filter changes, when the window is resized, on a phone's address bar, or on Back.
9. **A horizontal scrollbar, or a row that jumps sideways on Tab.** Use `overflow: clip`.
10. **A speed that is wrong**: under 0.1 px per px the rows look still, over 1 they smear. Rows between 0.2 and 0.9 match the live reference.
11. **An outline that is cut at the row's edge** or a hover that scales the picture.
12. **The first screen on the phone with rows too small to tell what they are.** The zoom must open with a tap.
13. **A last row with a hole** on one side. A short row is centred and static.

## 7. Calls for the main session

- The Flow helper should put these constants and `planRows` in one pure file with unit tests (the invariants above). The preload list for each room can call the same function to know which pictures are on the first screen.
- The redesign file says rows use `t` (480). That is too small for 2.37:1 pictures at row height and for any pixel ratio 2 screen. Use `srcset` with `t` and `p` (4.8). No new files are needed.
- The zoom code must accept a start rect that is partly or wholly off screen (4.9), and the room needs a helper that scrolls a row to put a picture in view (4.9). Both are used by `?i=` and by the search overlay.
- Ownership: the chunker and the rows live in `arts/core/flow/`. Scene, Game, Others and Fanart are thin pages over it.
- Decisions made here that the owner may want to change, each one a constant: `ROW_H_MAX` 254 (the reference's own), `FLOW_SPEED_GOAL` 0.4 and `FLOW_SPEED_MIN` 0.2, the 160 px floor on a phone, and `OVERSCAN` 0.75 `vh`.

## 8. How it was measured

- Playwright with real Chrome (`channel: "chrome"`, see `scripts/qa/probes/lib.cjs`), 1440x900, 1920x1080, and 390x844 with touch (pixel ratio 2).
- A recorder on every `requestAnimationFrame` wrote the page scroll and both tracks' computed `translateX` while the wheel moved 100 px every 40 ms (a touch drag of 100 px on the phone), down the whole pass and back up. Fits and slopes came from those logs.
- Screenshots about every 100 ms while a fixed distance was scrolled (15 to 18 frames), then contact sheets.
- "All loaded" runs set every picture to load at once and made the page measure again (a resize event on a laptop, a one pixel width change on the phone). "First visit" runs only scrolled.
- The code and styles of the page were read to learn the mechanics: the Gallery section's markup and styles, the scroll setup, the motion of the tracks. Twelve works pages were checked for the number of rows and pictures.
- The recipe's row function was run on the real data and on odd cases in Python (the figures in section 5). The page-end rule in 4.4 and the rest of section 4 were reasoned out, not run in a browser: the Flow helper should check them on the real page.
- Not checked: Firefox and Safari, a real phone, and the reference on a slow connection.
