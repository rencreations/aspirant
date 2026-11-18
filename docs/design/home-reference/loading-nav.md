# Recon: loading, transition, nav, scroll and audio infrastructure for the new Home

Author: recon agent "loading-nav". Read-only pass over `D:\aspirant`. Paths below are relative to `apps/web/src/` unless they start with `docs/`, `scripts/`, `apps/web/e2e/` or `apps/web/public/`. Line numbers are of the tree on 18 Nov 2026 (HEAD 8d1c6cc). No em-dashes or en-dashes anywhere, as the project rules ask.

Measurements were taken with Playwright and real Chrome against the **dev server on :3000** (Turbopack HMR, `Cache-Control: no-store`). It is NOT the production build, so any timing from it (the ~7 s the cover stood on a throttled 3 Mbit link) is not representative. Judge speed on `pnpm build` + `serve`. Scratch files and screenshots: `C:\Users\muham\AppData\Local\Temp\claude\ebb19c894ab4059a\fd0c2cef-a780-4648-9a84-d597a6e52568\scratchpad\recon\loading-nav\` (`nav-1440.png`, `boot-1.png`, `boot-6.png`, `about-3600.png`, `about-6000.png`).

---

## 0. Ten things to know before reading the rest

1. The first-visit gate is decided in TWO places that must agree: the inline BOOT script (`app/layout.tsx:70`, paints `.gate-cover`) and `components/loader-gate.tsx:76` (`entered || readEntered()` returns early). Both key on `sessionStorage["aspirants:entered"]` (`ENTERED_KEY`, `lib/stores.ts:8`), which is per tab SESSION, not "arrived from outside". A reload in the same tab, or Google then Back in the same tab, skips the loader today.
2. Without a change, a reload of `/` in an entered tab paints NO cover (BOOT only paints it after 1.5 s if scripts are slow), so the server HTML of the new home would flash before the loader mounts. BOOT must paint the cover for every document load of `/` that will run the drone loader.
3. `#site-shell` (`SHELL_ID`, wraps nav, HUD and `<main>`) is made `inert` while the gate runs (`loader-gate.tsx:83`). A drone the visitor can poke during loading cannot live inside `<main>`. It must be a root-level layer next to `MorphLayer` / `ComicLayer` (`layout.tsx:108-109`, outside the shell) or a portal to `document.body`.
4. The About drone's opening (`features/about/drone/director.ts:325 mayStart`) needs `useSiteStore.entered === true` AND `[data-overlay="transition"]` not `data-active="true"`. A non-curtain home loader has no curtain, so `entered` is the only signal. It also drives the consent banner (`features/legal/consent/consent-banner.tsx:27`, shows 900 ms after `entered`) and the menu-art warm-up (`site-nav.tsx:84`). Set `entered` only when the home intro has ended, never at the tap.
5. `LoaderGate`'s docstring says "There is nothing to click". The tap gate contradicts it and CLAUDE.md "Loading" says no "Enter now". The tap is allowed only at 100 percent (nothing is skipped). Update the docstring, CLAUDE.md and `docs/HANDOFF.md` in the same commit.
6. `useScrollLock` (`features/character/vexana/seams/scroll-lock.ts`) lets the lock go after `LOCK_LIMIT_MS = 3000` unless `lock(limitMs)` is given more. An intro of 8 to 15 s must pass its own `limitMs`. `lenis.stop()` (what `pause()` does) adds `.lenis-stopped { overflow: clip }` (`styles/base.css:249`): the classic scrollbar vanishes and the page shifts sideways. Use `BareScrollbar` on Home (as Vexana, Guinevere and About do).
7. `loadMedia` (`lib/media-store.ts:174`) downloads WHOLE files. There is no partial-download item. "First seconds of a video" has two precedents: a short low-res clip cut by a script and loaded whole by `mediaItem` (About: `start-1280.mp4` 3.48 MB), or `warmFilm` in `features/library/video/films/film-pool.ts` (a bare `<video>` streamed by the browser, bar driven by seconds buffered, `FIRST_SECONDS = 6`). The Films data has ONE size per film (60 to 160 MB), so a "low-res but sharp" home preview needs a new encode script.
8. Only the FIRST caller of `loadMedia(path, { onFraction })` gets progress. Later callers share the promise and get only completion (`media-store.ts:180-191`). A section that waits on a deferred file with a real bar needs one shared aggregator with listeners, like `features/character/vexana/room/room-load.ts` (do NOT copy its `GIVE_UP_MS = 120_000` cap, it breaks the "no cap" rule).
9. `NavLock` (`lib/nav-lock.ts`) has only `theme`, `bare`, `fade`, `away`. There is no way to hide the menu, sound button, record widget, page name or the brand logo. New fields are needed, and every other page's cleanup resets only the four old fields, so Home must reset its own on unmount.
10. Under 48em the brand is `justify-self: end` (logo centre x = 311.7 at 390 px wide). The morph target is NOT the viewport centre on phones.

---

## 1. Plan: the home loading screen (drone, real bar, tap, intro with scroll locked)

### 1.1 What exists today (signatures)

- `app/layout.tsx:70` BOOT (inline, before paint): adds `html.js`, `data-pointer`; if `sessionStorage[aspirants:entered] !== "1"` sets `html[data-gate="on"]`, else sets it after 1.5 s only if `window.__aspirantsGate` is not set; installs the one-reload-a-minute failsafe for failed `/_next/static/` scripts (`RELOAD_KEY`, `RELOAD_WINDOW_MS` 60 s).
- Cover markup `layout.tsx:79-96`, CSS `styles/base.css:124-232`: `.gate-cover` is `display:none` until `html[data-gate="on"]`, then fixed, `z-index: var(--z-gate)` (100), background `#f4f6f9` (same as daybreak `--bg`), centred mark "The Aspirants" (display font, 0.3em tracking), a 2 px pink bar with an INDETERMINATE sweep (`gate-sweep` 1.4 s, not progress), "Loading the site". CSS-only timers: slow note fades in at 15 s (`.gate-cover-slow`), "Reload the page" link at 90 s (`.gate-cover-stuck`). `html[data-gate="on"] body { overflow: hidden }`. Seen in `boot-1.png`: pale cover, mark, pink bar, mono caption.
- `components/loader-gate.tsx` (146 lines), mounted last in `SiteProviders` children (`layout.tsx:112`). Effect (lines 70-134): sets `window.__aspirantsGate = true`; if `entered || readEntered()` removes `data-gate`, un-inerts shell and returns; else `shell.inert = true`, `say("Loading the site")`, starts a 15 s `SLOW_AFTER_MS` timer (line 31) that reveals a fixed note (`noteRef`, `z-[2000]`, ink `#140e26` on light, `loadingNote()`), listens to `online`/`offline`/`onRetries`, then `boot((report) => runPreload(routeItems(pathname), p => { latest = p; report(p); ... }))`. `requestAnimationFrame(() => delete root.dataset.gate)` drops the cover once the curtain is drawn. On finish: clears timers, `setEntered(true)` (writes sessionStorage), un-inerts shell, `say("Loaded")`, focuses `#main`. It also registers one-shot window `pointerdown` and `keydown` listeners that call `audio.unlock()` (lines 58-68).
- `components/transition/transition-provider.tsx`: `boot(load)` lines 223-266: `busy = true`, Lenis `pause()`, curtain `setMode("boot")`, `showBoot(true)`, `startIdle()`, `await Promise.all([load(report), sleep(BOOT_MIN_MS=1500)])` (a floor so the logo is seen, not progress), `c.setBoot(1,"Drawing the page")`, `await whenPageReady()`, 380 ms, then fill drains (0.75 s) and the logo zooms into a letter (1.5 s). The curtain bar is smoothed toward the REAL value: `components/curtain/logo-curtain.tsx:215 setBoot(progress,label)` runs `gsap.to(state,{bar: next, duration: .35, ease:"power2.out", overwrite:"auto"})`, so the display lags the truth and never leads it. Curtain look (`boot-6.png`): light screen, the traced vector logo with rippling letters, notch bar, label left and percent right, brackets and hairlines, caption "Selrick Academy archive" / "A5-01". It still says "LOADING THE PORTAL ENGINE" because the current "/" list names a chunk that way.
- `lib/preload.ts` (393 lines). `PreloadItem { id; label; weight?=1; run(report(fraction, bytes?), {background}); memo?=true; deferred?; priority?=50; group? }`. `PreloadProgress { progress 0..1 (weighted by finished fraction), label (heaviest pending item), pending: string[] (labels of every running item), bytes?: {received,total,partial} }`. Builders: `imageItem(path,label,weight=1)` (fetchWhole, fraction capped 0.95 until decoded, 5 failed decodes = `PermanentFailure`), `dataItem`, `savedItem` (cachedFetch, no bytes), `mediaItem(path,label,{type,bytes?,weight?,background?})` (`loadMedia`, `memo:false`, default weight `max(1, bytes/1e6)`, fraction capped 0.999), `chunkItem(id,label,() => import(...), weight=2)` (no intermediate progress, jumps 0 to 1, reloads once after 3 tries on a chunk error), `fontsItem()` (the four faces, then `document.fonts.ready`). `runPreload(items, onProgress)` runs all non-deferred items in parallel, throttles `onProgress` to 10 Hz (`PROGRESS_EVERY_MS = 100`), resolves when they are done however long that takes, then `runDeferred(later)` queues the deferred ones (3 at once, `DEFERRED_AT_ONCE`, sorted by `priority`, smallest first, `cancelDeferred(group)`).
- `lib/media-store.ts`: Cache Storage name `CACHE = "aspirants-media-v4"` (bump when a file is replaced under the same address; old `aspirants-media-*` are deleted on open). Download slots: `LIMIT = 4`, `BACKGROUND_LIMIT = 2`, FIFO in the order asked, `promoteMedia(path)` (line 117) makes a queued background download urgent. `STALL_MS = 20_000` (no byte for 20 s aborts, then retries with a `Range` resume). Exports: `loadMedia`, `mediaUrl(path)` (blob URL if loaded else plain URL), `releaseMedia(prefix)` (revokes blob URLs), `cachedFetch`, `fetchWhole`, `ByteCount`. A path may be an absolute library URL (`libUrl(key)`, R2 `https://s3.aspirant.cc/library/v1/...`, CORS needed for audio elements, already used).
- `lib/retry.ts`: `untilItArrives(attempt(n))` retries forever, delays 1, 2, 4, 8, then 10 s, waits for the `online` event (max 8 s per wait, `lib/offline.ts whenOnline`); only `PermanentFailure` (HTTP 404 or 410) ends it. `retriesWaiting()` and `onRetries(fn)` publish how many downloads sit between tries (use it for an honest "the connection stalled" state).
- `lib/page-ready.ts`: `expectReady(id)` returns `mark`; `whenPageReady(maxMs = 30_000)` resolves after two calm 80 ms checks (the 30 s cap is only for a component that can never report).
- `lib/loading-note.ts`: `loadingNote(p, {offline, retrying})` builds the real-progress sentence ("Slow connection. Still loading, 42%, 120 MB of 290 MB. ..." or "Offline. Waiting for the connection. ...").
- `lib/route-history.ts`: `noteRoute(path)` (called in `TransitionProvider` effect, which runs AFTER children's effects) and `routeBefore(path)`: null on a fresh document load, else the route before. Used by `features/character/roster/intro/mode.ts introPlays()`.

### 1.2 Rules in CLAUDE.md that bind the plan (quoted)

- "Never fake progress. Never add a timer that pretends to load."
- "One version only. A slow connection waits behind the loading screen ... The screen says the connection is slow after 15 seconds (`SLOW_AFTER_MS` in `components/loader-gate.tsx`) and then shows the real percentage and bytes received. There is no 'Enter now' button, no cap on the first visit, on an item or on a page change, and no per-item `timeoutMs`. Never add one."
- "A download that stalls (no byte for 20 seconds, `STALL_MS`) ... is started again after a short wait (1 s growing to 10 s) ... The only item that is skipped (and logged) is one the server says is gone (HTTP 404 or 410) or a picture that arrives whole and cannot be decoded five times."
- "Offline, the loading screen keeps waiting, says so ('Offline. Waiting for the connection.'), and goes on by itself when the connection returns."
- "Before the scripts have started, the cover painted by the boot script ... stays up ... No timer lets it go. Its only exit is the 'Reload the page' link it shows after 90 seconds."
- "Never let a progress callback move the curtain after the page has started to open: the curtain's `setBoot` must only overwrite its own bar."
- "Waited means the first screen and everything that animates or shows on the sections near the top of the page ... Only what the visitor must ask for stays `deferred`." A deferred item not yet there "shows the button in its loading state, never a different page."
- "A component with a slow first paint (a WebGL scene) calls `expectReady(id)`".
- "Judge speed on the production build." "Effects are never gated on the device." No performance levels, no lite variant, ignore `prefers-reduced-motion`. A no-WebGL still is a handled failure, not a version.
- Owner request vs rules: "it will not load everything and only things that make scrolling better" = waited list is the first screens plus the loader's own 3D, the rest `deferred` with priorities in scroll order. It is consistent with the rules as long as nothing is capped and a section reached early waits with a real bar.

### 1.3 How the loader decides "arrived from outside" (alternatives, architect to choose)

| Signal                                               | Where                   | Catches                                                                       | Misses                                                                                                     |
| ---------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `sessionStorage[aspirants:entered]` unset            | BOOT + LoaderGate today | first document in this tab session                                            | reload in same tab, Google then Back in same tab, a second external visit in one tab                       |
| `routeBefore("/") === null`                          | `lib/route-history.ts`  | any full document load (reload, typed URL, external link, hard-nav fallbacks) | cannot tell external from internal hard loads                                                              |
| `performance.getEntriesByType("navigation")[0].type` | browser                 | `navigate` / `reload` / `back_forward`                                        | not origin                                                                                                 |
| `document.referrer` empty or other origin            | browser                 | typed URL, bookmark, search, social, PWA                                      | a reload keeps the ORIGINAL referrer (so an external visit that reloads replays the loader, probably fine) |

Recommended: `homeArrival = documentLoadOfHome && (referrer empty or cross-origin) && aspirants:intro !== "off"`. Compute it ONCE, in BOOT, and write the result as `html[data-arrival="home"]` (and set `data-gate="on"` plus `data-gate-kind="home"` for the cover). `LoaderGate` is the ONLY reader of the attribute: it copies the decision into `useHomeFlow` (`phase: "cover"`) first and only then deletes the attribute, so a remount, HMR or error reset never replays the loader. Every other React reader (the layer, the page, the nav) reads the store, never the attribute: a lazy layer's effects run after its chunk arrives, which is after the attribute is gone. `skipGate` (`apps/web/e2e/helpers.ts`) sets `aspirants:entered=1` and `aspirants:intro=off`; the BOOT test for `intro=off` keeps every existing spec working.

Open owner decisions to flag, NOT to resolve here: (a) a first landing on `/about` (or any other page) still uses the logo curtain; (b) an in-site arrival at `/` (curtain from another page) should mount the page directly in its post-intro state (big logo + drone, nav logo hidden), or replay the carried-logo sequence without a loading screen; (c) a reload in an entered tab: full loader, or skip. The tap is also the browser's audio gesture, which argues for always showing it on a document load of `/`.

### 1.4 Pieces that must change

1. `app/layout.tsx` BOOT: add the arrival decision above (it can interpolate `siteConfig.basePath`; E2E may run under a base path); for the home arrival paint the cover even if `entered`. Add a home variant of the cover in `styles/base.css`: `html[data-gate-kind="home"] .gate-cover` same `#f4f6f9`, no mark (the drone is the mark), keep the sweeping bar and the 15 s / 90 s notes. Mount the new root layer (see 1.5) beside `MorphLayer`.
2. `components/loader-gate.tsx`: branch before `boot(...)`: when `html[data-arrival="home"]`, do NOT call `boot` (no curtain). Instead call a home boot function (provided by `features/home/`) that: takes `transition.claim()`, holds scroll, publishes progress into a small store, and resolves when the intro has ended. Keep what is shared: `runPreload(routeItems("/"))`, the `slow` 15 s note logic (restyle for the home palette), `online`/`offline`/`onRetries`, `window.__aspirantsGate = true`, `shell.inert`, `setEntered(true)` in the `finally` (so `entered` flips at the END of the intro), focus `#main`. Remove the early `return` for `entered` on the home arrival. Fix the docstring.
3. `components/transition/transition-provider.tsx`: no change needed if the home boot uses `claim()` (sets `busy`, so `TLink`, `NextFooter`'s `router.isTransitioning()` check, and the N hotkey all stand down). Note `claim()` does not pause Lenis (see section 4). React StrictMode mounts effects twice in dev: guard with a `started` Set like `features/story/morph/overlay.tsx` does.
4. `lib/route-preloads.ts:68-84`: replace the `"/"` branch with `[...shared, ...homeItems()]` (the same list serves the first load AND the in-site curtain arrival). Delete the portal items.
5. `app/page.tsx`: replace everything (still a server component, h1 and the text of every section in the HTML at build time, as the other pages do; `metadata.title.absolute` currently "The Aspirants: Someone is always waiting.", `description` from `siteCopy.meta.home`).
6. `lib/nav-lock.ts` + `components/nav/site-nav.tsx` + `nav.module.css`: new fields (section 3).
7. Tests: `apps/web/e2e/a11y.spec.ts:43` holds `**/img/portal/vexana/depth.webp` to keep the gate up and asserts `#site-shell` is inert: rewrite against a home item; `home.spec.ts` is wholly about the old page.

Sketch of the two edits that carry the decision (not final code). BOOT, `app/layout.tsx:70`, built from a template string so `siteConfig.basePath` can be interpolated (trailing slash export, so strip it):

```js
var H = location.pathname.replace(/\/+$/, "") === "<basePath>"; // the home route
var out = !document.referrer;
if (document.referrer) {
  try {
    out = new URL(document.referrer).origin !== location.origin;
  } catch (x) {
    out = !0;
  }
}
var off = !1;
try {
  off = sessionStorage.getItem("aspirants:intro") === "off";
} catch (x) {}
if (H && out && !off) {
  d.dataset.gate = "on";
  d.dataset.gateKind = "home";
  d.dataset.arrival = "home";
} else if (!e) {
  d.dataset.gate = "on";
} else {
  setTimeout(function () {
    if (!window.__aspirantsGate) d.dataset.gate = "on";
  }, 1500);
}
```

`LoaderGate` effect (`loader-gate.tsx:70-134`), three changes:

```ts
const homeArrival = root.dataset.arrival === "home";
if (homeArrival) useHomeFlow.getState().begin(); // phase "cover", BEFORE the attribute goes
delete root.dataset.arrival; // consumed once per document
if (!homeArrival && (entered || readEntered())) {
  /* existing early return */
}
const run = homeArrival
  ? bootHome((report) =>
      runPreload(routeItems(pathname), (p) => {
        latest = p;
        report(p);
        if (slow || isOffline()) paint();
      }),
    ) // no curtain
  : boot((report) => runPreload(/* existing */));
// and the rAF that deletes data-gate is skipped for the home: the HomeLayer clears it after its first drawn frame.
```

`bootHome(load)` (new, `features/home/boot.ts`, obtained from a hook because it needs `useTransitionRouter().claim` and `useLenis`) has the same signature as `TransitionRouter.boot`: it claims the router, locks the scroll, publishes progress, waits for the tap, plays the intro, and resolves at `open`. The existing `.finally(...)` then does `setEntered(true)`, un-inerts the shell and focuses `#main`.

### 1.5 Two stages, one object (the loader drone is the hero drone)

The drone needs three.js and `drone.glb` (250,192 B) before it can draw, and the pre-hydration cover is static HTML. So:

- Stage A (cover, pre-hydration, then until the 3D is in): the home cover, same colour as the stage, with the indeterminate sweep. Not progress, no percent.
- Stage B (drone loader): a root-level `HomeLayer` holds (its SHELL is not lazy, only the three.js scene chunk is, as in About: `features/about/drone/drone-layer.tsx` is a plain component that holds the curtain with `expectReady`, builds the canvas, and imports `./drone-scene` dynamically; the shell must render at hydration so it can take over from the cover, and it renders nothing off `/` or once `useHomeFlow.phase` is `off`): paper background (`#f4f6f9` + the dot grid of `body`), the fixed full-viewport WebGL canvas, the loader DOM (bar, percent, rotating line, bytes), the tap gate and, after the tap, the intro choreography. It must sit OUTSIDE `#site-shell` (inert) and BELOW the lantern cursor (`--z-cursor: 95`) and above the page: use `--z-transition: 90`, not the curtain's `--z-gate: 100`, so the cursor stays visible while the visitor plays with the drone (the curtain's 100 hides it). 90 is only for loader and intro: at `open` the layer MUST drop under the site's bar and frame (below `--z-nav` 50, above `--z-content` 1, for example `calc(var(--z-nav) - 5)`, as About keeps its drone layers under the bar), otherwise it would cover the bar, the menu (70), the consent plate (60) and the modals (80). The canvas takes no pointer events (`pointer-events: none`); hover, press and keyboard go through one round button that follows the drone (About's `DroneLayer` button, 100 px scaled), so the page underneath stays clickable. If the layer outlives the route change (the handoff), reset the new `NavLock` fields from a pathname effect when the path leaves `/`, not from the layer's unmount, or About opens with an empty bar. `components/gl/use-gl-ready.ts hasWebGL()`; no WebGL = the still `public/img/about/drone.webp` (`features/about/media.ts DRONE_STILL`, a failure handled).
- The cover is removed only after the layer has drawn its first frame (the same rAF pattern as `loader-gate.tsx:118`). No timer.
- The layer's own files count in the list (chunk, `drone.glb`, companion): at stage B the bar already shows their share as done, which is honest because they are.
- Reuse, do not fork: `features/about/drone/drone-scene.ts createDroneScene(canvas, hooks)` (loads `DRONE_MODEL` through `loadMedia`, then `new GLTFLoader().parseAsync(bytes, "")`, `PIXEL_BUDGET = 8e6`, pixel ratio capped by canvas size only), `features/about/companions/companions-scene.ts createCompanionsScene` (Guinevere's two drones, flat orthographic view, one unit = one CSS pixel, one model `companion.glb` 241,420 B built twice, faces drawn by shader), `features/about/choreo/{ease,follower,face,rig,tricks}.ts` (pure, tested arithmetic: `clamp, mix, ramp, bump, hermite, bezier, easeTurn`, a spring follower, face blending). `lib/hooks.ts usePointer()` gives the smoothed pointer for the "reacts to cursor" behaviour (`PointerState.x/y` -1..1).
- WebGL contexts: the site rule is no more than three live (About: drone, Tetra once met, the two companions while near). Loader drone + two Guinevere drones + Silverbolt + doll + Selena + hand + Tetra + floating-art with chromatic aberration will blow that unless the Home uses ONE shared fixed renderer/canvas whose scene is swapped by section, or releases a canvas when far (`companions-stage.tsx` does so).

### 1.6 Exposing the real progress

- Shape the home boot as `homeBoot(onProgress)`: `runPreload(routeItems("/"), p => ...)` and publish `p` to a zustand store `useHomeFlow` (new, `features/home/flow.ts`): `phase: "off" | "cover" | "loading" | "ready" | "intro" | "open"`, `real: PreloadProgress | null`, `slow`, `offline`, `retrying`. `runPreload` already throttles to 10 Hz, so `set` at that rate is cheap. Per-frame things (shown percent, drone pose) live in plain mutable `homeRefs`, like `stageRefs` in `features/about/stage-bus.ts`, never in React state.
- Phases: `loading` (drone shown, bar moves), `ready` (`runPreload` resolved AND `await whenPageReady()` AND the drone's entrance has finished; label "Touch anywhere to continue"), `intro` (after the tap), `open` (released; `entered` set).
- Smoothing (the only allowed "easing"): `shown = min(real, shown + (real - shown) * (1 - exp(-6 * dt)))`, monotonic, and the printed number is `Math.floor(shown * 100)`, never rounded up, never above `Math.floor(real * 100)`. This is the curtain's `setBoot` rule made explicit. 100 appears only when `ready`.
- Honest weights: `imageItem` is weight 1 whatever its size, `chunkItem` 2, `mediaItem` `max(1, MB)`. Percent therefore races through pictures and crawls through big media. Set explicit weights proportional to expected bytes (fractional weights work: `total` is a plain sum) so the bar speed tracks bytes. Bytes (`p.bytes`) are real, show them from the start ("3.2 of 9.8 MB"), not only after 15 s; while `bytes.partial` is true say only "received", not "of".
- Order for early wins: slots are FIFO (4 big at once), so list the loader's own files and the smallest must-haves first.

### 1.7 Waited vs deferred, and recipes

Suggested tiers (sizes are real files in the repo: drone 250,192 B, companion 241,420 B, tetra 573,716 B):

- Waited: fonts; the home scene chunk; `drone.glb`; `companion.glb`; logo (vector, in code); first splash art thumbnails for the hero (a fixed set, small webp); the first section's pictures; the first 6 to 8 s low-res preview clips of the video sections (cut by a script, a few hundred KB each); the music for the first screen if any.
- Deferred, priority in scroll order (smallest first, lower `priority` first, default 50): Silverbolt and doll GLB, Selena GLB, hand GLB, Tetra GLB, comic previews, voice lines (one per language per character, `savedItem`), gramophone record covers and audio, fan-art set, the splash art of the voice section.
- Rule of thumb: waited total under about 5 MB so the bar finishes in a few seconds on a normal link. The owner asked for "not too long". Measure on the build.

Recipes (all are ordinary `PreloadItem`s in `features/home/preload-items.ts`, called from `routeItems("/")`):

```ts
chunkItem("home-stage", "Starting the stage", () => import("@/features/home/stage/stage-scene"), 3)
mediaItem(DRONE_MODEL, "Waking the drone", { type: "model/gltf-binary", bytes: DRONE_MODEL_BYTES, weight: 0.25 })
mediaItem(COMPANION_MODEL, "Calling the helpers", { type: "model/gltf-binary", bytes: COMPANION_MODEL_BYTES, weight: 0.25 })
imageItem("/img/home/art/obsidia.webp", "Hanging the art", 0.1)
mediaItem(preview.src, "Loading the trailer", { type: "video/mp4", bytes: preview.bytes })
{ ...mediaItem(SILVERBOLT_GLB, "Feeding Silverbolt", { type: "model/gltf-binary", bytes }), deferred: true, priority: 12, group: "home" }
```

The scene reads the same blob through `loadMedia(path, {type})` then `fetch(blobUrl).arrayBuffer()` then `GLTFLoader.parseAsync(bytes, "")` (`about/drone/drone-scene.ts:251`). The About items already share keys with Home: `DRONE_MODEL`, the `about-drone` chunk id, so after Home the About preload is instant. Do not call `releaseMedia("/models/about/")` on Home exit.

Partial video, in order of preference: (1) a script (new, `scripts/home/`, anaconda Python + ffmpeg, `-movflags +faststart`, no audio, 24 fps, about 640 wide, 6 to 10 s windows, output into `public/video/home/` beside `public/video/about/`, never hand edited) and `mediaItem` whole; this is how About's loops ship. (2) `warmFilm(source, {from, seconds, onProgress})` for a long film proxy: reports real seconds-buffered fraction and an estimated byte count (`bytes * seconds / dur`), the item in `features/library/video/films/preload.ts firstFilmItem()` (id `films-first`, weight 14, `memo:false`) is the template. The ten Films are `FILM_IDS` in `features/library/video/links.ts`; their files are in R2 at one size.

A section reached before its deferred files arrive (precedent: `features/character/vexana/room/room-load.ts` + `seams/room-heart.tsx`): one module singleton per section with `listeners`, `promoteMedia(path)` then `loadMedia(path, {onFraction})`, an `IntersectionObserver` with `rootMargin: "200% 0px"` to warm early, a thin line in the section that fills with the real fraction, and the scroll held (`useScrollLock`) until it is in. No timer, no cap.

### 1.8 "Psychological tricks" without faking

Allowed because each is true or purely decorative:

1. The drone never stops moving: idle loops, blinks, look-at-pointer, pokes that always finish. The bar head carries a looping sheen that runs whatever the progress (like `.gate-cover-bar::after`), so a flat stretch still looks alive.
2. Changing text from REAL sources: cycle `p.pending` (labels of running items, e.g. "Waking the drone", "Hanging the art") every 2 to 3 s, plus the heaviest `p.label`, bytes, and a true elapsed seconds counter. A second line may carry persona flavour ("Polishing the wings") but must not claim a state ("Almost there" only when real `progress >= 0.9`).
3. Smoothed bar and an odometer-style percent, per 1.6 (lag, never lead).
4. Milestone reactions at real 25, 50, 75, 100 percent (the drone does a trick, comic icon pops).
5. Honest stall signalling: `retriesWaiting() > 0` or no byte change for 3 s shows a shrug/sweat-drop emote and the real bytes; offline shows the drone unplugged and "Offline. Waiting for the connection." (use `loadingNote`); at 15 s the existing "Slow connection ..." sentence.
6. Early wins: load tiny must-haves first so the first percent moves fast.
7. Interaction: the visitor can poke the drone while waiting (pointer, press, key).
8. Not allowed: a timer that advances the bar, a fixed "fake" 0 to 90 percent run, an `Enter now`, a cap or `timeoutMs`, a faster-than-real percent. A minimum on-screen floor (like `BOOT_MIN_MS = 1500`) is acceptable only as a hold of the screen, never as the bar.

### 1.9 The tap gate and the intro

- At `ready` render one full-viewport `<button>` (so keyboard works: Enter, Space; also any key, since `loader-gate.tsx:58` already unlocks on first `keydown`) with the owner's words "Touch anywhere to continue". Call `audio.unlock()` synchronously inside the handler (the handler already runs after `LoaderGate`'s own one-shot `pointerdown` listener, but do not rely on order). The tap also grants `navigator.userActivation` so a later video with sound may play.
- `html[data-gate]` removed, shell stays inert until the intro ends, `aria-live` status via the existing `say()` (`role="status"` `sr-only` paragraph in `LoaderGate`). Expose the bar as `role="progressbar"` with `aria-valuenow` (the curtain does, `logo-curtain.tsx:274`).
- Intro with the scroll locked: `BareScrollbar` + `useScrollLock().lock(limitMs)` with a limit above the sequence length (a long safety, released by the sequence's own end), `window.scrollTo(0,0)` first. The sequence is a clock, not the scroll (the About opening in `drone/director.ts` is the model: phases in a store, `introT`, `tryStart()` only when `entered`, tab visible, engine ready; `introOff()` reads `sessionStorage["aspirants:intro"] === "off"` and ends it at once). Honour `intro=off` so all specs keep working: with it the home mounts straight in `open`, nav shown.
- After the tap the nav stays empty (section 3), then the menu, sound button and a scroll cue appear at `open`.

---

## 2. In-site transition to `/` today, and a custom `/` to `/about` handoff

### 2.1 Today (curtain)

`TLink` (`components/transition/t-link.tsx`) intercepts a plain left click, plays `audio.blip("click")`, calls `useTransitionRouter().push(href, {label})`. `TransitionProvider.push` (`transition-provider.tsx:131-221`):

1. `busy` guard; offline and never opened = `OFFLINE_BLOCKED_EVENT`; same route = `scrollTo(0)` (or `router.push` with a hash).
2. `busy = true`, `pause()` Lenis, `router.prefetch`, start `runPreload(routeItems(target))` in the background.
3. Curtain: mode "transition", fill 0, zoom 1, show, `audio.blip("whoosh")`, `tweenZoom(0, 0.85, "power3.inOut")` (logo zooms out, letters are windows onto the page being left).
4. `router.push(href, {scroll:false})`, then `Promise.all([waitForPath(target), assets]).then(whenPageReady).then(nextFrame)` (no timer on the files).
5. If not ready 500 ms after the click (`LOADING_STATE_AFTER_MS`, CLAUDE.md: "Do not remove that"): fill the windows (0.3 s), `startWaiting(label)`, words "Loading X 42%" from the real preload progress or "Offline. Waiting for the connection".
6. `scrollTo(0,{immediate:true})`, `window.scrollTo(0,0)`, `dispatchEvent(REVEAL_EVENT)` (`"aspirants:reveal"`, `lib/hooks.ts:459`), focus `#main`, `blip("star")`, `tweenZoom(1, 1.05)` (a letter window grows to fill the screen), `hide()`, `resume()`.
   `NAVIGATED_EVENT` (`"aspirants:navigated"`) fires a frame after every path change. For `/`, `whenPageReady()` waits for the new Home's `expectReady("home-...")` marks, so the Home must register one for its first draw; and `routeItems("/")` is what the curtain waits on.

### 2.2 Claiming the router (the MorphLayer / ComicLayer pattern)

Template files: `features/story/morph/{morph-store.ts,morph-layer.tsx,overlay.tsx}` and `features/library/comic/zoom/{store.ts,layer.tsx,overlay.tsx,kit.ts,dive.tsx}`.

- A zustand store holds `job | null` and `start(request)` (false if one runs); a layer in `layout.tsx` renders `lazy(() => import("./overlay"))` only while a job exists, inside an error boundary that on failure ends the job and falls back to `window.location.assign(href)` or `transition.push(href)`.
- The overlay on mount: `const release = useTransitionRouter().claim(); if (!release) { endJob; return }`. `claim()` (transition-provider.tsx:268) only sets `busy = true` (so every `TLink` click, `NextFooter.go` and `ContinueHome` become no-ops via `isTransitioning()`); it does NOT navigate, preload, scroll or reveal. Then it does everything itself: `holdScroll()` from `comic/zoom/kit.ts:43` (capture guard on wheel, touchmove and scroll keys, Lenis NOT paused, releases after the wheel's momentum, up to 1.2 s), Next's own `useRouter().push(href, {scroll:false})` (NOT the transition router), `useGoto()` (kit.ts:70, waits for the pathname, no timer), `await whenPageReady()`, then `arrive(scrollTo)` (kit.ts:97: `scrollTo(0,{immediate:true})`, `window.scrollTo(0,0)`, `REVEAL_EVENT`, focus `#main`), animate the cover away, `endJob`, `release()`, `await letGo()`. On any failure: remove the layer and `transition.push(href)` (plain curtain). A watchdog (morph: 40 s) takes the layer away if it never ends.
- Warm before the press: `warmComic(href)` pattern = `void runPreload(routeItems(href), noop)`. For Home, start `runPreload(routeItems("/about"), noop)` when the footer comes near. If the destination is not ready when the job needs it, show real progress over the cover (`waitingWords` in kit.ts), never a timer. `kit.ts` helpers are comic-local: move `holdScroll`, `useGoto`, `arrive` to `lib/` or `components/transition/` before reuse (knip and lint).

### 2.3 Home to About with the drone

- The Home footer cannot be `NextFooter` (it calls `router.push` through the curtain: `next-footer.tsx:62`, arms at 0.98 progress after a 520 ms `LOCK_MS`, `N` key, Continue button). Write a Home footer with the same arming logic but starting a home-to-about job. Keep the Continue button and `N` (`useHotkey("n", go)`), and e2e `shell.spec.ts` expects scrolling to the very bottom to land on `/about/` within 8 s.
- The About opening is a pure function of time and starts with the drone OFF SCREEN RIGHT: `features/about/choreo/intro.ts introAt(geo, t)`; the pass starts at `x = vw + 0.75 * passSize`, `yaw -1.2`, over the title; `INTRO = {pass 1.6, apex 1.96, out 2.38, touch 3.3, landed 3.38, done 3.95}` seconds; `passSize = clamp(title.h * 0.6, 0.1 * vh, min(0.28 * vh, 0.36 * vw))`. Measured with `window.__aboutDrone.state()` at 1440 x 900: phase `wait` to `title` with pose `x 1603.0, y 215.1, size 217.4, yaw -1.2, pitch 0.186, roll 0.103`; at 6 s the drone is at the left apex `x 72.7 y 448.4 size 335`. `about-3600.png`: the About first screen is EMPTY light paper with the dot grid, bar and corner brackets, then `about-6000.png`: giant "ABOUT" (Big Shoulders italic) and "Aspirant" (Instrument Serif italic, pink) appear in the drone's trail; the drone is a blue-grey sphere with a dark round face and cyan oval eyes and one blade fin.
- Simplest seamless handoff (recommended): the Home drone does its "off we go" and exits to the RIGHT edge with `yaw about -1.2` while the page under a light cover (same `#f4f6f9`, so no seam) changes; About's `mayStart()` then plays its own entry from the right, which continues the motion. Two canvases never overlap, so the WebGL budget holds. About starts as soon as `entered` is true and no curtain is active, and with a claimed router the curtain is never active, so the Home layer must stay until `useAboutStage.getState().phase !== "wait"` (`features/about/stage-bus.ts`), then fade out.
- If the owner wants the SAME pose to continue (drone "transforms and moves to the start"): add one optional field to `stageRefs` (for example `arrival: {x,y,size,yaw,pitch,roll,vx,vy} | null`) written by the Home layer and consumed by `tryStart()` in `drone/director.ts` to seed `follower` and blend into `introAt` for the first 0.4 s. `resetAboutStage()` resets the bus on a new visit; `about-root.tsx` sets `NavLock` `{theme:"daybreak", bare:true}`.
- If the visitor has not scrolled the About page title area yet, `director` also ends the intro when scroll exceeds 8 px (`OPENED_DOWN`), and `?at=` return links open it part way down with no intro (`about/return-place.ts`).

---

## 3. Navbar

### 3.1 DOM and styles (`components/nav/site-nav.tsx`, `nav.module.css`)

```
<header class=nav data-scrolled data-theme data-lock data-bare data-fade data-away inert={lock.away} data-overlay="nav">  (position fixed; inset 0 0 auto 0; z-index var(--z-nav)=50; height var(--nav-h))
  <div class=inner>                       grid 1fr auto 1fr, padding-inline var(--gutter)
    <div class=left>                      Dialog.Trigger.menuButton "Menu" + <SoundButton/> (canvas bars + "On"/"Off") + <NowPlaying/> (record widget, only when a track is set)
    <TLink href="/" class=brand data-logo-host aria-label="The Aspirants, home">  <AspirantLogo variant="interactive" class=logo decorative/>  (viewBox 0 0 3018 897)
    <p class=here>  "<index> <label>" of the current page (shown from 48em; right edge)
  </div>
  Dialog.Portal > menu (z --z-menu 70)
```

- `--nav-h`: 4rem (64 px) below 56.3125em (901 px), 5rem (80 px) from 901 px (`styles/tokens.css:67,132`). `--gutter: clamp(3.5rem, 2.2rem + 2.5641vw, 7rem)` from 901 px (clamp(1rem, ...) below).
- Logo height: `.logo` 2.25rem (36 px) below 901 px, 3.25rem (52 px) from 901 px (`nav.module.css:136, 291-295`). Aspect 3018:897 = 3.3645, so width 121.1 px (36 px tall) or 174.95 px (52 px tall).
- Plate: `.nav::before` (blur 10 px, hairline) has `opacity 0` until `data-scrolled="true"`; locked pages (`data-lock`) get a plain solid plate or none when `data-bare`; `data-fade` fades the plate and ink; `data-away` shrinks and fades the bar (transform and opacity only, `inert`).
- `barShown = lock.theme ? !lock.bare : scrolled` (`site-nav.tsx:54`); `theme = lock.theme ?? sampled` where `sampled = useThemeAt(...)` reads `data-theme` of the element under (w/2, 4) every 120 ms, ignoring `[data-overlay]` elements: give Home sections `data-theme` so the bar's ink follows when not locked.
- `useNavLock` (zustand, `lib/nav-lock.ts`): `{theme: "storm"|"daybreak"|null, bare, fade, away}`. `useTransparentNav(theme)` (`features/library/shell/room-chrome.tsx:18`) = `setState({theme, bare:true})` and on unmount `{theme:null, bare:false}`. About sets `{theme:"daybreak", bare:true, fade:false, away:false}` (`about-root.tsx:93`). The nav brand is itself a link to `/` (on Home a click is "same route" and scrolls to the top: that is the morph's way back).

### 3.2 Measured at runtime (Playwright, Chrome, `/collection/`, entered tab, no scrollbar in this measuring context)

| viewport    | header    | brand svg box (x, y, w, h) | logo centre               | menu btn           | sound btn      | page name                 |
| ----------- | --------- | -------------------------- | ------------------------- | ------------------ | -------------- | ------------------------- |
| 1440 x 900  | 1440 x 80 | 632.5, 14, 175, 52         | 720, 40                   | x 72.1 w 95.8 h 44 | x 176 w 94.2   | x 1258 w 109.9, cx 1312.9 |
| 1920 x 1080 | 1920 x 80 | 872.5, 14, 175, 52         | 960, 40                   | x 84.4             | x 188.3        | x 1725.6, cx 1780.6       |
| 2560 x 1440 | 2560 x 80 | 1192.5, 14, 175, 52        | 1280, 40                  |                    |                |                           |
| 1024 x 768  | 1024 x 80 | 424.5, 14, 175, 52         | 512, 40                   | x 61.5             | x 165.3        | cx 907.6                  |
| 820 x 1180  | 820 x 64  | 349.4, 14, 121.1, 36       | 410, 32                   | x 28.8             | x 132.7        | cx 736.2                  |
| 390 x 844   | 390 x 64  | 251.1, 14, 121.1, 36       | **311.7**, 32 (right end) | x 17.8 w 91        | x 116.8 w 49.9 | not shown                 |

At 1440 and 1920 the logo's x is `(clientWidth - 175) / 2`, y is 14, so the morph target rect is `{ x: cw/2 - 87.5, y: 14, w: 175, h: 52 }`. A classic scrollbar (15 px) would move the centre by 7.5 px: another reason for `BareScrollbar`. Measure the real rect at morph start with `document.querySelector('header[data-overlay="nav"] [data-logo-host] svg').getBoundingClientRect()` and again on resize; never hardcode. Screenshot `nav-1440.png`: Menu and "ON" sound buttons left (hairline boxes), small outlined logo centred, "05 COLLECTION" right.

### 3.3 Rendering the bar EMPTY, then revealing it

- Add to `NavLock`: `empty: boolean` (hides `.left`, `NowPlaying`, `.here`) and `logo: "shown" | "hidden"` (hides the brand's own logo while the big one is on the page), both reset by Home on unmount AND by `useTransparentNav`-style cleanups elsewhere if they set the whole object.
- `site-nav.tsx`: write `data-empty` and `data-logo` on the header; `inert` on `.left` and `.brand` while hidden (keyboard and screen readers must not reach hidden controls; React 19 supports the boolean `inert` prop, already used on the header). CSS: `.nav[data-empty="true"] .left, .nav[data-empty="true"] .here { opacity:0; visibility:hidden; pointer-events:none; }` with an opacity transition when it clears (transform and opacity only); `.nav[data-logo="hidden"] .brand { opacity:0 }`. Keep the box laid out (opacity, not `display:none`) so the target rect is always measurable. `AspirantLogo variant="interactive"` runs an `ambientLoop` (GSAP, blink and antennae every 4.5 s) that is harmless while hidden but could be paused through `document.hidden` logic already present.
- At the moment the morph lands: in ONE frame set `data-logo` to shown AND remove the big clone, both draw the same vector layers (`components/logo/logo-art.tsx LogoLayers`), so the swap is invisible. Then `empty: false`, menu and sound fade in (the owner wants it obvious that the site is now usable), plus a scroll cue.
- `HudFrame` (`components/hud/hud-frame.tsx`): corner brackets and a hairline scroll progress bar along the top; keep (it is the one scroll progress mark when the scrollbar is hidden) or suppress during the intro with the same `data-` pattern. The `M` hotkey (sound toggle) is registered there and still works while the bar is empty.

### 3.4 The logo as a drawable

`components/logo/`: `logo-data.generated.ts` (do not edit, from `scripts/logo/build.py`): `LOGO.viewBox [0,0,3018,897]`, `outline`, `plate`, `silhouette` (SVG path strings in logo units), `mascot {accent, antL, antR, ring, pods[], disc}`, `mascotGeo {cx, cy, eyes [1775,267,1904,344], antLPivot, antRPivot}`, `letters[{i,d}]` (12), `bevel`, `zoom {x:1455,y:565,r:52.4}`. Colours (`logo-art.tsx`): outline `#f2b04c`, plate `#0b0b0e`, mascot pink `#ff2e90`, accent `#6f6f6f`, bevel `#8d8d8d`, letters `#ffffff`. `LogoLayers({uid})` renders `data-part` groups (`outline, plate, accent, energy, mascot>head>antL/antR/lid, letters>letter[data-i], shine`); `queryLogoParts(svg)` and `ambientLoop/hoverIn/clickPop/idleLoop/waitingLoop` (GSAP on SVG attributes, fine for short flourishes) are in `logo-motion.ts`. `logo-geometry.ts layoutFor(vw,vh)` gives the curtain's rest size `width = min(vw * 0.62 (0.86 under 700), vh * 0.34 * 3.3645)` (892.8 px wide at 1440 x 900), centre y = 0.44 vh.

- The owner wants ~70 percent of the screen width for the big logo and a WAVE morph into the bar (reference: the liquid in `features/character/vexana/seams/liquid.tsx` + `liquid-math.ts`, a blob path and timed white/black liquid, not a shrink). Performance rules forbid per-frame SVG attribute writes during a long scroll-bound animation: draw the logo to an offscreen canvas with `Path2D(LOGO.*)` and use it as a texture on a mesh with a vertex-shader wave (the Home already has a WebGL canvas), or animate a single DOM element's `transform` plus a clip. A transform-scaled SVG downscaled about 5.8x (1008 px to 175 px) can shimmer: swap to the bar's real SVG on the last frame.

---

## 4. Scroll

- Lenis 1.3.26, GSAP 3.15.0, three 0.186.1, zustand 5, Next 16 (`output: "export"`, `trailingSlash: true`, `typedRoutes: true`, so every `href` is a `Route`; `siteConfig.basePath` may be set). No physics library is installed (no cannon, rapier); `ogl` and `@react-three/fiber` are installed. No postprocessing package either: chromatic aberration is custom.
- Creation: `components/smooth-scroll.tsx SmoothScrollProvider` (in `SiteProviders`): `new Lenis({ autoRaf: false, lerp: 0.12, wheelMultiplier: 1, touchMultiplier: 1.2, syncTouch: false })`, driven by `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`, `lenis.on("scroll", ScrollTrigger.update)`, `ScrollTrigger` registered once. Native touch scroll (no `syncTouch`).
- API (`useLenis()`): `scrollTo(target|y|el|selector, {offset, immediate, duration})` (always `force:true`), `pause()` / `resume()` (COUNTED; `pause` before Lenis exists is replayed at creation), `getLenis()`. `pause` = `lenis.stop()` = `html.lenis-stopped { overflow: clip }`.
- Reading scroll per frame: `getLenis()?.scroll ?? window.scrollY` (the About director, `director.ts:261`) in its own `requestAnimationFrame`; or `window` `scroll` listener plus an rAF flag (`about/opening/film.tsx:126`), `lib/hooks.ts useScrollProgress(cb)` (0..1 of the document, rAF-throttled, also on `NAVIGATED_EVENT`), `useRafLoop(cb(dt, t), enabled)` (dt capped 0.1, pauses with the tab), `usePointer()` (smoothed -1..1 vector, one shared listener set).
- Pinned and long sections are done two ways:
  1. CSS sticky tracks: a `section` of `height: calc(var(--screens) * var(--lvh))` containing a `position: sticky; top: 0; height: var(--lvh)` stage (About: `opening.module.css:8-35`, `--lvh: 100lvh` under `@supports`), progress from `scrollY - trackTop`. Scroll distances are in "screens of lvh" so phones' address bars do not matter: `features/character/vexana/seams/scroll-kit.ts lvh()`.
  2. GSAP ScrollTrigger scrubbing with `onUpdate` writing a transform (`vexana/cover/cover.tsx:97-155`, `start: "top bottom"`, `end: () => "top top-=" + screens * lvh()`, `invalidateOnRefresh`); and `vexana/seams/hold.tsx` (`Hold`, `useHold`, `useHoldProgress(fn)`: the last screen of a section stays put for `hold` screens while a scene is drawn from the scroll alone, stateless so going back plays it backwards).
- Helpers: `vexana/seams/scroll-kit.ts` (`seg(v,a,b)`, `easeInOut`, `easeOut`, `put(el, prop, value)` writes a style only when it changed, `lvh()`); `vexana/seams/snap.ts useScrollSnap(id, getRange, {idleMs=1500, snapSeconds=0.9, onSnap})` (a stretch the visitor cannot rest in: after the page is still `idleMs` it scrolls to the nearer end; CLAUDE.md says 1 s inside a join); `vexana/seams/scroll-lock.ts useScrollLock()` (`lock(limitMs=3000)` pauses Lenis AND swallows wheel, touchmove and scroll keys in capture, `unlock()` forgets what was scrolled and re-syncs Lenis); `vexana/seams/arrive.ts` (`makeSwitch`, `filmArrive`: "this section has arrived" switches, `useSwitch`); `about/choreo/ease.ts`; `lib/math.ts` (`clamp, lerp, damp(current,target,lambda,dt), map, smoothstep, wrap, mulberry32`); `lib/motion.ts` (`easings, gsapEase, durations, springs, springStep, cssEase`).
- Locks: three families. (a) `useScrollLock` (Lenis paused plus guards; scrollbar hides, so use `BareScrollbar`; default 3 s limit). (b) `holdScroll()` in comic kit (guards only, Lenis running, scrollbar stays). (c) none, the page is simply short. The Home intro needs (a) with a long `limitMs` plus `BareScrollbar`, or (b) plus `html { overflow: hidden }`-free approach; do not mix them.
- `BareScrollbar` (`vexana/shared/bare-scrollbar.tsx`): sets `html[data-bare-scroll]` in a layout effect (`styles/base.css:26`: `scrollbar-width: none` and `::-webkit-scrollbar { display: none }`), removes it on unmount. CLAUDE.md: the one progress mark is the hairline in `hud-frame.tsx`; "Do not bring a scrollbar back on those pages."
- Gotchas (CLAUDE.md "Performance"): never write a CSS custom property or inline style on `<html>` or `<body>` per frame (a test guards it); animate `transform` and `opacity` only, no `filter`, `backdrop-filter`, `mix-blend-mode` over live pictures or on elements with animated children; no per-frame SVG attribute writes; long text and lists `content-visibility: auto` built in slices; transitions inside a long page are made by the layout, no scroll indicator inside a transition, a stop inside a join snaps after 1 s, no scroll cue inside a join; something that follows a video runs on the compositor (Web Animation), not a frame loop. `html.lenis, html.lenis body { height: auto }`; `[data-lenis-prevent]` for inner scrollers; `.lenis-smooth iframe { pointer-events: none }`.
- WebGL canvas layers are fine (Portal, the About drone, Selena's stage); the "transform and opacity only" rule is for DOM and CSS animation. Cursor: `components/lantern-cursor.tsx` (off on touch-first) shows a label from any element's `data-cursor="VIEW"`, snaps to `data-snap` elements, ring colour via `data-cursor-theme`; `data-lantern` elements get local `--mx/--my`. Use `data-cursor` for "View image" tooltips. Note the owner's chromatic-aberration hero images need their own shader (no postprocessing dependency, and no CSS filter over the live picture).
- Layers: `--z-content 1`, `--z-hud 40`, `--z-nav 50`, `--z-consent 60`, `--z-menu 70`, `--z-popover 75`, `--z-modal 80`, `--z-transition 90`, `--z-cursor 95`, `--z-gate 100`, `--z-skip 110` (`styles/tokens.css:115-127`). `<main id="main" tabIndex={-1} class="relative z-(--z-content)">` is the page container.

---

## 5. Audio

- Engine `lib/audio.ts` (exported singleton `audio`, 612 lines): one AudioContext graph `blips (sfx gain 0.9) | voice (decoded buffers, analyser) via voiceBus gain 1.9 | music (media element) via musicBus (+ its own analyser) -> master -> DynamicsCompressor (threshold -14 dB, ratio 3) -> destination`. Two music slots crossfade. Everything is a safe no-op before `unlock()`.
- The "pressed something" rule: browsers need a gesture. `audio.unlock()` must run synchronously inside a pointerdown, click or keydown (it resumes the context, plays a 1-sample buffer, primes two `<audio>` elements for iOS). `LoaderGate` registers one-shot window `pointerdown` and `keydown` for it (`loader-gate.tsx:58`), so the first press anywhere unlocks. `audio.unlocked` is true when ready. For video with sound, the Films deck uses `navigator.userActivation.hasBeenActive` else `audio.unlocked` (`features/library/video/films/deck.ts:212 soundAllowed()`), and `animation/theme/player.ts` uses `navigator.userActivation.isActive` ("inside a press"). `startMusic` also re-arms itself on the next `pointerdown`/`keydown` if the element is paused.
- Site sound state: `useSiteStore` (`lib/stores.ts`) `muted: boolean` (default false = sound ON, persisted in `localStorage["aspirants:prefs"]`, validated by zod), `toggleMute`. `PreferencesSync` (`site-providers.tsx:34`) calls `audio.setMuted(muted)` (ramped to 0 on the master). `SoundButton` and the `M` hotkey (`hud-frame.tsx`) call `audio.unlock()` then `toggleMute()`.
- Asking: `lib/sound-prompt.ts` `withSound(what, run)` / `ensureSound(what)`: if sound is OFF and the visitor pressed something that is ONLY sound, a dialog asks ("Turn sound on" / "Keep it off" / "Do not ask again", `localStorage["aspirants:soundPrompt"]`). Things that make sound by themselves (blips, hover voice lines, page music) never ask and stay silent when muted. Use `withSound` for the gramophone record and the voiceline play buttons.
- Page music: `lib/now-playing.ts startMusic(track, volume = 0.22)`: sets `useNowPlaying` ({track, playing}, shown by the nav record widget), `audio.playMusic(mediaUrl(track.src), {loop:true, volume, fadeMs: 5000})`, stops with 3500 ms fade; `Track {title, artist, cover, src}`. `audio.playMusic(url, {loop, volume (default 0.5), fadeMs (1200)})` crossfades between two slots, `pauseMusic(fadeMs)` / `resumeMusic(fadeMs)` (token-guarded fades), `setMusicVolume`, `stopMusic(fadeMs = 2500)`, `getMusicElement()`, `getMusicAnalyser()` (not voice), `getSynthOut()`. One music at a time site-wide: the Music room's `usePlayer` (`features/library/music/player-store.ts`, `playTrack`, `closePlayer`) and the Animation room's theme player both stop each other. A home gramophone must follow the same single-slot rule, set `useNowPlaying` if the nav widget should show, and `audio.stopMusic(fade)` when the section is left.
- Voice lines: `audio.playVoice(url, {volume (default 1), onEnd})` decodes whole through `cachedFetch` (Cache Storage, so a `savedItem(url)` in the preload list warms it), plays through the voice bus and analyser (waveform: `components/audio/waveform.tsx`, `audio.getAnalyser()`), ducks music to 0.18 (0.18 s attack, 0.9 s release) via `duckMusic`, stops the previous line. `audio.preloadVoice(url)` decodes ahead. The Voicelines room's helper `features/library/voicelines/playback.ts toggleLine(url, onEnd?)` is generic (unlock, `withSound`, stop recording, blip, `playVoice`) and can be reused for the home voice section; `toggleRecording` is for 2 to 5 minute files through the music slot.
- Loudness today: NO normalisation anywhere. The only levers are `voiceBus` gain 1.9 ("voice lines are recorded quieter than the music"), the master compressor, `MUSIC_VOLUME 0.22`, the Music room `volume 0.8`, `RECORDING_VOLUME 1`, and the per-call `playVoice({volume})`. For equal voice levels (home AND `/collection/voicelines`, the owner's request): either (a) runtime: in `loadBuffer` measure each decoded buffer once (RMS or K-weighted over non-silent frames, cache by URL) and set `gain.gain.value = volume * target / measured` with a ceiling, no data change, works for every file; or (b) pipeline: `scripts/library/voicelines/build.py` re-encode with ffmpeg `loudnorm` (two pass). (b) conflicts with the rule "never write a key twice, Japanese keys never change" (`LIBRARY_VERSION` in `lib/library.ts` and `scripts/library/common.py`, new mirror folder `D:\ren\aspirant-r2`, `python scripts/library/r2.py sync`, 30 day cache), so (a) is the cheap safe default and (b) is optional on top.
- Library audio is cross-origin (R2): `el.crossOrigin = "anonymous"` is set; Playwright specs must run on `localhost:3190` because the bucket's CORS lists it (not 127.0.0.1).
- Home usage: after the tap the audio is unlocked, so the intro may use blips (`audio.blip("whoosh" | "star" | "click" | "confirm" | "hover" | "error")`, rate limited per kind) and a music bed; the gramophone section plays a track through `audio.playMusic(libUrl(item.src), {loop:false, volume})` with `audio.getMusicAnalyser()` driving the notes from the horn; the voice section plays `toggleLine`.

---

## 6. Every place that treats `/` (Home) specially

Code

- `app/page.tsx` (the whole page, metadata, the `NextFooter` to About with `/img/hero-stills/selena-obsidia-01.webp`).
- `features/home/**`: `data.ts` (imports `public/data/fanart.json`, `@/content/{characters,pairs,story,world,site-copy}`), `types.ts`, `hero/{PortalHero,PortalScene,HeroTitle,portalController,portalShader,hero.module.css}`, `manifesto/`, `versus/`, `before-after/`, `ten/`, `hall/`, `doors/`. Only `app/page.tsx` and `lib/route-preloads.ts` import them (`src/content/**` is a knip entry, so content stays unflagged; the home folder will be flagged if left).
- `lib/route-preloads.ts:68-84` (`/` branch: chunk `home-scene` 4, `/img/portal/vexana/{base,depth,alt,depth-alt}.webp`, `/img/char/vexana/{splash-sm,extra-1}.webp`).
- `lib/site.ts`: `routes.home = "/"`, `navItems[0] = {href: "/", label: "Home", index: "01"}`, `isActiveRoute` special-cases `"/"` (exact match only).
- `components/nav/site-nav.tsx:179` brand link `routes.home`; `components/nav/menu-pairs.ts:20` home pair (`/img/menu/home-left|right.webp`, tint `#ffdcc8`, built by `scripts/menu/build.py`).
- `app/sitemap.ts:42-46` (`navItems` map, priority 1 for `/`), `app/manifest.ts:12` `start_url`, `app/opengraph-image.png`, `content/site-copy.ts` `siteCopy.meta.home` ("Ten Aspirants, one academy, and a world that keeps a lamp lit.") and the `home:` block (lines ~84-110) used by the old sections.
- `features/library/shelf/continue-home.tsx` (button and `N` key: Collection to Home through the curtain, `routes.home`), `app/not-found.tsx:25`, `features/legal/legal-page.tsx:96` (links to Home), `components/next-footer/next-footer.tsx` (shared; the About page has none now), `features/character/*` pages end in `NextFooter` and the queue "Home, About, Story, Characters, Collection, Home" is documented in `docs/design/design-system.md:104,150,406`.
- `lib/return-to.ts` `RETURN_ROUTES`: no `home` key. If Home sections link into rooms (About, Films, Animation, Voicelines, Music, Comic, Fanart), CLAUDE.md says a new way out must read `useReturnTo`; to make rooms say "Home" add `home: { href: "/", label: "Home", places: [...] }` and use `withReturn(href, "home", place)`. Not requested by the owner; decide.
- `features/legal/consent/consent-banner.tsx:15` `FIRST_SHOW_MS = 900` after `entered`.

Tests, probes, config

- `apps/web/e2e/home.spec.ts` (all 10 tests are the old page: portal, versus, before-after, the ten, hall of fame, axe), `a11y.spec.ts` (`ROUTES` loop includes `/`; test "no serious accessibility violations with the loader gate up" holds `/img/portal/vexana/depth.webp` and expects `#site-shell` inert), `shell.spec.ts` (lines 10, 19-23 skip link and menu `aria-current` Home, 59-72 the next-destination chain ends `"/collection/", "/"`, 84 `M` toggles sound, 94-111 scrolling to the bottom of `/` opens `/about/` within 8 s, also under reduced motion), `menu.spec.ts:8` (opens `/` and clicks "Open menu" at once, so with `skipGate` the nav must NOT be empty), `smoke.spec.ts:53` and `helpers.ts` `ROUTES[0]` and `skipGate` (sets `aspirants:entered=1`, `aspirants:intro=off`, consent rejected).
- Who is affected by the tap gate (a fresh context with an empty referrer counts as "from outside", so `/` stops at "Touch anywhere" forever unless the runner taps or opts out). All 36 files in `apps/web/e2e/*.spec.ts` call `skipGate` (`aspirants:entered=1` + `aspirants:intro=off`), so they are safe as long as BOOT honours `intro=off`; `smoke.spec.ts` and the `ROUTES` loop of `a11y.spec.ts` also use it. NOT safe: `scripts/qa/probes/lib.cjs context()` sets only `entered=1`, so add `aspirants:intro=off` there (used by `menu-shots.cjs` whose default route is `/`, and by every probe that opens `/`); `scripts/qa/probes/first-visit.cjs` and `routes.cjs` build fresh contexts (no skip) and measure the loader: add a tap step after `ready` (that is what they should measure, and it keeps the "never opens with part of the page" check); `scripts/perf/weak.mjs` (Edge, default route `character/selena/`, fresh context) needs a tap step or `intro=off` when given `/`. `lighthouserc.json` (`lighthouse.yml`, `treosh/lighthouse-ci-action@v12`, `staticDistDir ./apps/web/out`, a fresh context) audits `/index.html` and asserts accessibility score 1: it will see the cover or the loader state, so the progressbar (`role="progressbar"` with name and `aria-valuenow`), the status paragraph, the full-viewport tap `<button>` (accessible name "Touch anywhere to continue") and every colour pair must pass; `a11y.spec.ts` "gate up" test, `first-visit.cjs`: see above.
- `menu.spec.ts`, `shell.spec.ts` and the specs above depend on the bar NOT being empty after `skipGate`: with `intro=off` the Home mounts in `open` with menu and sound visible.
- Orphaned after the rewrite: `apps/web/public/img/portal/**` (guinevere-vexana, selena-obsidia, vexana), `scripts/assets/build.mjs` stage `portal` ("home portal faces"), `features/home/*` exports (knip), maybe `content/world` `contrasts` and the `siteCopy.home` strings. Run `pnpm check` (Prettier, typecheck, ESLint, unit tests, knip) and `node scripts/qa/scan-text.mjs` (must report 0 problems).
- Docs to update in the same change: `README.md:13` (route table row for `/`), `docs/HANDOFF.md` (project summary, the "home specs flake" note, the loader description), `CLAUDE.md` (a new "Home" section like About's, and the Loading rules: tap gate, drone loader, home arrival), `docs/design/design-system.md` (footer queue), `docs/design/performance.md` if new rules, and `docs/superpowers/specs/2026-11-18-home-page-redesign.md` (not yet written; the request file says it will list every call).

---

## 7. Risks and contradictions, with the way out

1. Inert shell vs a pokeable loader drone: use a root-level layer outside the shell (section 1.5). Do not lift `inert` for the whole shell (hidden links would be tabbable).
2. Cover flash on an entered-tab reload: fix BOOT (section 0, item 2). The decision must be one value written by BOOT and consumed once by `LoaderGate` into `useHomeFlow`. If the architect prefers "an entered tab skips the loader" (it keeps every existing runner convention, `entered=1`, working), the cost is the flash of the server HTML before hydration on a reload of `/`: then the server HTML of the hero must be the plain resting state, with nothing that a later client intro would visibly undo.
   2b. Layer z-order: 90 during loader and intro, below the bar (under 50) at `open`, no pointer events on the canvas, NavLock fields reset when the path leaves `/` (section 1.5).
   2c. Runners that open `/` without `skipGate` (probes, perf, Lighthouse) now stop at the tap gate: list in section 6, each needs a tap step or `aspirants:intro=off`.
3. `entered` timing drives three other features: set it at the END of the intro. If a visitor leaves mid-intro the flag is unset, which is correct (they see the loader again on a reload).
4. Whole-file media only: do not plan "streaming the first seconds" through `mediaItem`. Cut short low-res clips (new script) or use `warmFilm`.
5. A section waiting on a deferred file needs a shared progress aggregator (section 0, item 8). Do not copy `room-load.ts`'s 120 s cap.
6. WebGL context count (section 1.5): one shared renderer or release canvases when far. Test with the GPU on and on SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, as `e2e/home.spec.ts` does).
7. Scroll lock for 8 to 15 s: `useScrollLock` default 3 s limit; scrollbar shift; touch (Lenis does not own touch, `syncTouch: false`) needs the `touchmove` capture guard or `overflow: clip` from `lenis.stop()`.
8. Percent from `runPreload` is weight based, not byte based, and `chunkItem` jumps: give explicit weights and show real bytes.
9. Handoff: two WebGL canvases never overlap if the Home drone leaves to the right and About's pass enters from the right. A true pose handoff needs the new `stageRefs.arrival` field and a change in `about/drone/director.ts`, which another agent may own.
10. Dev vs build: measure speed and the loader on `pnpm build` + `serve out`; the dev server on :3000 is `no-store` and slow, and `pnpm dev` WebGL timings are 2 to 3 times worse. E2E runs against `apps/web/out` on :3190 (`out/` is about 4 GB; build takes 1 to 2 min), so "always update localhost:3000" means leave `pnpm dev -p 3000` running (it hot-reloads) and still run a build before e2e.
11. Reduced motion is ignored by the owner's decision, no lite path: a visitor with `prefers-reduced-motion` still gets the full intro. Only no-WebGL gets the still.
12. Not verified here: the actual byte sizes of any Home asset that does not exist yet, GLB rigs of Silverbolt, Selena, the doll and the hand (other recon agents), the wave-morph shader, and mobile (390 px) behaviour of the intro.
