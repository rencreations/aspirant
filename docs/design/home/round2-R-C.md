# Home round two: R-C (selena, voices, music, funny)

Brief: `docs/superpowers/specs/2026-11-19-home-feedback-request.md`. Plays: `kernel-plays.md`. Backdrops: `fx-backdrop.md`. Code: `apps/web/src/features/home/sections/{selena,voices,music,funny}/`. Each section has a `stations.ts` (pure, import free, because `index.ts` must never reach `kernel/where.ts`) with its plays table. `index.ts` reads it.

## 1. Stations, thresholds, durations

`at` is a share of the section's own range. `screens` is the registry length. One story unit is one second where the section's story runs on its own clock (Selena).

| section | screens (was)       | station values `local`           | plays (at, seconds)                                                                             | rest frames                                                                                           |
| ------- | ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| selena  | 1.5 (3.8)           | 0, REST 0.238 (u 1.0), 1 (u 4.2) | enter 0.12, 1.0 s; film 0.66, 3.2 s (back 0.6)                                                  | the room: drawer, words, dragon, aurora, Selena and Silverbolt interactive; then white (voices start) |
| voices  | 1.5 (2.4)           | 0, REST 0.3, 1                   | enter 0.04, 0.9 s; leave 0.78, 0.8 s                                                            | the list, chooser and art stand; then the pair in the bottom corners                                  |
| music   | 1.7 (2.8)           | 0, STAND 0.5, 1                  | arrive 0.07, 3.2 s (zip off 0.5 s, gramophone about 1.4 s, crate about 1.6 s); exit 0.76, 1.5 s | the scene stands, records are picked with the page free; then the pair at the top left                |
| funny   | 2.0 (4.2), tail 0.8 | 0, R1 0.12, R2 0.5, 1            | arrive 0.05, 0.6 s; cross 0.32, 2.6 s; ask 0.64, 1.6 s                                          | Tetra and the kite; empty sky with the confused pair; the pair big, words and button                  |

Total scroll of the four: 6.7 screens (was 13.2). Plays hold the page for 1.0 + 3.2 (Selena), 0.9 + 0.8 (voices), 3.2 + 1.5 (music), 0.6 + 2.6 + 1.6 (funny) seconds, none longer than 3.2 s.

### Selena

- `stations.ts`: `STORY` 4.2 s, `REST_U` 1.0, `AT_ENTER` 0.12, `AT_FILM` 0.66. `u = min(local, 1) * STORY`. The film fires half a screen before the end at the latest (`1 - 0.5 / screens`), so it has ended before the voices' lead and the bar's early ink (voices `nav.early` 0.45) turns after the white is whole.
- Beats (`timeline.ts`, seconds of the story): entrance drawer 0 to 0.7, words from 0.15 (0.1 apart, 0.35 each), dragon 0 to 0.95; film: doll 1.0 to 1.5, camera 1.15 to 1.6 (a quick whip), pose 1.2 to 1.6, white 3.15 to 3.4, front white 3.75 to 3.95, hand over 4.0 to 4.2. `FILM_KEYS` map story to clip seconds: the camera swing carries the first 1.2 s of the clip, the hover plays at about 2x, the eat at about 1.4x, the dragon's pass at 0.75x (slower, so the sweep reads). No dead time after the pass.
- The tail is scroll linked: the white layer leaves in screens 0.25 to 0.5 past the end (`beats.whiteOut`).
- `mountAhead` 3.5: the actors are the biggest files, so they are built long before the first threshold.
- Selena's flip (clip 4.0 to 5.0 s) is still not shown: it would add a second to a scene the owner called too long.

### Voices

- `OUT_FROM` is `REST_V + 0.04`. A playing line is stopped at `OUT_FROM + 0.12`. The 8 rows are whole at 0.286, before the rest.

### Music

- The hold of round one is gone (`intent.ts` and its test deleted, "Continue" removed from the view, dom and css, `ARRIVE_SECONDS`, `crossedLock`, `stepClock` gone). The first play is the lock: it holds the page by the kernel's tested hold (safety timers included). The stand never holds the page. The song stops as the exit begins.
- "The carry" is read as the drone's trips: scheduler `TO_CRATE` 0.5, `CARRY` 0.8, `NEEDLE` 0.7, `BACK` 0.7, `LIFT` 0.7, `RETURN_AT` 0.8 (were 0.8, 1.1, 1.0, 1.0, 1.0, 1.1). Press to song is about 3 s (was 5 to 6).

### Funny

- Lift is by the real scroll past the section's end (`rise = S - sectionEnd("funny")`, tail 0.8 beyond `GONE` 0.74), so a jump past the section has the duo and the words gone. `bob()` takes seconds. `geometry()`, `zoomH` and `zoomFeet` were not touched (music's J11 and the bend depend on them).
- `T` re-timed to the three stations: the dragon crosses 0.14 to 0.48, the cut at about 0.3, confusion 0.34 to 0.44, centre 0.5 to 0.72, words 0.74 to 0.88. `focus` 0.85.

## 2. Backdrops

| section | kind (ground)                    | how                                                                                                                                                                                                                                                                                                                                               |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| selena  | `aurora` (storm), her colours    | cyan, violet, pink, gold; amount 1, intensity 1.6. Comes in with the drawer, goes with the white. The list's opaque sky div fades to 6 percent as it comes in (it sits over the canvas). Not asked at u 0 (the joint with the list stays whole). Seen: curtains of light behind Selena and the dragon in every frame of the film until the white. |
| voices  | `waves` (daybreak)               | slow, along the foot, amount 0.85, with the title and the list. Not asked in the lead.                                                                                                                                                                                                                                                            |
| music   | `gradient-blinds` (daybreak)     | stage slats, amount 0.7 plus 0.35 times the beat. The beat is the low end of the music analyser (`audio.getMusicAnalyser()`), fast attack and slow release; speed 1.5 and intensity up while a song plays.                                                                                                                                        |
| funny   | `soft-aurora`, then `light-rays` | a pastel sky for Tetra and the dragon, rays from above when the pair comes to the middle for the question.                                                                                                                                                                                                                                        |

Found while looking: the `iridescence` kind is a swirl around the pointer, so with no pointer (touch, or before the mouse moves) it draws nothing on daybreak. Do not use it as a calm full screen backdrop. Daybreak kinds drawn with custom pastel colours also vanish on the #f4f6f9 ground: leave `colors` out and take the palette.

## 3. Audit (found and fixed, found and not fixed)

Fixed:

- Selena: 3.8 screens of scrub, the film and the white were a long scroll with a dead rest. Now two plays, 4.2 s in all.
- Selena: no live background. Aurora added.
- Selena: the old film kept the clip at real speed. The hover and eat are faster, the pass slower; a dead stretch after the dragon left (white already up) was cut.
- Music: the lock released only by a gesture, a key, "Continue" or 6 s of song, and a steady scroll was ignored. It is now the kernel's play, with no custom gesture gate.
- Music: arrival 5.2 s, song after 5 to 6 s. Now 3.2 s and about 3 s.
- Voices and funny: entrance and leave by the scroll with long dead scrolls (2.4 and 4.2 screens). Now plays.
- Funny: the lift was tied to `local` and the section length. Now the real scroll.
- Music backdrop could not pulse. Analyser getter exists and is used.

Found, not fixed (not in my range or not enough time):

- Selena's room pose: Selena and the dragon in `city_idle` interlock and overlap in the pixel view (she lies back, the dragon's tail across her). It reads cluttered. The pose and the placement belong to the actors and the list's `selena-frame.ts`.
- The camera swing into the film passes close to Selena's hair for about 3 frames (the blend lerps the camera through the model). Shortened to 0.45 s; a mid swing dolly out would fix it.
- Funny first rest: Tetra stands at the right with the kite straight above, and the left and the middle are empty. `geometry()` is shared, so it was left.
- Voices: the pair floats over the lower left of the art and hides part of it (round one note, unchanged). A phone puts them over the top of the art.
- `MUSIC_UI.keep` in `content.ts` is now unused data (an object key, so knip does not list it).
- Selena's white layer is opaque over the backdrop until it leaves in Selena's tail (0.25 to 0.5 screens past its end), so the voices' waves show as the page scrolls on, not during its entrance. The dead white scroll between the film and the voices is 0.5 screens by design (lead rule and the bar's early ink).

## 4. How to look

- Dev server 3100 only (`BASE=http://localhost:3100`, the probe lib defaults to 3000, the owner's). The dev server reloads the page whenever any helper saves a file, which restarts a probe at the top: use `seekSure` in `D:\ren\aspirant-work\home\R-C\lib.cjs`.
- `D:\ren\aspirant-work\home\R-C\`: `cast.cjs <section> <WxH> <offset> <wheelDy> <steps> <seconds> <prefix> [waitMs]` records a CDP screencast while a real wheel crosses a threshold, `castsheet.py <dir> <out> <cols> <scale> <n> [t0 t1]` makes the timed contact sheet, `shot.cjs`, `play.cjs`.
- Selena: `cast.cjs selena 1440x900 0.75 100 4 6 sf1` is the film (14 frames, 3.2 s); offset 0.0 and 3 steps is the entrance. Funny: offsets 0.0 (arrive), 0.5 (cross), 1.05 (ask).

## 5. What was looked at

Real Chrome on the dev server, 1440x900, real wheel, CDP screencast, contact sheets read:

- Selena: the entrance (drawer, words, dragon glide in, aurora), the whole film (doll falls, camera whip, Selena in the baked camera, bite and white flash, dragon over white, empty white) in about 3.6 s of the first timing; the shortened timing (4.2 s story) was set after that sheet and its numbers are tested, not re-recorded.
- Voices: the entrance (about 1 s) and the rest; the waves were not seen under the real play (the white of Selena's tail covers them near the start).
- Music: the arrival (pair zips off, gramophone dragged in, crate carried in, "Pick a record" at 3.3 s). The gradient-blinds backdrop was not seen in that capture (it used custom pastel colours, since removed) and not re-recorded.
- Funny: all three plays (Tetra arrives; the dragon crosses, the rope is cut, Tetra runs off, the pair confused; the pair comes to the middle and the words arrive under light rays).
- Checks: `npx vitest run src/features/home` (195 files, 2103 tests) passes; eslint, prettier and `scan-text` are clean for the four folders; tsc has no error in them; knip lists nothing of mine.

## 6. Not verified (be honest)

- Backward plays (scrolling up through every threshold), a seek in the middle of a play, a Tab into each section, a fast flick, a scrollbar drag, Back and reload mid page, resize: not run for these four sections. They depend on `kernel/plays.ts` and `kernel-plays.md` section 9 (its own proof), not on anything here, but nothing of mine was driven that way.
- 390x844 and 1706x950 for the plays and the backdrops: not recorded. The phone layouts of the voices (looked at once, rest only) and the music stand were not re-looked at.
- Music after the change: a pick, the song, the beat pulse (needs a press and sound), "Another record", the exit play. Only the arrival was seen. The beat is read from an analyser that exists only after the audio is unlocked, with no fallback pulse (the backdrop then just stays at its base).
- Selena's film with no actors: a recording made right after a page load (the dev server reloads constantly) fired the film while Selena, the dragon and the doll had not been built yet. The aurora, the stars and the four point star played alone for the whole lock, 3.2 s. A normal scroll builds them long before (`mountAhead` 3.5, deferred loads), a jump with slow files can reach the film first. The plays have no "wait for the actors" gate; a gate in `kernel/plays.ts` (hold the threshold until a section says it is ready) is the fix and is not mine.
- The Selena film at the new timing, the voices exit, the music exit, the funny tail rise (the duo and words riding out): not recorded after the changes.
- GPU cost of the second canvas with these kinds under the film (the aurora at the full amount and a 1.6 intensity with the stage drawing); production build; Firefox and Safari; a real touch phone.
- Contrast of the voices lines over the waves, and of the music words over the blinds.
