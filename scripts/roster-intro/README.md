# Roster intro assets

Short clips and cleaned stills for the intro of `/character` (spec: `docs/design/roster-intro.md`).
Run both scripts with the anaconda Python (`C:\Users\muham\anaconda3\python.exe -I <script>`). The
stills script needs NumPy, Pillow and SciPy (all in the anaconda install).

## Clips: `build.py`

Cuts `apps/web/public/video/roster-intro/<slug>.mp4` from
`D:\ren\aspirant\media\game\animation\<slug>\welcome.mkv` (3840x1728, 60 fps) and rewrites
`apps/web/src/features/character/roster/intro/clips.generated.ts`. Output: 1600x720, 60 fps,
H.264, `-crf 28`, no audio, keyframe every 12 frames, `+faststart`.

To recut one: edit its row in the `CLIPS` table (start in the source, length, focus x and y as
fractions of the frame), then `python -I scripts\roster-intro\build.py <slug>`. With no argument it
cuts all ten. `from` in the manifest is the start in the source. The "time inside" below is
seconds from the start of the clip.

| Clip      | Source start | Length | What it shows                                                                                                        | Focus      | Useful time inside       |
| --------- | ------------ | ------ | -------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------ |
| obsidia   | 10.6 s       | 1.5 s  | pink light burst with chains, then her figure in a red cube field, a cross flare                                     | 0.50, 0.42 | 0.3 to 1.2 (figure)      |
| selena    | 5.3 s        | 1.4 s  | blonde hair, her face turning, then a red wipe with her flying                                                       | 0.42, 0.45 | 0.4 to 0.8 (face)        |
| vexana    | 4.6 s        | 1.5 s  | her figure with floating spears, then a close face in a yellow burst                                                 | 0.50, 0.45 | 0.0 to 1.2               |
| guinevere | 2.4 s        | 1.5 s  | face close up, arms spread with spark bursts, then the dance with orange pets                                        | 0.50, 0.45 | 0.4 to 0.9 (arms spread) |
| lesley    | 8.6 s        | 1.5 s  | the long weapon with cyan and pink glow, her ponytail, then the full weapon                                          | 0.60, 0.50 | whole clip               |
| change    | 7.6 s        | 1.5 s  | pink hair seen from behind, then the face with green eyes and glasses                                                | 0.62, 0.45 | 0.3 to 1.5 (face)        |
| ruby      | 8.3 s        | 1.4 s  | face close up with spear, a swing, a long orange slash in the dark                                                   | 0.46, 0.45 | 0.0 to 0.8               |
| angela    | 5.2 s        | 1.4 s  | the twin pair, a yellow beam crossing, the pair turning                                                              | 0.45, 0.50 | 0.3 to 0.9 (beam)        |
| layla     | 5.1 s        | 1.2 s  | full figure on the bench, then a fast zoom into her angry face (a wipe starts at 6.4 s in the source, it is cut off) | 0.55, 0.42 | 0.3 to 1.2 (face)        |
| fanny     | 8.2 s        | 1.4 s  | the dive over the city (small, far), the spear swing close up in a white and cyan flash, drones                      | 0.50, 0.50 | 0.2 to 1.0               |

How the stretches were chosen: contact sheets of each welcome recording (a frame every 0.3 s),
looking for the most dynamic 1 to 1.5 seconds that read well in a tall slanted panel (a face or a
figure in the middle, a clear change of picture, no game interface, no full white wipe at the end).
Only Fanny could be matched to the reference by eye: the first panel (0.7 to 1.45 s in
`transitions.mov`) shows her in a white jacket with a spear over a purple building, then her green
eye close up. That scene is not in the welcome recording as such (the reference panel is a heavy zoom
of the dive), so the closest stretch is used: the dive, the spear swing and the close up (8.2 s on).
The other panels of the burst last 2 to 6 frames each in the reference and are too short to match
by eye; their stretches are the best close-ups of each recording.

Sizes: all ten are under 1.5 MB (the largest are guinevere and obsidia at about 1.45 MB).

## Stills: `stills.py`

Writes transparent WebP files to `apps/web/public/img/roster-intro/`, cropped to their shape (at
most 2048 on the long side). `python -I scripts\roster-intro\stills.py [name ...]`. Sources are
frames of `C:\Users\muham\Videos\transitions.mov` taken with ffmpeg at the time listed. The game's
top bar never falls inside a crop. All masks are made with code (colour keys, connected pieces,
filling a convex shape row by row); no image generator was used.

| File                | Source                                                                    | Notes                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beam-hold.webp`    | frame at 3.0 s                                                            | the cyan and teal leaf with the yellow-green base, pink rim, and the crimson underside. The screen cuts it at the left and the bottom (it enters from outside the screen). Tip points right at about (0.99, 0.48) of the file.                                                            |
| `beam-pink.webp`    | frame at 2.85 s (the beam at 2.7 s is not on screen yet in the reference) | the magenta spear with the light pink rim and the black bevel along the top. Cut to the wedge of the beam so the speed lines, the panel pieces and the stripes around the tip are gone. Tip points left at about (0.05, 0.45). Enters from the right, the right end is cut by the screen. |
| `beam-blue.webp`    | frame at 3.4 s                                                            | blue to violet to magenta leaf with a pink rim. Tip points right. A few ragged pixels remain at the very tip and on the lower rim.                                                                                                                                                        |
| `beam-thin.webp`    | frame at 3.6 s                                                            | the thin pink, yellow and cyan line. Only the part that is clear of the panel art was kept, so it is shorter than in the reference and its tip is flat. Scale and clip it, or draw the last part with a CSS gradient.                                                                     |
| `speed-lines.webp`  | rebuilt in code                                                           | white and red hairlines radiating from the centre (2048 square, the centre of the file is the centre of the burst). In the frame the lines lie on a red field and cannot be keyed.                                                                                                        |
| `energy-slash.webp` | rebuilt in code (the slash in `full_5.3.png` runs under the characters)   | an upright jagged slash that leans about 36 degrees, a white-hot core, red body, dark cracks, sparks, soft red glow.                                                                                                                                                                      |
| `ring-arcs.webp`    | frame at 3.7 s                                                            | the black arcs at the left, keyed by darkness (black with alpha). Cut at 330 px from the left edge of the frame. The thin ring line that crosses the panels in the middle is not included. A few dot-grid dots of the page remain inside.                                                 |
| `fire.webp`         | rebuilt in code (the fire in the frame sits on panel art)                 | noise through a black, red, orange, yellow, white ramp, rising embers and cyan sparks. 1024x768, the base of the flame is at 62 percent of the height.                                                                                                                                    |

Anything marked "rebuilt" can be changed by editing its function in `stills.py` (seed, size, colours).
