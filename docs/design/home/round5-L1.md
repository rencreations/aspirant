# Round five: the bolt, the fall and the hand in light mode (L1, 20 Nov 2026)

The owner's message: `docs/superpowers/specs/2026-11-20-home-feedback-5-request.md`. "ONLY use light mode ... No dark mode." The three sections sit on the daybreak paper now. No CI was run (the owner's process rule): frames read by eye in real Chrome on the dev server, one targeted test file, `tsc` filtered to these paths.

## What changed

- **The ground and the theme.** `bolt`, `fall` and `hand` have `bg: "daybreak"` and `nav: { theme: "daybreak" }` (`index.ts` of each). The text takes the daybreak tokens (dark ink). Nothing crosses to a dark ground at their joints, so the cross-fade of two grounds at the strip to bolt, fall to hand and hand to list joints is a cross-fade of the same ground.
- **The mist (the dynamic background of the bolt).** `bolt/backdrop-plan.ts` asks for the strip's own `ink-field` in its daybreak colours (S-strip's very soft pale blue and lilac mist on the paper), with the strip's own level and strength (`INK_LEVEL` and `INK_INTENSITY`, exported by `sections/backdrops.ts`), so nothing changes hue or strength where the strip ends. Its amount thins out over the slow range (`mistLeft` in `journey.ts`, 1 to 0 at u 3.4) and the section then stops calling `set`.
- **The white from the bottom (tibdigital "Since 2007").** The same rising layer (`.white` in `bolt.module.css`), now a near white (`#fcfdff`, a cool white a hair brighter than the paper `#f4f6f9`). It hides the paper's dot grid as it rises, so the page brightens from pale blue to near white. `whiteRise` is unchanged and still sinks as the hand comes up, which brings the dots back.
- **The text wheel.** One copy of each name in ink `#0c1020` (the white copy and the cross-fade `inkShare` are gone: `view.tsx`, `runtime.ts`). A soft paper halo (a still text shadow) keeps a name readable where the dragon's dark outline passes behind it. Wheel numbers unchanged.
- **The wavy lines.** A fine blue on the light ground: sky `#59a6ff` and royal `#2458e0` (`lines.ts`).
- **The fall.** FIVE | PHASES and TEN | HEROES keep the ink and the orange accent (the accent is the site's pink-red `--accent`); both read on the white. No backdrop after the mist has gone: the white is the ground, no effect (round four).
- **The hand's backdrop.** `hand/backdrop-plan.ts`: `soft-aurora` in its daybreak palette (pale sky, lilac, blush, cream), amount 0.55, from beat 0.15 as before (the galaxy of the storm palette is gone). The black glove stands out of it. The list takes the backdrop over where its frame arrives (L2's `list/backdrop-plan.ts`).
- **The dragon and the doll.** Not changed. The toon shader already deepens a light surface's rim and the ink outline reads on the paper; looked at on the near white at every point of the ride and the fall: the pale silver armour, the white of the wing and the doll's pale hair keep their outline and read. No shared toon change, so nothing for `toon.md`.

## Tests

`hand/backdrop-plan.test.ts` follows the new kind and amount. The bolt's `journey.test.ts` tests `mistLeft` where it tested `backdropAmount` (the function was renamed: it is a share of the strip's level now).

## Numbers to tune

`INK_LEVEL` and `INK_INTENSITY` in `sections/backdrops.ts` (the strip's and the bolt's mist at once), `mistLeft` in `bolt/journey.ts`, `.white` colour and stops in `bolt.module.css`, `LINES` colours in `lines.ts`, `NEBULA_AMOUNT` in `hand/backdrop-plan.ts`.

## Looked at

Real Chrome (the real GPU, headless), dev server, with consent rejected and the intro off.

- 1440x900, frames by `__home.seek`: the bolt at u -0.2 to 3.7, the fall at 0.5 to 4.5, the hand at 0.4 to 2.6, with the doll, the dragon and the hand built first. The dragon (pale silver, gold and blue) and the doll read on the near white: their ink outline carries them and the long blue and dark red tail is stronger than before. The names are legible; the weakest frame is the wheel half way between two names with the dragon's head behind both (u 3.2, both lines at about 40 percent): the same as round four, only lighter.
- The strip to bolt joint, frames every 0.1 screen from bolt -0.8 to 0.7: one ground, the strip's pastel mist carries on unchanged, the previews fly off to the lower right, then the dragon comes in at about 0.3. No flash, no step in the mist.
- The fall to hand joint, frames every 0.1 screen from fall 3.8 to hand 0.6: TEN | HEROES leave, the white sinks, the paper's dots come back, the hand's fingertips come up, the pastel aurora comes in from hand 0.15. No flash.
- A real wheel (100 px steps) at 1440x900 from the bolt at u 2.6 to the hand's rest (S 14.65 to 21.3) and back up (down 10 frames, up 10 frames), and from the strip's end through the first 2.5 screens of the bolt. The same pictures in both directions.
- 390x844 (touch): the bolt at 0.8, 2.0, 3.0, the fall at 3.3 (the words above and below the doll), the hand at 0.4 and 1.6. The fall at 1.8 came out blank on the phone run, which was taken while another helper's edit was breaking the dev server's build (the same position at 1440 is fine): not looked at again.
- `vitest` on `hand/backdrop-plan.test.ts` and `bolt/journey.test.ts`: 13 pass. `tsc --noEmit -p apps/web`: no error in `sections/bolt`, `fall`, `hand` or `backdrops.ts` (the errors that remain are in `kernel/scrub.test.ts` and the strip's tests, not mine).

## Not done, not verified

- The hand to list joint was seen only by the wheel run (S 21.3, the list's frame arriving over the pink aurora) and not frame by frame: the list's backdrop is L2's and was still changing.
- The phone fall at 1.8, Firefox, Safari, a real phone, the production build and any timing were not looked at. The dev server reloaded the page several times during the run because of other helpers' edits, so a few runs were thrown away and redone.
- The hand's aurora (`soft-aurora`, amount 0.55) is a choice made by eye: pink and lilac on the paper, with the black glove strong in front of it. If the owner wants it quieter, lower `NEBULA_AMOUNT`.
- The fall has no backdrop once the mist is gone (u 3.4): plain white and paper. That is a call (the round four rule said no effects in the fall); a very pale mist could be kept through it with `mistLeft`.
- `docs/design/home/round4-SEC-bolt-fall.md`, `section-bolt-fall.md` and `section-hand-list.md` still describe the storm ground and the black fade: this note replaces them where they disagree.
