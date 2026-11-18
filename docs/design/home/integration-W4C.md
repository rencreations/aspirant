# Home integration: W4-C (selena, voices, music, funny; S 29.9 to 43.1, joints J8 to J12)

Walked at 1440x900 and 390x844 (frame sheets from `seek` and `freeze`, real Chrome, dev server 3100); 1706x950 was not walked. Scripts: `D:\ren\aspirant-work\home\W4C\` (`shot.cjs`, `music1.cjs`, `phoneF.cjs`, `sheet.py`).

## Changed

- **J9 dark flash (selena).** The white layer that leaves in the tail sat over the dark sky, so S 33.95 to 34.2 showed the night coming back through it (a frame at S 34.0 read (222, 225, 233); S 34.18 was navy). The sky is now hidden once the white is whole (`runtime.ts`, `[data-selena-sky]`). Seen after: S 33.45, 33.7 and 34.1 are plain daybreak white, no dark bar.
- **The dragon passes over a white screen (selena).** Before: the white arrived at the same moment as the pass, so it read as a grey veil. Now `AT.white` is 3.22 to 3.36 (a flash that starts on the bite and is whole before the head reaches the lens at the clip's 3.7 s), the pass has a third of a screen (`FILM_KEYS` last key 3.55, was 3.5), and the white over the canvas that takes Selena starts after the dragon has left (`AT.front` 3.55 to 3.7). Frames at u 3.4 and 3.48 show the big dragon and its tail over white. Length 3.8 unchanged (no later section moved).
- **Top bar ink at J9.** `HomeSection.nav.early` (screens): the bar takes the next section's theme that much before its start. Voices uses 0.45, so the bar turns dark where the white is whole (u 3.35) and not a quarter screen later. `navOwnerAt` in `kernel/layout.ts` (tested), used by `kernel/run.ts`.
- **Press on the lift (kernel/pointer.ts).** A touch or pen presses its 3D target only when it lifts as a tap (12 px, 600 ms: `isTap`, moved here from the music section with its tests); a swipe or a `pointercancel` never presses. Hover (enter, leave) is unchanged. **A mouse still presses at pointer-down**: Silverbolt's tail drag begins at the press and a mouse never scrolls by pressing, so a press on the lift would break the drag. Music's own tap bookkeeping (`touchPick`, the capture `lift` listener) is gone: the hub's press is already a tap. Tests added in `pointer.test.ts`.
- **Duo over the cast in music.** `Stage.reorder(name, order)` (kernel/stage.ts, `ScenePass.order` is now mutable). The music section draws the shared `perspective` pass at 35 (cast is 30) from `enter` to `leave` and `dispose`, then back to 20. The cranking drone is whole in front of the gramophone base, and reads well in the pick sequence (frames: stand, disc out, carry, seated, notes).
- **Funny, the two drones in the middle (wide).** Spot y 0.14 h to 0.075 h and ball 0.3 h to 0.27 h: the higher drone's ears were cut by the top edge and sat under the bar. Seen at S 41.5: clear of the bar, title below.
- **Focus seek.** `HomeSection.focus` (the `local` a keyboard focus lands on, default 0.5), read by `home-stage.tsx`. Funny sets 0.7 (words in from 0.64, ride up from 0.8). Selena (0.5: drawer open at u 1.9) and the others keep the default.
- `kernel/stub.ts` and `Stub` in `ui.tsx` were already gone (nothing to delete).

Shared files touched (small): `kernel/types.ts` (two optional fields), `kernel/layout.ts` (`navOwnerAt`), `kernel/run.ts` (use it), `kernel/stage.ts` (`reorder`), `kernel/pointer.ts`, `home-stage.tsx` (one line). Everything else is inside the four sections.

## Still wrong, or not done

- **Selena's flip (clip 4.0 to 5.0 s) is still not shown.** The dragon's pass is baked at 3.7 to 3.9 s and the white takes the screen right after it. Showing the flip needs a longer section (the notes allow 4.75) and would shift every later section. Left.
- **Dragon over the white inside the canvas** (Selena fading behind it) is not built: Selena stays vivid on the white until the white over the canvas takes her. The white-first order makes it read as Silverbolt passing over a white screen.
- **Silverbolt marks doubled:** not reproduced or counted. The bolt scene's `onMark` listener (`sections/bolt/scene.ts`, W4-B's range, now released with its users) is the one that could double the selena room's; the selena scene adds its own on `enter` and removes it on `leave`.
- **First frames after a load are empty** when a jump lands in a section before its deferred actors (Selena, the dragon, the gramophone, Tetra) have arrived (seen at 390x844 at S 41.8 and in the music stand: empty until the files come). Walked again after a slow pass over the range: all correct. The loading list is W4-E's; there is no loading state for a scroll.
- Voices: the pair floats over the lower left of the splash art and hides part of it (by design in `dwellSpots`); a phone puts them over the top of the art. Left.
- Music hold release states: the 30 s safety net still leaves the section's own `release` set (cosmetic `data-held`, "Continue" showing). Not changed.
- `src/features/home/sections/archive/route.test.ts` fails two tests (0.9428 vs 1, 0.99999 vs 1): W4-D's range, not touched.

## Not verified

1706x950; Firefox and Safari; real touch; the production build and GPU time (the pair of passes and the new white were not timed); sound (nothing was listened to); a resize in the middle of the new white; `pnpm knip` (not run).
