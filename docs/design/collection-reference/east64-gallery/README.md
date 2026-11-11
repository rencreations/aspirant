# East64 Gallery rows: the frames

Recorded on 11 Nov 2026 from the Gallery section of <https://www.east64films.com/works/hodinkee-x-g-shock/> in a real Chrome (Playwright, channel `chrome`), at 1440x900, 1920x1080 and 390x844 (touch, pixel ratio 2). They are for looking at. Nothing of the reference's code, pictures or wording is used on the site. What the section does and how we build our own version is in [`docs/design/arts-reference-gallery.md`](../../arts-reference-gallery.md).

## How they were recorded

- The wheel moves 100 px or 110 px a step (a touch drag of the same length on the phone). A screenshot is taken about every 100 ms while it moves, and each frame is labelled with its time, the page scroll, the share of the section's pass and the position of both rows (`x`, the translateX in px).
- "All loaded" runs force every picture to load first, then make the page measure itself again, so the travel is the one the code intends. A "first visit" run does not, and shows what a visitor gets.
- A recorder on every animation frame (6 ms on this machine) logged the scroll and the rows' real transforms. Those logs gave the numbers in the doc.

## Files

| File                      | What it shows                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1440-scroll-down.jpg`    | 15 frames, scrolling down at 1440x900, all pictures loaded. Row 1 (top) slides right, row 2 slides left. The first frames show the hero picture above the section, the last show "Related Works" after it.                              |
| `1440-scroll-up.jpg`      | The same distance back up. Each row retraces its path: the position depends on the scroll only.                                                                                                                                         |
| `1440-pass-states.jpg`    | Four stills at 25, 50, 75 and 100 percent of the pass with the row positions. The fourth shows the section already gone off the top: the rows reach their end positions (0 and -884 px) only while nothing of the gallery is on screen. |
| `1440-first-visit.jpg`    | A first visit, scrolling down. The rows travel only 252 px (0.17 px per px of scroll) because the page measured the strip before the pictures had loaded. Compare with the 884 px of the first sheet.                                   |
| `1440-frame-mid-pass.jpg` | One full 1440x900 frame in the middle of the pass: row height 254 px, a 40 px gap both ways, pictures at 16:9 (451 px), both rows cut by the screen edges.                                                                              |
| `1920-scroll-down.jpg`    | The same at 1920x1080. The row height stays 254 px. The page ends before the pass does, so the rows stop at 37 px and 847 px instead of 0 and 884 px.                                                                                   |
| `390-scroll-down.jpg`     | 13 frames on the phone (touch drag), after the page measured the full strip. Row height 160 px, gap 20 px, pictures 284 px wide, travel 548 px.                                                                                         |
| `390-scroll-up.jpg`       | The same distance back up on the phone.                                                                                                                                                                                                 |
| `390-frame-mid-pass.jpg`  | One full phone frame in the middle of the pass.                                                                                                                                                                                         |
| `mapping.png`             | Left: the row position against scroll at 1440x900 (straight lines, 0.58 px per px with all pictures loaded, 0.17 on a first visit). Right: the smooth scroll under it, one 100 px wheel notch over about 1 s.                           |
| `row-geometry.png`        | Our recipe, not the reference: one row made from real Scene ratios, the strip as long as the screen plus the travel.                                                                                                                    |
| `plan-scene-1440.png`     | Our recipe on the real Scene data at 1440x900: the first rows at three scroll positions, alternating directions.                                                                                                                        |

The large picture at the top of the first frames of a sheet is the page's own hero, fixed behind the content. It is not part of the gallery.
