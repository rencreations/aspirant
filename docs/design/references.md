# Reference techniques

Notes on the owner's references and on patterns common to Awwwards-recognised sites. Each entry says what to build here. Fetching the live sites returns little because they render in the browser, so these notes work from how such sites are built.

## Owner references

| Reference            | What it does                                                                                                                                                                                                                                              | What we build                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| santionispirits.com  | Narrated scroll story. A single voice continues as you scroll, scenes change behind the words, chapters end on a held beat.                                                                                                                               | `/experience`. Native scroll, a pinned scene layer, the lit-paragraph rhythm, big word-by-word key lines, a held beat at the end of each Part. |
| landonorris.com      | Hero where a character turns toward the cursor and the pointer opens a window to a second state. Two-tile Off Track and On Track split. A hall of items with a hover state swap. A footer that previews the next item and loads it if you keep scrolling. | Home portal hero, the versus stage, the fan art hall, `NextFooter`.                                                                            |
| kprverse.com         | Photo frames that are not rectangles. Soft, smooth section transitions.                                                                                                                                                                                   | The frame library. Section hand-offs with masks and crossfades instead of hard cuts.                                                           |
| why.zero.university  | A confident claim, then the page strikes it out and says the opposite. Plain, direct copy.                                                                                                                                                                | The before and after contrasts on `/story` and Home. Scroll-driven strikethrough, colour drain and rebuild.                                    |
| oryzo.ai (#features) | A 3D environment as the storytelling medium: the camera travels through a scene while text anchors to objects.                                                                                                                                            | Experience set pieces: the camera moves through the gantry, the web, the void.                                                                 |
| aten7.com/intro      | The loading state morphs into an interactive title that reacts to the pointer.                                                                                                                                                                            | The loader and wordmark.                                                                                                                       |
| 2019.makemepulse.com | Playful illustrated interactions. Every object responds.                                                                                                                                                                                                  | Small toys: click the windows, drag the Emblem stars, play the lighthouses.                                                                    |

## Patterns to reuse (with the technique)

1. **Lerped camera rig.** Camera or layers follow a damped pointer vector (`damp(current, target, lambda, dt)`), never a raw one. Same rig on desktop pointer, touch drag and device tilt.
2. **Depth parallax from a depth map.** A plane with a displacement shader samples a depth texture and offsets UVs by pointer x depth. It reads as 3D with a flat illustration. Keep the amplitude small (2 to 3 percent of the width).
3. **Portal reveal.** A fragment shader mixes two textures through a circular mask at the pointer. The edge adds noise distortion and a glowing rim. Radius follows smoothed pointer speed.
4. **Lit reading.** A scroll-scrubbed opacity ramp per word or per line, or a radial mask around the pointer. Gives text a sense of a lamp moving over it.
5. **Scroll as a timeline.** One GSAP ScrollTrigger timeline per pinned scene with `scrub: 0.6`. Smooth with Lenis. Keep pinned spans short, no scroll-jacking.
6. **Custom frames.** `clip-path: polygon()` plus an SVG outline path that matches. Animate the outline with `stroke-dashoffset` on hover.
7. **Particles that spell.** Sample a text mask into points. Each point eases toward its target with a spring. Pointer force repels, release returns.
8. **Hex-tile transitions.** A grid of hexagons scales or clips from the click point outward, covers, navigates, then reverses.
9. **Marquee and counters.** Slow marquee strips and tabular-number counters give a HUD feel.
10. **Sound.** Small synthesised blips, a held ambient bed that ducks under voice, voice lines on hover. Muted until the visitor enters.
11. **Mobile.** Replace hover with tap and long press. Replace pointer parallax with drag or device tilt. Halve particle counts. Cap DPR.
12. **Reduced motion.** Crossfades only. Do not remove content or interaction.

## Visual vocabulary

Chamfered corners, bracket corners, tick rules, mono micro-labels with unit numbers, hex grids and dot grids, scan bands, gradient glows in the character palette, four-pointed stars, thin cyan lines on void black, white ceramic panels for Academy scenes, amber and violet fractures for Enders.
