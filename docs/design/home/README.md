# Home page notes: which to read, which are history

The home page (`/`, code in `apps/web/src/features/home/`) was built from nothing on 18 Nov 2026 and then reworked in nine rounds of the owner's feedback until 21 Nov 2026. Every part of that work left a note in this folder, about 70 files. **They were written by different helpers on different days, so many of them describe a state that a later round changed or deleted.** This page says which note to trust.

**Round naming.** Round one is the first build (18 Nov 2026). Round two answers the owner's first and second messages of feedback (19 Nov). Rounds three to nine answer messages three to nine (20 Nov). A note called `round6-...` answers the owner's sixth message, `docs/superpowers/specs/2026-11-20-home-feedback-6-request.md`.

Rules for reading them:

1. **The code is the final word.** A note is a map made at one moment.
2. **A later round beats an earlier note.** Round nine beats round two. The owner's own words for every round are in `docs/superpowers/specs/2026-11-19-home-feedback-request.md` and `2026-11-20-home-feedback-*-request.md` (word for word), and they override the first request (`2026-11-18-home-page-request.md`) where they differ.
3. **The rules that apply to every change are in `CLAUDE.md`, section "The home page".** Read that first, then `kernel.md`, then the note of the part you touch.
4. The ledger `docs/superpowers/plans/2026-11-18-home-redesign-progress.md` says what each wave did, in order, with the owner's message that started it.

## What the page is now (21 Nov 2026)

14 sections, about 59 screens, in this order: `hero`, `aspirants`, `rows`, `strip`, `descent`, `list`, `selena`, `voices`, `music`, `funny`, `chase`, `bend`, `archive`, `footer`. Light mode only. Two WebGL contexts (the stage and the backdrop). Every model in the anime (toon) style. Scenes follow the scroll in zones with an idle snap, except named clock triggers. `node scripts/qa/home/sections.cjs <base>` prints the real list.

Sections that **no longer exist**: `bolt` (Silverbolt carrying the doll), `fall` (the doll's fall) and `hand` (Selena's hand). The owner had them deleted in round six; the drone now carries the doll in `descent`. Silverbolt is still an actor (Selena's dragon, in the list frame and the Selena room).

## Home character and film changes, 22 Nov 2026

The film orbit turns during the reading rest and gains speed during its exit. Selena uses the splash card on portrait layouts and below 900 pixels wide. On wider landscape layouts the card opens on the live cast. The two authored transition clips follow its expansion. Both actors share the exit clip and its camera. The pair delivers the doll to the hand. The bite carries it to the mouth and the second turn brings in the white of Voicelines from the right. Wheel and touch can reverse the shot.

The exit blends into the camera from `cameras.json`. Its crop follows the palm and bite in `short-1.mkv`. Silverbolt's approach is corrected in model space. The doll hovers above Selena's palm until the jaws reach her at 3.75 seconds of the clip. Her center then follows the socket behind the front teeth. She stays 13.5 cm tall in the scene as the head turns. The skull, teeth and doll share a depth buffer.

## Voices, Music and the lower scroll, 24 Nov 2026

- **Voicelines.** Guinevere opens the selector. Each of the ten portraits has its own framing. Eight language buttons play the selected character's lines. The small drone hovers to the right of the name.
- **Music.** The two lists share a vinyl deck. The selected release uses the disc print from the Music room. A sleeve preview follows the pointer on a track. The title carries the release's available listening links. The backdrop and drone respond to the playing audio.
- **Dance, shock and chase.** Music scrolls up to reveal Tetra already dancing on the ground. Silverbolt flies across with the doll in its mouth, Tetra is shocked and runs after it from behind (the kite was removed on 24 Nov 2026). Below the story, the doll leads Silverbolt and Tetra. Scroll controls travel in both scenes. Pausing holds their positions while their flight, dance and running cycles continue. Reversing turns the pair about the middle between them (the doll stays in front) and changes the facing of Silverbolt and Tetra.
- **Comic and artwork.** Tetra sits, draws a small book, reads it and throws it away. The book is made of shapes in her scene, no picture on it (24 Nov 2026), held from below by her palms and turned up toward her face. The two comic links use the supplied selections from `scripts/home/media/comic_cards.py`. In Artwork, Tetra swipes with the spiral. The flying drone occupies its last slot and passes behind and in front of her.
- **Collection.** Tetra and the drone say goodbye in the center. Tetra runs left as the first cover slides in from the right. The two share the travel distance in `sections/archive/route.ts`. Reversing the scroll turns her back toward the center. The lower sections leave the scroll position in the visitor's hands.

## Current: read these

| Note                                                                                                                                 | What it covers                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel.md`                                                                                                                          | The kernel: the stage, the scroll `S`, the section runner, the grounds, `window.__home`, the lab. Start here.                                  |
| `kernel-scrub.md`                                                                                                                    | Scroll zones: a play with a `span` is a pure function of the scroll, with an idle snap. How to author a zone, `noSnap`, the tables in screens. |
| `kernel-plays.md`                                                                                                                    | Clock plays (a scene that runs for a time and holds the scroll) and the validation of a section's table.                                       |
| `kernel-snap.md`                                                                                                                     | Input energy, the ready gate, the joint snap, the flick.                                                                                       |
| `toon.md`                                                                                                                            | The shared toon (cel) shader and outline used by every model.                                                                                  |
| `infra.md`, `media.md`                                                                                                               | Shared infrastructure (loading lists, caches), the media derivatives and the voice gain.                                                       |
| `boot.md`                                                                                                                            | The loader (3D drone), the tap gate, the 2 second intro. The "13 second" and "dialogue box" parts are old: round two shortened it.             |
| `fx-backdrop.md`                                                                                                                     | The live backdrop: the second WebGL canvas with about 30 shader grounds.                                                                       |
| `fx-image-field.md`, `fx-logo.md`, `fx-marks.md`, `fx-video-plane.md`                                                                | The picture field, the logo wave, the comic marks and trails, the film plane.                                                                  |
| `actor-drone.md`, `actor-duo.md`, `actor-doll.md`, `actor-gramophone.md`, `actor-tetra.md`, `actor-silverbolt.md`, `actor-selena.md` | One note per actor. They were written in round one and patched later: read the round notes below for the final behaviour.                      |
| `actor-buddies.md`                                                                                                                   | The pair: the drone that carries the doll, the dock, the lock, the guests.                                                                     |
| `models-selena-silverbolt.md`, `models-doll-gramophone.md` (and their folders)                                                       | How the models were built from the owner's source files (`scripts/home/models/`).                                                              |

## Round notes, in order (history of why it is as it is)

Each one is the report of a helper for one part of one round. Read the ones for the part you touch, newest last.

| Round | Date   | Notes                                                                                                                                                                                                                                                                        |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 18 Nov | `section-hero-aspirants`, `section-rows-strip`, `section-voices-music`, `section-funny-chase`, `section-bend`, `section-archive-footer`, `section-selena`, `integration-W4A`, `integration-W4C`, `integration-W4-D`, `integration-W4-E`. The first build of the 16 sections. |
| 2     | 19 Nov | `round2-R-A`, `round2-R-A1` to `A4` (loader, intro, hero, wall, strip), `round2-R-C`, `round2-R-D`, `round2-R-F`, `round2-ux`. Triggered scenes, 30 backdrops, the toon cast, a UX pass.                                                                                     |
| 3     | 20 Nov | `round3-H1` (hero), `round3-H2-rows`, `round3-H2-wall`, `round3-H3` (strip), `round3-K7` (scroll zones), `round3-M-pool` (the wall's 120 picture pool), `round3-R2`, `round3-R3`.                                                                                            |
| 4     | 20 Nov | `round4-SB-dragon` (side-view dragon, straight head), `round4-DOLL-look-ride` (anime doll, rider physics).                                                                                                                                                                   |
| 5     | 20 Nov | `round5-L2` (list, light only plumbing), `round5-S-strip` (light strip, no overlay, steady exit), `round5-W-wall` (eased wall).                                                                                                                                              |
| 6     | 20 Nov | `round6-BUDDY-actor` (the pair), `round6-DESC-descent` (the new section), `round6-ORYZO` (the character list as a film strip).                                                                                                                                               |
| 7     | 20 Nov | `round7-SEL-render`, `round7-SEL-anim`, `round7-SEL-out` (the white sheet), `round7-SEL-camera-sky`, `round7-CAM-landscape`, `round7-CAM-portrait` (cameras fitted to the game's recording), `round7-NOBG`.                                                                  |
| 8     | 20 Nov | `round8-FIX-hero-wall-strip`, `round8-FIX-pair`.                                                                                                                                                                                                                             |
| 9     | 20 Nov | `round9-FIX-strip-exit`, `round9-FIX-descent`, `round9-VIS-descent` (the descent filmed and the glitches fixed), `round9-FIX-chars` (new Guinevere, Vexana and Ruby pictures, Chang'e's video).                                                                              |

## Deleted parts: history only

These describe sections or actors that were removed. Do not build on them.

`section-bolt-fall`, `section-hand-list` (its list half was rebuilt in round six), `actor-hand`, `round2-R-B`, `round3-R1`, `round4-SEC-bolt-fall`, `round4-DOLL-fall` (the doll's fall as its own section; the fall loop itself, `actors/doll/fall.ts` and `public/models/home/doll-fall.json`, is still part of the doll actor), `round5-L1`, `integration-W4-B`.

## Other folders

`docs/design/home-reference/` holds the studies of the reference sites the owner named (premotio, oryzo, psychoactive and tibdigital) and the media inventory. `docs/superpowers/plans/home-wave*-workflow.js.txt` are the scripts that ran each wave of helpers; their prompt strings are plain text and make good briefs for any tool (see `docs/HANDOFF.md`, "Working with helper sessions").

## Round ten, 24 Nov 2026

Request word for word: `docs/superpowers/specs/2026-11-24-home-feedback-10-request.md`. Blends between all of Tetra's poses, the kite removed and the dance, the shock and the run in its place, the doll always in front when the chase turns, and a new book. Read `actor-tetra.md` section 9 and the head of `section-funny-chase.md`.

Round eleven, 24 Nov 2026 (`docs/superpowers/specs/2026-11-24-home-feedback-11-request.md`): the strip's stuck dot is gone, the descent's drone follows the cursor (`sections/descent/runtime.ts`, `pulled`), Selena's small picture in the list is her 3D model (`sections/list/runtime.ts`, `previewRect` and `drawPreview`), her files and the dragon's are waited for (`sections/list/preload.ts`, `sections/selena/preload.ts`), Selena's growth and her way out have a top scene speed (`MAX_ZONE_SPEED` in `kernel/engine.ts`) and no idle snap (`noSnap`), and the drone is in front while the frame grows (`sections/list/pair.ts`).

Round twelve, 25 Nov 2026 (`docs/superpowers/specs/2026-11-25-home-feedback-12-request.md`): the voices' way in is a clock trigger (`sections/voices/stations.ts`), the funny and chase sections have a top scene speed through `HomeSection.topSpeed` (`kernel/speed.ts`, the engine builds the ranges), the "!" over Tetra is gone, the funny's drones and words leave smoothly on a hard scroll, the doll sprints and is terrified (`sections/chase/runtime.ts`, `actors/doll`), and Tetra stops, waits for the pair to pass and then chases them when the scroll turns back (`sections/chase/tetra-path.ts`).

Round thirteen, 25 Nov 2026 (`docs/superpowers/specs/2026-11-25-home-feedback-13-request.md`): the book has no shadow (`actors/tetra/props/book-mesh.ts`), every scroll zone has a top scene speed (`kernel/speed.ts`, the bend and the archive name slower ones), the voice line count is 3,046 (`scripts/library/build_index.py`), the footer's bar is thick and in the accent colour, the archive is gone before the footer's card rises (`sections/archive/plays.ts`, `route.ts` `AT.cardFrom`), and Selena's small picture in the list goes on to the left with the row (`sections/list/runtime.ts`).

Round fourteen, 25 Nov 2026 (`docs/superpowers/specs/2026-11-25-home-feedback-14-request.md`): a hard scroll through the character list and Selena's section no longer leaps over her animations: the passage has a top speed over its rests too, the page is held beside the scene (`HELD_LEAD`), and a hard scroll stops at gates (the frame at rest in the list, the frame grown to the screen, the two ends of her film), `kernel/speed.ts`, `kernel/engine.ts`.

Round fifteen, 25 Nov 2026 (`docs/superpowers/specs/2026-11-25-home-about-feedback-15-request.md`): rounds twelve to fourteen were checked again and the scroll was made one rule. The flick limiter, the held lead and the gates of round fourteen are gone: the scene has a top speed everywhere and the page is held close to it (`kernel/speed.ts`, `SceneGovernor`; `kernel-snap.md`, "The scene's top speed"). The lower passages have a speed over their rests too, the footer's card rises where the scene is, the carry into the voices' way in plays it, the chase's sweat drop is gone and the running doll is bigger. Probes: `scripts/qa/home/flick-walk.cjs`, `voices-white.cjs`.
