# Home: the kernel and the walking skeleton (workstream K)

The frame every section of the rebuilt home stands on, and a version of the page that already ships on its own: sixteen sections with their real copy and links, a placeholder visual each, one canvas, two test meshes that move with the scroll, the way out to `/about`. Design: `docs/superpowers/specs/2026-11-18-home-page-redesign.md` (sections 3 and 4). Code: `apps/web/src/features/home/`.

## 1. What a visitor gets today

- `/` is one scroll of 60.3 screens (the sum of the section lengths) plus the one screen the viewport covers. Sections fade their copy in and out in place. The ground cross-fades between daybreak, storm and a dark green-black at the joints. A pink flat card (pixel orthographic pass, hero) and a blue wireframe box (pixel perspective pass, aspirants) move with the scroll and are hidden outside their sections. The top bar is bare and follows the section's theme.
- The footer is the last 1.2 screens of the page and lives in the page's own flow. The Continue button, the N key and the scroll to the very end all take the visitor to `/about` (cover, page change, uncover; no curtain).
- No WebGL (or no scripts): `data-gl="off"`, the sections follow each other as a readable document, no decoration, no canvas, no errors.

## 2. Structure

```
kernel/types.ts       the contracts (section 4)
kernel/layout.ts      pure: where each section sits (start, end, from, to), local, run and mount rules
kernel/scroll.ts      pure: the scene's follow of the scroll (SceneScroll), screensOf, screensToEnd
kernel/run.ts         SectionRunner: mount, enter and leave, settle after a jump, hide actors, run
kernel/stage.ts       the one WebGLRenderer, passes, pixel cameras, render targets, context loss
kernel/clock.ts       the one requestAnimationFrame loop and its ordered callbacks
kernel/background.ts  the three ground layers and groundAt(S)
kernel/pointer.ts     PointerHub: window pointer, 3D hit targets, DOM controls win
kernel/cursor.ts      CursorProxy: a label for the site's cursor from a 3D target
kernel/actors.ts      ActorRegistry: hide by default, last writer wins
kernel/hold.ts        the scroll hold (wraps seams/scroll-lock.ts, bound by the shell; holds are counted)
kernel/plays.ts       pure: triggered scenes (HomePlay, PlayMachine), see kernel-plays.md
kernel/where.ts       sectionStart(id), sectionScreens(id): lengths and positions read from the registry
kernel/handoff.ts     the way to /about: claim, cover, push, wait, uncover; the exit hook
kernel/probes.ts      window.__home
kernel/preload.ts     aggregateItems (every section's list in one)
kernel/stub.ts        StubRuntime: the skeleton's runtime (fades the copy). Delete when the last stub is gone.
kernel/sections.ts    the registry: sixteen imports and an array
kernel/engine.ts      puts it all together (a lazy chunk)
home-stage.tsx        "use client" shell: layers, mode, nav lock, hold binding, engine start, focus seek
home-page.tsx         server: every section's markup into the shell
footer-action.tsx     "use client": Continue, N, the scroll to the end
views.ts              server: id -> view()
content.ts            all copy and links
preload-items.ts      homeItems(), called by lib/route-preloads.ts for "/"
home.module.css       layers, slots, plain mode, type, pills
ui.tsx                Pill, Stub
sections/<id>/        index.ts (the registry entry), view.tsx (server), runtime.ts, preload.ts
```

The server and the client share only data. `kernel/sections.ts`, `preload-items.ts`, every `index.ts` and every `preload.ts` import constants and `@/lib/preload`, never a runtime and never three.js, because `lib/route-preloads.ts` is in the bundle of every page. A runtime reaches the page only through `mount: async (ctx) => (await import("./runtime")).createRuntime(ctx)`. The stage and the engine are one lazy chunk (`chunk:home-engine`, waited for).

## 3. Layers and the page's height (the contract)

In a browser with scripts and WebGL (stage mode), inside `<main>` (which is a stacking context at z 1, under the bar at 50):

| z   | layer                                                                                            | element              |
| --- | ------------------------------------------------------------------------------------------------ | -------------------- |
| 0   | the grounds: daybreak (28 px dot grid), storm (`#05070c`), a plain colour; cross-fade by opacity | `.grounds`, fixed    |
| 1   | `below` DOM: frames, video windows, anything an actor passes in front of. `aria-hidden`          | `.below`, fixed      |
| 2   | the one canvas, `pointer-events: none`, `inset: 0` (never `100vw`), made in code by the stage    | `.canvasHost`, fixed |
| 3   | text DOM: titles, copy, buttons, labels. Real HTML, readable without scripts                     | `.text`, fixed       |

All four are `top: 0; left: 0; right: 0; height: 100lvh`. Each section has a slot in `.below` (`data-home-below="<id>"`) and one in `.text` (`<section data-home-section="<id>" data-home-text="<id>">` holding one `[data-home-content]`). The kernel sets `data-on="1"` on a slot while the section runs (from its lead to the end of its tail) and `"0"` outside. A slot that is off is `visibility: hidden` (below) or `opacity: 0; pointer-events: none` (text: it stays in the document, so a reader of the page and the keyboard still find it, and `focusin` on a control of an off section moves the page to that section). Interactive children of a text slot take pointer events (`a`, `button`, `[data-home-hit="dom"]`). A section's runtime moves and fades `[data-home-content]` (never the slot: the slot's opacity is the kernel's). Hidden start states are written only under `:root.js`, so no-JS visitors and crawlers see everything.

**The track.** The `.track` div is an empty in-flow block of `trackScreens x 100lvh` (everything but the footer); it gives the page its length. **The footer** (the last section, `dom: "flow"`) is an in-flow block of `(screens + 1) x 100lvh` after the track, with one sticky `100lvh` stage inside that rises over the fixed layers (z 3). That is why `Continue to About` is a real, scrollable, clickable button from scroll 0 (the e2e chain clicks it there), and why the page's end is the footer's end. Only the last section may be `flow`.

**The scene's position** `S = scrollY / unit`, `unit` the height of the layers (`100lvh`, the unit of the page's height, so a phone's address bar does not matter). A section runs for `S` in `[start - lead, start + screens + tail]`, with `local = (S - start) / screens` (0 to 1, a little outside it in lead and tail). The document is `total + 1` screens high, so `local = 1` of the last section is the very end of the page.

**Modes** (`data-gl` on `[data-home]`): `pending` (server markup and the first client render, treated as stage), `on` (WebGL: the engine runs), `off` (no WebGL, the stage failed for good, or no scripts: the layers are blocks, `.below`, `.grounds`, `.canvasHost` and the track are `display: none`, each section carries its own theme's ground, a section with no words is not shown). `data-open="1"` is set (by an effect, not by rendering, so hydration agrees) when the opening has ended; until then the stage layers are `visibility: hidden`. `window.__home.state().open` says the same.

## 4. The contracts (`kernel/types.ts`)

```ts
HomeSection  { id, screens, lead, tail, bg, nav: { theme }, dom: "fixed" | "flow", carry?, preload(), mount(ctx) }
SectionRuntime { update(local, frame), enter?(), leave?(), dispose() }   // update: pure in local + the section's own state
SectionCtx   { id, stage, actors, dom: { root, below, text }, viewport(), pointer, cursor, scroll, audio, expectReady(id) }
FrameInfo    { time, dt, S, raw, velocity, viewport: { w, h, dpr }, frame }
Actor        { name, visible, object?, dispose?() }       // the kernel hides every actor before the sections run
Pass         { name, order, active(), render(renderer, frame), resize?(), rebuild?(), dispose?() }
HitTarget    { id, test(x, y) -> depth | null, cursor?, enter?, leave?, move?, press?, release? }
PointerState { x, y, nx, ny, down, type, inside, speed, hit }
CursorApi    { set(label | null) }
ScrollApi    { raw(), shown(), to(screens, { immediate }), hold(limitMs?) -> release }
SectionMarkup { below?: ReactNode, text: ReactNode }          // what a view returns
```

### The run rule (`kernel/run.ts`, tested in `run.test.ts`)

Per frame, in this order: mount what is near (within 2 screens of a section's range; a `carry` section always) -> `leave` then `enter` for ranges crossed -> after a jump, the sections that were passed run once at `local = 1`, in order -> every actor is hidden -> the sections in range run in order, last writer wins -> actor visibility is copied to `actor.object.visible`. A runtime that is still mounting is skipped, and replays `local = 1` once if it arrives passed. A runtime that throws is logged once, disposed and left out. A jump (a scrollbar drag, Back, a probe `seek`, the first frame, or the page opening) gives the same state as scrolling there slowly; `run.test.ts` holds that. While the opening is up the kernel only mounts (`prime`), it does not run.

**Consequence for a section.** An actor that a section does not set in a frame is not shown, so an actor that two sections share is set by both in their overlap (lead and tail) and the later section wins. What a passed section leaves behind that is not an actor (its DOM, audio, its own state) is replayed by its `update(1)` after a jump: keep `update` idempotent and well defined for `local > 1` and `< 0`.

### The scroll (`kernel/scroll.ts`)

`SceneScroll.step(raw, dt)`: a critically damped spring (omega 18) with the lag soft clamped (knee 0.1, ceiling 0.2 screens), after premotio's scene. `f.S` is the smoothed value, `f.raw` the real one (use `raw` for what must answer at once, a button). A step bigger than 1.5 screens is a jump and snaps. `dt` of 0 (frozen) keeps the position.

### The stage (`kernel/stage.ts`)

One `WebGLRenderer` on one canvas the stage makes in code (a canvas whose context was lost cannot be reused, so a rebuild makes a new one). Autoclear off, the depth cleared between passes, a pass drawn only while it is `active()` (a `ScenePass` is active while any child of its scene is visible), nothing drawn and the canvas cleared once when nothing is. Pixel ratio `min(dpr, 2, sqrt(8e6 / (w * h)))`. `makePixelOrthoCamera(w, h)`: one unit is one CSS pixel, origin in the middle, y up. `makePixelPerspectiveCamera(w, h, z = 1000)`: a plane at z = 0 maps one to one. `stage.scenePass(name, "ortho" | "perspective", order)` gives the shared pass of that name (made on first ask); the home has no per-section canvas. `stage.target(scale, options)` makes a render target that follows the canvas. A lost context waits 1.5 s for the browser to restore it, then the stage makes a new canvas and renderer and calls `pass.rebuild()` (three times at most, then `onFailed` puts the page in plain mode). Created only when `hasWebGL()`; construction is in a try, and a failure returns null (nothing is logged, the page goes plain). The engine is a module singleton: a second `startEngine` disposes the first (React's double effect in development).

### The ground, the cursor, the pointer

`groundAt(layout, S)` mixes the grounds of two neighbours over 0.5 screens centred on their joint; `Background.apply` writes only the three layers' own opacity and the colour layer's colour, only when it changed (nothing on `<html>` or `<body>`, ever).

The site's cursor reads `data-cursor` from the element under the pointer, and a 3D actor has none. `CursorProxy` keeps one invisible element, gives it the label and fires the `pointerover` the cursor listens to. A 3D `HitTarget` just sets `cursor: "VIEW"`. `PointerHub.resolve` runs once per frame: a DOM control (`a[href]`, `button`, fields, `[role=button]`, `[data-home-hit="dom"]`) under the pointer wins and no target is asked; otherwise the nearest hit (smallest depth) is entered, moved, pressed and released; a touch finds its target at the press and lets it go at the release.

## 5. How to add or change things

**A section.** Edit only its folder. `index.ts` is the registry entry (length, lead, tail, ground, nav theme, `preload`, `mount`). `view.tsx` is the server markup (`view(): { below?, text }`, copy from `content.ts`; `text: null` for a section with no words). `runtime.ts` exports `createRuntime(ctx)` returning a `SectionRuntime`; it is a plain class, never a React component (the React Compiler lint rules fail the other style). `preload.ts` lists the files (waited for when the first screen needs them, `deferred` with a `priority` otherwise). Replace `StubRuntime` and the `Stub` box, and delete the stub's CSS when nothing uses it. The joints (design 4.1): `update(0)` must equal the previous section's `update(1)` for every actor.

**An actor.** A plain class with `name`, `visible`, `object`, `dispose()`; build it in `mount`, `ctx.actors.register(actor)`, put its meshes in `ctx.stage.scenePass(...)`, set `visible = true` in `update` when the section shows it. A section never reaches into another actor's internals. See `sections/hero/runtime.ts` (ortho) and `sections/aspirants/runtime.ts` (perspective).

**A pass.** `stage.addPass({ name, order, active, render })` for something that draws by itself (the picture field, the logo, a post pass); `render` gets the renderer and may use `stage.target()`. Orders in use: `ortho` 10, `perspective` 20. Leave room between.

**A 3D hit.** `ctx.pointer.add({ id, test(x, y), cursor, enter, leave, press })` in `mount`; keep the return to remove it in `dispose`. `test` runs every frame while the pointer is live: keep it cheap (a projected circle, not a raycast against a skinned mesh).

**Plays (round two).** A section can declare `plays` in its `index.ts`: triggered scenes that run on a clock between stations while the scroll is held, forward going down and backward going up. `update` then gets a virtual `local`. The API, the rules, how to choose thresholds and how to test are in `docs/design/home/kernel-plays.md`. **Lengths.** Never write another section's start or length as a number: ask `kernel/where.ts` (`sectionStart`, `sectionScreens`); the rule and its test are in the same note.

**A hold.** `const release = ctx.scroll.hold(limitMs)`; call `release()` when the scene ends. Holds are counted (one lock for any number of holders, each with its own release and timer). The page has no scrollbar (`BareScrollbar`), so the hold never shifts the layout. Never `lenis.stop()` directly. Holds are skipped in tests (`aspirants:intro = off` makes the page open at once), so make a hold something the section can run without.

**The exit hook.** The last section's runtime calls `setExitHook(() => promise)` (from `kernel/handoff.ts`) to fly the drone out to the right before the page changes; the hook may return a promise and the change waits for it.

**Loading.** A section's files go in its `preload()`. Waited items are the first screen only; the rest is `deferred`. Nothing is capped or timed. The engine marks the page ready (`expectReady("home-stage")`) after two drawn frames and once the sections near the top are built, so the loading screen opens on a drawn page.

## 6. Getting out to About (`kernel/handoff.ts`, `footer-action.tsx`)

`FooterAction` arms when the end of the document is within 0.025 of a screen (`screensToEnd`, read from the document, not the scene, so it works before the engine and with no WebGL), holds that for 520 ms, and cancels if the page is scrolled back further than 0.07 of a screen. The footer is 1.2 screens long, so that is its 98 and 94 percent. Continue and `N` call the same function. It does nothing before the opening has ended. The change: `transition.claim()` (no curtain, no second change), `runPreload(routeItems("/about"))` in parallel, the cover (a `fixed` div of the daybreak ground made on `document.body` by the module, not by React, because the home unmounts in the middle of the change) fades in over 380 ms together with the exit hook, `router.push("/about")`, wait for the address (rAF and `NAVIGATED_EVENT`, no timer), `whenPageReady()`, back to the top, `REVEAL_EVENT`, focus `#main`, the cover fades out, the claim is released. A throw releases the claim and falls back to the curtain (`transition.push`). The wheel, touch and scroll keys are guarded during the change. The home resets the bar's four old fields on the plain page and the whole store on unmount (`getInitialState`); the home-only fields (`hideLogo`, `hideControls`) are cleared by the bar itself on every path change (`lib/nav-lock.ts`).

Measured (dev server, real Chrome, 1440 x 900): the cover opaque at 0.7 to 1.2 s after the end is reached, the address `/about/` at 1.8 s, the cover gone at 2.7 s, no console error.

## 7. Looking at it

`window.__home` (installed by the engine, only on the stage): `seek(screens)` (moves the page, snaps the scene, replays the passed sections), `freeze(on)` (time stops and the scroll is not read: a frame holds still), `state()` (S, raw, total, unit, open, frozen, size, stage passes and loss, the active section, every section's `local`, `running` and mount state, every actor's visibility, the 3D hit), `skipIntro()`, `actor(name)`, `sections()`.

`node scripts/qa/probes/home.cjs <outFolder>` scrolls with a real wheel and takes every section at 0, 25, 50, 75 and 100 percent, at 1440x900, 1706x950 and 390x844, in real Chrome (`BASE`, `SIZES`, `STEPS`, `ONLY` set the rest), and writes the pictures and `home-<size>.json` (the kernel's state per frame). The last section's 100 percent is taken 0.1 screen before the end of the page, because the end opens About. Intro off and consent answered come from `context()` in `lib.cjs`.

Unit tests (`apps/web/src/features/home/`): `kernel/layout.test.ts` (the registry against the design table, the run rule), `scroll.test.ts` (the spring, the lag, jumps, 60 against 144 Hz, the end of the page), `run.test.ts` (hide by default, last writer wins, order, jump equals slow scroll, a runtime that arrives late, errors, dispose), `stage.test.ts` (pixel ratio, the cameras project pixels at several sizes), `background.test.ts`, `pointer.test.ts`, `cursor.test.ts`, `clock.test.ts`, `handoff.test.ts`, `preload.test.ts`, `content.test.ts` (the owner's words, no dashes, the ten Aspirants once), `home-page.test.tsx` (the server markup: one h1, every slot, every link). E2E: `e2e/home.spec.ts` (one h1, the controls, the copy and links, the next page by button, key and scroll, the stage following the scroll and hiding what is not its own, axe at eight places, a control of another section moves the page, the plain page without WebGL). E2E ran against the dev server (`E2E_BASE_URL=http://localhost:3100/ npx playwright test e2e/home.spec.ts`), because `out/` is not built by helpers. The suite starts the browser with software WebGL, so the stage is tested; the plain page is tested by removing WebGL from the page.

## 8. Calls made without the owner

- The footer is in the page's flow, not in the fixed layers (see section 3). The design said all layers are fixed; the footer is the exception, for the Continue button and the end of the page.
- The way to About arms on the end of the document, not on the scene: it must work with no stage.
- Section lead and tail default to half a screen (hero 0 and a half, footer a half and 0). Grounds: daybreak for hero to rows and for voices to footer; storm for strip, fall, hand, list, selena; `#07130f` (dark green-black) for bolt. Each owner changes their own.
- The strip's "See All" leads to `/collection/` (its hover says "Our Collections"). "Play Films" leads to `/collection/video/films/` until the strip's owner opens the site's player.
- Copy the request leaves open: voices "Voicelines" and "See all voicelines", music "Music" and "See all music", bolt "The five pairs" (screen readers only), fall "In numbers" (screen readers only), bend "Fan art" and "Artwork", archive "The archive" and "Open the collection". The ten rooms of the archive come from `features/library/registry.ts`.
- The aspirants text uses the two logo pictures that exist: `/img/home/mlbb.webp` (from the D workstream) and `THEMLABEL_LOGO` of the About page. If D renames the first, the plain `img` of `sections/aspirants/view.tsx` breaks (the smoke spec checks every image).
- The takedown shortcut is in the bend section (fan art). The archive does not carry one yet.
- The old home's orphans were deleted (`components/gl/gl-stage.tsx`, `components/text/*`, `components/frame/frame.tsx`, `frame-image.tsx`, `frame.module.css`, `components/ui/lightbox.*`), with the two exports of `frame-shapes.ts` that only they used. `@react-three/fiber` and `@gsap/react` are listed in `knip.jsonc` `ignoreDependencies`; the integrator removes them from the catalog, `package.json` and the lockfile.

## 9. Stubbed, and not verified

Stubbed: every section's scene (a labelled box and a fade of the copy, two test meshes), every `preload()` but the two chunks, the logo and its wave, the picture field, all actors, the strip's frame and expand, every drone, the nav's empty state, the exit hook (nothing sets it), the 3D hit targets (no actor registers one), the ground of the hero (no logo carry).

Not verified: a real phone and touch scrolling on the stage (the 390 x 844 sweep is a desktop Chrome emulation with a wheel); Firefox and Safari; the production build (`pnpm build` is not run by helpers: the numbers above are the dev server's, 2 to 3 times slower than production); a weak machine; context loss with a real GPU reset (it was simulated with `WEBGL_lose_context`: lost and restored, and lost for good, which makes a new canvas); the `lvh` unit on a phone whose address bar moves; the page with the browser's text zoom; the loader's opening and the intro (workstream A).
