# Home page rebuild: the design and the calls (18 Nov 2026)

The request, word for word, is in [`2026-11-18-home-page-request.md`](2026-11-18-home-page-request.md). The recon that this design rests on is in `docs/design/home-reference/` (ten digests: read the one for your area before you start). The ledger of what is done is `docs/superpowers/plans/2026-11-18-home-redesign-progress.md`. Read it first when you resume.

## 1. What it is

The home page `/` is a showpiece, not an information page. It hooks the visitor with one long, scroll-driven, WebGL-heavy story of about 60 screens, and every section ends in a button to the real page. One persistent canvas holds the actors (the drone, the two Guinevere drones, Silverbolt, the Obsidia doll, Selena's hand, Selena herself, the gramophone, Tetra) and a field of pictures. The look is the site's own (daybreak ground, ink, pink and gold accents, Big Shoulders and Instrument Serif, mono labels, hairlines, pill buttons), with dark "cinema" sections where the reference needs them.

## 2. The calls (decisions the request leaves open)

Read these before anything else. Each is the owner's wish read one way, with the reason.

1. **The drone loader runs on a document load of `/` only** (a visit from outside the site, or a reload). A visitor who lands on another route keeps the logo curtain. An in-site arrival at `/` (a menu click, a Back) uses the curtain, then the hero opens at rest with the logo already big and the nav empty: the intro does not replay. `aspirants:intro = off` (tests, probes) mounts the home in the open state with everything shown and no holds.
2. **No fake progress.** The cover painted by the boot script stays until the drone's chunk and model arrive (real bytes, the existing bar). The drone then takes over the same bar. Rotating lines cycle the real `pending` labels. The displayed percent may lag the real one and never leads it, and 100 appears only when the list is done. "Touch anywhere to continue" also answers Enter and Space, and calls `audio.unlock()` inside the press. `entered` is set at the end of the intro, not at the tap.
3. **The intro cannot be skipped** (the owner wants it watched) and is at most 10 seconds from the tap. The scroll is held for it with `seams/scroll-lock.ts` and a long `limitMs`, never `lenis.stop()`.
4. **The home hides the browser scrollbar** (`BareScrollbar`), as `/about` and the long character pages do.
5. **Psychoactive hero and expand follow the reference exactly**: the strip (3.7 to 1), the labels, the word swap, the expand to the 16:9 scene width (not full bleed), the pull, the hold with the floating previews and the push. The reference's `clip-path`, `filter` and width tweens are rebuilt as transform and opacity (digest `ref-psychoactive-tib.md`, section 1.13). No confetti, no balloons (the owner never asked for them). The labels "PLAY REEL" and the duration in the small state are dropped (the owner removed play there); after the expand the frame shows a play button, "Play Films" and the duration, and a press opens the site's player (`PlayerOverlay`) with sound.
6. **The hand is Selena's black clawed glove** (the only hand the sources hold). `hand.jpg` is the pose reference only: a palm-up open hand reaching to the camera, the wrist below the viewport edge, with a soft bottom fade so no cut shows.
7. **The doll hovers over Selena's RIGHT hand (the screen-left one)** in `city_intercation03`, as `short-1.mkv` shows.
8. **Official art only** in the hero, the carousel and the spiral (18 official pictures of `arts-splash.json`, and the ten single-character items for the spiral). Pictures marked "Made for this site" stay out. Fan art (the bending section) uses the 15 credited group pictures, each with its credit on hover and a `ReportLink` in the section.
9. **"Angela in the center" means Tetra.** The owner says Tetra's model, in the same paragraphs. The fan wall and the circle surround Tetra.
10. **Takedown shortcut.** The home shows 3D models (Selena, Silverbolt, the doll, Tetra) and fan art, so the archive or the footer carries one small `ReportLink` ("Copyright or takedown"). The About page keeps its own exemption.
11. **Home to About.** The footer's last scroll flies the home drone out to the right and covers the page with the daybreak ground for a moment while `/about` mounts; About's opening already brings the drone in from the right. No cross-route layer.
12. **Copy and writing rules.** No em or en dashes ("2022 - Present" with a hyphen), "Aspirant power" never the other word, "Terrinia", "Selrick", "Storm Citadel". Nothing is claimed beyond what the owner wrote and what the site's data says. "Guenevere", "Guienvere" and "Chang'e" are written Guinevere and Chang'e.
13. **Loudness.** Every voice clip gets a baked gain `g` (a field in its record, written by the voicelines pipeline, target -18 LUFS, true peak ceiling -1 dB), applied by `audio.playVoice`. This also fixes `/collection/voicelines`. No file is re-encoded and no R2 key is written.
14. **WebGL budget: one canvas, one renderer** for the whole home. The three scenes of `/about` stay as they are for that page (an optional, additive way to inject a renderer is allowed). The home never creates a second context.
15. **One version.** No quality tiers, no reduced motion, no per-device downgrades. Effects are made cheaper for everyone. Judge on the production build with `scripts/perf/weak.mjs`.

## 3. Architecture

### 3.1 Layers (z order, all `position: fixed` in one stage)

| z   | layer                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0   | background: two stacked grounds that cross-fade by opacity (daybreak, storm, or a section colour)                            |
| 1   | `below` DOM: frames, video windows, anything a 3D actor must pass in front of                                                |
| 2   | the one canvas (`pointer-events: none`): the picture field, the logo, every actor, the blur panels and the post passes       |
| 3   | `text` DOM: titles, copy, buttons, labels, the cursor tooltips. Text never sits under an actor unless the section says so    |
| 90  | the loader and the intro (outside `#site-shell`, which the gate makes inert; above the curtain; under the lantern cursor 95) |

The canvas takes no pointer events. One window listener turns a press or a move into a 3D hit test when the target is not an interactive DOM element (`[data-home-hit="dom"]`, links, buttons). Actors register `hit(x, y)` and their reactions with the kernel. The site's cursor shows a label through `data-cursor` for DOM and through a kernel call for 3D.

### 3.2 Scroll

One tall scroller (Lenis, `BareScrollbar`). `S = scrollY / innerHeight` is the position in screens. Every section is a range `[start, start + screens]` computed from the table in 4. One `requestAnimationFrame` loop (the kernel's) reads the smoothed scroll once per frame and calls the active sections. Nothing else runs a loop on the home. Sections are **stateless in the scroll**: a section's `update(local, frame)` fully specifies every actor it shows as a pure function of `local` (0 to 1, a little outside it inside the section's `lead` and `tail`) and of the section's own interaction state (what was hovered, which record was chosen). The kernel hides every actor before the active sections run, so an actor that a section does not set is not shown. A jump (scrollbar, Back, a reload part way down) works because the sections that were passed are run once at `local = 1`, in order, so the last writer wins. Native scroll anchors are not used; a reload starts at the top.

Everything a visitor needs at once (a headline, a button) is real server HTML inside the section's DOM, so crawlers and no-JS visitors get all the copy. With no WebGL, `data-gl="off"` lays the sections out as a plain readable page (a failure handled, not a version).

### 3.3 Files (all under `apps/web/src/features/home/`)

```
kernel/        stage (renderer, passes, camera helpers), clock (the one rAF), scroll (S and ranges),
               sections (registry, run and seek rules), pointer (3D hits, cursor), actors (registry, hide
               by default), background (grounds), preload (aggregates every section's items),
               handoff (to /about), probes (window.__home), types.ts (the contracts)
actors/        drone/ duo/ silverbolt/ doll/ selena/ hand/ gramophone/ tetra/ props/ (kite, records, comic book)
fx/            image-field/ (cards, aberration smear, wake field, ring, wall), logo-wave/, comic-marks/, trail/
sections/      one folder per section id in table 4, each with: view.tsx (server markup), runtime.ts (the
               scene logic: a plain TS class), preload.ts, content.ts, tests
boot/          the drone loader, the tap gate, the intro (carry the logo)
content.ts     all copy, links and the data picks (server side)
```

`app/page.tsx` stays a server component (`title.absolute`, a new description) and renders `<HomeStage>` (client shell) around the server `<SectionView>` markups. Engines are plain `.ts` classes with a thin `"use client"` component (the React Compiler lint rules fail the other style). Lazy chunks use `chunkItem`.

### 3.4 The contracts (the kernel owns the exact types in `kernel/types.ts`; this is the shape)

```ts
interface HomeSection {
  id: SectionId;
  screens: number;
  lead: number;
  tail: number; // screens
  bg: "daybreak" | "storm" | string; // ground at this section
  nav: { theme: "daybreak" | "storm" }; // nav lock theme
  preload(): PreloadItem[]; // waited and deferred items
  mount(ctx: SectionCtx): SectionRuntime | Promise<SectionRuntime>; // called when the section is near
}
interface SectionRuntime {
  update(local: number, f: FrameInfo): void; // pure in local plus own interaction state
  enter?(): void;
  leave?(): void; // play/pause videos, start/stop audio
  dispose(): void;
}
interface SectionCtx {
  stage: Stage;
  actors: Actors;
  dom: { below: HTMLElement; text: HTMLElement; root: HTMLElement };
  viewport(): { w: number; h: number; dpr: number };
  pointer: PointerState;
  audio: AudioApi;
  expectReady(id: string): () => void;
}
```

Actors are objects with `root`, `visible`, a `place` in screen pixels or world units, a `face`, `mark(kind)`, and the poses their sections need. Each actor owns its model, its scene part and its own tests. A section never reaches into an actor's internals.

### 3.5 Shared files protocol

The kernel owner edits shared infrastructure once, early: `lib/nav-lock.ts`, `components/nav/*`, `components/loader-gate.tsx`, `app/layout.tsx` boot script, `lib/route-preloads.ts` (the `/` branch only), `lib/audio.ts` (`playVoice` gain). Everybody else asks the kernel owner for a hook or adds it in their own folder. `CLAUDE.md`, `HANDOFF.md`, `README.md` and `docs/design/design-system.md` are edited by the integrator at the end: every workstream writes its notes to `docs/design/home/<workstream>.md` (how it works, files, the numbers to tune, what is not verified).

## 4. The scroll story (screens; each owner may move its length by up to a quarter)

| #   | id          | start | len | what happens                                                                                                                                                                                                             |
| --- | ----------- | ----: | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | `boot`      |   n/a | n/a | the drone loader, the tap gate, then the intro (carry the logo). No scroll.                                                                                                                                              |
| 1   | `hero`      |     0 | 4.2 | big logo and the floating splash cards (premotio hero): the cards above the logo leave first, the logo morphs into the bar with a travelling wave, the cards fall to the bottom, spiral into a ring and land as the wall |
| 2   | `aspirants` |   4.2 | 1.6 | the wall slides by itself (wide cards, hover lifts, VIEW cursor, click opens the preview); the text on the right; the text closes at the end                                                                             |
| 3   | `rows`      |   5.8 | 2.4 | the angled rows scroll left, a small angled video appears between the cards, the rest leave, the video turns upright into the strip (3.7 to 1)                                                                           |
| 4   | `strip`     |   8.2 | 3.1 | psychoactive hero (labels, hover word swap) then the expand, the pull and the hold: "Official animations for The Aspirants" with the orbiting previews; the drone leaves the screen                                      |
| 5   | `bolt`      |  11.3 | 4.0 | the previews and the video fly off to the bottom right on flexible lines; Silverbolt with the doll on its head flies bottom right to top left (tib), stops in the middle, the five pair names turn on the text wheel     |
| 6   | `fall`      |  15.3 | 2.6 | at 75 percent of the way the doll falls, the camera follows and zooms; air-resistance marks; "5 Phases", then "10 Characters" either side of her                                                                         |
| 7   | `hand`      |  17.9 | 3.4 | Selena's hand rises from the bottom, the doll lands and sits in the palm; "2022 - Present", the hint "Try to hover"; the hand and doll sink                                                                              |
| 8   | `list`      |  21.3 | 8.6 | oryzo's list: the hand sets the doll on the first frame and leaves; "Characters" on the left, the name changes; nine 4:5 frames; the tenth frame is Selena in 3D and it expands to the screen                            |
| 9   | `selena`    |  29.9 | 3.8 | the drawer ("Immersive Interaction"), Selena in `city_idle` fully interactive with Silverbolt; then `city_intercation03`: the doll floats on her hand, Silverbolt eats it, then flies past the camera into white         |
| 10  | `voices`    |  33.7 | 2.4 | the character chooser, the curated lines (Japanese, English, then the rest), the splash art on the right; the two Guinevere drones arrive                                                                                |
| 11  | `music`     |  36.1 | 2.8 | the drones leave, the screen locks, they bring the gramophone and the record crate; choose a track, a drone sets the disc, the other cranks, notes float                                                                 |
| 12  | `funny`     |  38.9 | 4.2 | Tetra and her kite; Silverbolt crosses right to left with the doll cursing in its mouth, breaks the string; the drones stare; they come to the middle: "What's going on?" and "Read The Story"                           |
| 13  | `chase`     |  43.1 | 4.0 | the doll runs, Silverbolt chases, Tetra chases and runs out of breath; she sits and reads a comic; zoom: COMIC and the two comics                                                                                        |
| 14  | `bend`      |  47.1 | 9.0 | Tetra closes the book and bends the pictures (garuda hero of fan art), the ring of pictures around her, the spiral of splash arts; the last picture is the drone, it climbs out of the paper and meets Tetra             |
| 15  | `archive`   |  56.1 | 3.0 | the collection (the ten rooms) with the drone as the spotlight                                                                                                                                                           |
| 16  | `footer`    |  59.1 | 1.2 | the redesigned footer: "Scroll more to see the about page"; the drone flies out to the right and `/about` opens                                                                                                          |

Total about 60.3 screens.

### 4.1 Boundary states (the joints: both sides must agree)

A section's `update(0)` equals the previous section's `update(1)` for every actor and for the picture field. These are the joints:

- **J0 intro to hero.** The logo is centred, 70 percent of the viewport width (art box, aspect 4.013). The drone rests lower right (x +0.30 W, y -0.22 H from the centre, 0.17 H tall). The nav is empty until the intro ends, then the menu and the sound button fade in, and a scroll cue ("Scroll to explore", a hairline that draws) shows under the logo.
- **J1 hero to aspirants.** The field is the wall: three rows of wide cards (16:9), twist 35, tilt 53, roll -6 degrees (premotio's numbers, digest), the left 58 percent of the screen. The right 42 percent is empty ground for the text.
- **J2 aspirants to rows.** The text is gone, the rows fill the screen at the same angle, still sliding.
- **J3 rows to strip.** The video plane stands upright at the scene centre: width 0.45 of the scene width, visible height 0.1217 of it (3.70 to 1), the dark ground is on, the pictures are gone.
- **J4 strip to bolt.** The previews and the video leave to the bottom right; the drone has left the screen (exit to the upper right during the hold); the ground is dark green-black with the bloom.
- **J5 bolt to fall.** Silverbolt is at 75 percent of its path (upper left, scale 1.3); the doll is just leaving its head, arms up.
- **J6 fall to hand.** The doll is in the air above the palm, upright, at the centre; the hand's fingertips show at the bottom edge.
- **J7 hand to list.** The doll is on the palm; the hand has sunk to 0.3 of the screen height from the bottom.
- **J8 list to selena.** The 3D frame covers the screen; the doll hangs by one hand from the top, to the right of where the text will be; Selena is in `city_idle`.
- **J9 selena to voices.** The screen is white (daybreak ground). Silverbolt has just left. The duo is at the right and left edges, off screen, ready to float in.
- **J10 voices to music.** The duo is at the bottom corners; the list fades.
- **J11 music to funny.** The music has stopped (fade 600 ms); the stage is empty daybreak; the duo hover high at the left.
- **J12 funny to chase.** The duo stay in the funny section: they scroll up with the page and are gone. The stage is empty and light.
- **J13 chase to bend.** Tetra stands centre with the comic put away; the pictures start to fly in from the edges.
- **J14 bend to archive.** The drone and Tetra are at rest side by side at the lower left; the pictures have gone; the ground is light.
- **J15 archive to footer.** The drone is at the centre of the footer card.

## 5. The actors

| actor        | source (see digests)                                      | model file (new)                                   | state of the art after the work                                                                                                                         |
| ------------ | --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drone`      | `public/models/about/drone.glb` (do not change)           | none                                               | in the shared renderer; faces: add a shocked, a confused and a thanks cell by a second atlas; marks: bang, bubble with icons; loader and follower       |
| `duo`        | `public/models/about/companion.glb` (do not change)       | none                                               | six rigid parts and floating gloves: carry, pull, crank, dance, confusion faces (per-side lids and brows added in a copy of `face.ts`)                  |
| `tetra`      | `public/models/about/tetra.glb` (do not change)           | none                                               | add knee, shoulder, wrist and neck channels, a two-bone arm IK, hand sockets; poses: kite, run, pant, wave, sit, read, bend, idle                       |
| `silverbolt` | `D:\ren\aspirant\3d\selena_silverbolt_raiko` (entrance)   | `public/models/home/silverbolt.glb` (about 0.3 MB) | chained tail with FABRIK, jaw, blink (gem split), flight loop (procedural), trail, comic marks, annoyed state                                           |
| `doll`       | `D:\ren\aspirant\3d\obsidia\Meshy_AI_chibi_boxer_doll...` | `public/models/home/doll.glb`                      | metres and recentred, a procedural face (about 40 blendable uniforms), poses: ride, scream, fall, sit, swing, hang, run, pose in palm                   |
| `selena`     | the entrance file (Selena NORMAL only)                    | `selena.glb` (about 2 MB) + `cameras.json`         | clips `city_idle`, `city_interaction_R_loop`, `city_interaction_back_R`, `city_intercation03`, baked camera for 03, hair and skirt springs, face morphs |
| `hand`       | Selena's LEFT glove and bracer cut from `body_01`         | `hand.glb` (about 0.3 MB)                          | no visible cut, a palm-up pose, finger curl from the cursor, an idle breath                                                                             |
| `gramophone` | `D:\ren\aspirant\3d\gramophone`                           | `gramophone.glb` (about 0.6 MB)                    | aligned, crank and platter and tonearm pivots, a lit PBR material with one PMREM                                                                        |
| `props`      | built in code                                             | none                                               | records (grooves, a label with the cover), the crate, the kite and its string ribbon, a comic book                                                      |

Shared GLBs of `/about` (`drone.glb`, `companion.glb`, `tetra.glb`) are never edited. Additions are made at runtime. Everything new goes to `public/models/home/` by scripts in `scripts/home/` (never edit an output by hand). A file replaced under the same address needs the cache-name bump in `lib/media-store.ts`.

## 6. Loading

`homeItems()` (in `features/home/preload-items.ts`) aggregates the sections' lists and replaces the `/` branch of `lib/route-preloads.ts`. **Waited** (first paint, about 5 to 6 MB): the drone chunk and model (first), the duo model, the logo path data, the hero cards (about 1 MB), the carousel set (about 2.2 MB, so the wall is ready), the first seconds of the trailer strip and the rows' small video, the fonts, the stage chunk. **Deferred**, in section order by `priority` (about 38 MB): the preview clips, Silverbolt, the doll, the hand, Selena and her cameras, the character loops, the voice lines and covers, the gramophone, Tetra, the fan pictures. A deferred item that the visitor reaches first shows its loading state, never a different page. Video is short, low-resolution cuts loaded whole with `mediaItem` (`scripts/home/media/`), the long trailer is streamed (`warmFilm` style). Voice lines load on demand through `audio.playVoice`. No timer, no cap (CLAUDE.md "Loading").

## 7. What changes in the rules (the integrator writes these into CLAUDE.md at the end)

- A ninth autoplay exception: the home plays muted pictures and short clips by itself while on screen (the rows' video, the strip's trailer loop, the preview clips, the list's loops), paused when off screen; sound only on a press.
- A section "The home page" (this design in short) and the loader line: the drone loader runs on a document load of `/`.
- The WebGL rule: one canvas on the home; lit PBR materials for the gramophone, the hand, Selena and Silverbolt are a recorded exception to the unlit style.
- `scripts/qa/probes` and `scripts/perf/weak.mjs` set `aspirants:intro = off` (or tap the gate).

## 8. Workstreams and waves

Wave order, each wave a workflow. A wave starts when the previous one is verified. Every agent: reads the request, this design and its digest; writes only inside its folders; does not run `pnpm build`; does not commit or push; uses the dev server on `http://localhost:3100` (`npx next dev -p 3100` from `apps/web`, started once by the kernel owner); looks at its own screenshots before it reports; writes `docs/design/home/<ws>.md`; adds a unit test for every pure function it writes.

- **Wave 1 (parallel):** `K` kernel and walking skeleton (this is the fallback that can ship alone); `M1` models: Silverbolt, Selena, hand, cameras; `M2` models: the doll with its face system, the gramophone, the kite art, the extra drone faces; `D` media: hero and carousel sets, trailer and preview cuts, character loops, the voice gain.
- **Wave 2:** `A` boot loader, tap gate, the intro, the drone and duo actors in the shared renderer; actor workstreams `SB` (Silverbolt), `DL` (doll), `SL` (Selena), `HD` (hand), `GR` (gramophone and records), `TT` (Tetra).
- **Wave 3 (sections):** `S1` hero + aspirants + rows (the field, the logo morph); `S2` strip (psychoactive); `S3` bolt + fall; `S4` hand + list + selena; `S5` voices + music; `S6` funny + chase + comic; `S7` bend + archive + footer + the about handoff.
- **Wave 4:** integration, performance on the production build, the full probe pass at 1440x900, 1706x950 and 390x844, accessibility, docs, the push.

Definition of done for a section: it runs from a real wheel at the three sizes; its first and last frames match the joints; its interactions work by mouse and by touch; its files are in the loading list; it has a probe step and a unit test for its pure parts; `pnpm check` passes; it has a notes file. A section is never polished before every section works.

## 9. QA protocol

`window.__home` (kernel): `seek(screens)`, `freeze(on)`, `state()`, `skipIntro()`, `actor(name)`. The probe `scripts/qa/probes/home.cjs` takes a frame sheet of every section at its 0, 25, 50, 75 and 100 percent with a real wheel and with `seek`, at 1440x900, 1706x950 and 390x844, in real Chrome. The e2e specs stay on `skipGate`. Judge speed on `pnpm build` plus `serve out`, with `scripts/perf/weak.mjs`.
