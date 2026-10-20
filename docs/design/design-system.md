# The Aspirants: design system and shell

Read this and `spec.md` before you build a page. The `/kit` reference page existed during development and has been removed; the pages themselves are the reference now.

Contents: [Run it](#run-it) · [Tokens](#tokens) · [Utilities](#utilities) · [The shell](#the-shell) · [Components](#components) · [Hooks and lib](#hooks-and-lib) · [Audio](#audio) · [Motion rules](#motion-rules) · [Accessibility rules](#accessibility-rules) · [Responsive rules](#responsive-rules) · [How to build a page](#how-to-build-a-page)

## Run it

```bash
# Private dev server (port 3000 is the owner's preview). Pick your own port and dist dir.
NEXT_DIST_DIR=.next-<you> pnpm --filter @aspirant/web exec next dev -p 3101
# PowerShell
$env:NEXT_DIST_DIR=".next-<you>"; pnpm --filter @aspirant/web exec next dev -p 3101

pnpm check                    # format, typecheck, lint, unit tests, knip
pnpm build                    # static export to apps/web/out
BASE_PATH=/aspirant pnpm build  # production base path (Git Bash: prefix MSYS_NO_PATHCONV=1)
pnpm test:e2e                 # Playwright on the export: phone, tablet, desktop
node scripts/qa/scan-text.mjs # dashes and banned words
```

The e2e server detects the base path from `out/index.html`, so the same command tests both builds. Tests skip the loader by setting `sessionStorage["aspirants:entered"] = "1"` (see `apps/web/e2e/helpers.ts`).

## Tokens

All tokens live in `apps/web/src/styles/tokens.css`. Tailwind utilities map onto them (`apps/web/src/app/globals.css`).

### Two worlds

`data-theme="storm"` (void black, the default on `<html>`) and `data-theme="daybreak"` (white ceramic). Every themed token flips inside an element with `data-theme`, so a section switches world with `<ThemeZone theme="daybreak">`.

| Token                                                | Use                                                                  | Tailwind                            |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `--bg`, `--bg-2`                                     | page and raised surfaces                                             | `bg-bg`, `bg-bg-2`                  |
| `--panel`, `--panel-glass`                           | panels (solid, translucent)                                          | `bg-panel`                          |
| `--line`, `--line-strong`                            | hairlines, borders                                                   | `border-line`, `border-line-strong` |
| `--text`                                             | headings, primary text (17:1 or more)                                | `text-text`                         |
| `--text-dim`                                         | body text (9.8:1 storm, 8.5:1 daybreak)                              | `text-text-dim`                     |
| `--text-faint`                                       | micro labels only (4.5:1 or more)                                    | `text-text-faint`                   |
| `--cyan --gold --amber --violet --magenta --crimson` | accents, tuned per theme to read at 4.5:1 or more on every surface   | `text-cyan`, `bg-gold`...           |
| `--focus`                                            | focus ring (gold white on storm, blue on daybreak)                   | `outline-focus`                     |
| `--accent`, `--accent-2`, `--glow`                   | per page or per component colour (characters set their palette here) | `text-accent`, `bg-accent`          |
| `--on-accent`                                        | text on an accent fill                                               | `text-on-accent`                    |
| `--scrim`                                            | modal backdrops                                                      |                                     |

Constant (never flips): `--ink` (#05070c), `--graphite`, `--ceramic` (#f3f5f9) and the bright light colours `--light-cyan --light-gold --light-amber --light-violet --light-magenta --light-crimson` for glows, particles and art overlays. Do not set body text in a `--light-*` colour on Daybreak.

Character palette: set it on a wrapper, everything inside follows.

```tsx
<div style={{ "--accent": "var(--magenta)", "--glow": "var(--light-magenta)" } as CSSProperties}>
```

### Type

| Voice                     | Family                           | Class                                           |
| ------------------------- | -------------------------------- | ----------------------------------------------- |
| Display, condensed, heavy | Big Shoulders Display (variable) | `display` (upper case, tight) or `font-display` |
| Narration, italic too     | Instrument Serif                 | `serif` (+ `italic`)                            |
| HUD labels, numbers       | JetBrains Mono (variable)        | `mono`, `hud-label`                             |
| Body                      | Hanken Grotesk (variable)        | default on `body`                               |

All four are self-hosted through `@fontsource` packages (imported in `app/layout.tsx`). Japanese falls back to the system CJK fonts.

Fluid scale from a 320 px to a 3440 px viewport: `--step--2` to `--step-8`, utilities `text-step--2` ... `text-step-8`. Body is `step-0` (16 to 21 px). Page titles use `step-7` or `step-8`, section titles `step-5`, leads `step-2` or `step-3`.

### Space, shape, depth

- Fluid space `--space-3xs` ... `--space-4xl`. Tailwind: `p-sp-m`, `gap-sp-xs`, `mt-sp-2xl` (the `sp-` prefix keeps Tailwind's own sizes such as `max-w-xl` intact).
- `--gutter` (page side padding; on desktop it also clears the HUD rails), `--nav-h`, `--measure` (68ch), `--content-max`. Tailwind: `px-gutter`, `top-nav`, `scroll-mt-nav`.
- Radius is 0 everywhere. Corners are cut with clip-path: `--cut` (14 px), `--cut-sm`, `--cut-lg`.
- Z order: `--z-ember 0`, `--z-content 1`, `--z-hud 40`, `--z-nav 50`, `--z-menu 70`, `--z-popover 75`, `--z-modal 80`, `--z-transition 90`, `--z-cursor 95`, `--z-gate 100`, `--z-skip 110`. Tailwind: `z-(--z-modal)`.

### Motion tokens

CSS: `--ease-out`, `--ease-in`, `--ease-in-out`, `--ease-heavy` (Storm), `--ease-spring` (Daybreak, a `linear()` spring), `--dur-instant 90ms`, `--dur-fast 160ms`, `--dur-base 260ms`, `--dur-slow 420ms`, `--dur-slower 700ms`, `--dur-epic 1100ms`.

JS (`@/lib/motion`): `easings` (bezier arrays for Motion), `gsapEase` (`out: "expo.out"`, `heavy: "power4.inOut"`...), `durations` (seconds), `durationsMs`, `springs` (`soft`, `snappy`, `heavy`), `springStep(state, target, dt, config)` for hand-rolled springs, `cssEase(name)`.

## Utilities

Declared with `@utility` in `styles/utilities.css`, so variants work (`md:chamfer`).

| Class                                   | Effect                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `display`, `serif`, `mono`, `hud-label` | type voices (`hud-label`: mono, upper case, tracked, `--text-faint`)                           |
| `shell`                                 | content width plus `--gutter` side padding                                                     |
| `below-nav`                             | top padding that clears the fixed nav                                                          |
| `chamfer`, `chamfer-4`                  | cut corners (2 or 4), size with `--cut`                                                        |
| `scanlines`, `scan-band`                | CRT lines; a slow light band                                                                   |
| `grid-hex`, `grid-dots`                 | hex or dot grid behind content (`--grid-color`, `--grid-size`)                                 |
| `fade-edges`                            | radial mask so grids do not end in a hard line                                                 |
| `link`                                  | inline link with a directional underline                                                       |
| `lantern-mask`                          | masks the element to the lantern disc (needs `data-lantern` on an ancestor, see LanternCursor) |
| `text-balance`                          | Tailwind's own                                                                                 |

Never put `clip-path` on a focusable element: it clips the focus outline. Clip a background layer (pseudo element or child) instead. Every component here follows that rule.

## The shell

`app/layout.tsx` renders, in order: boot script (sets `html.js`, `data-motion`, `data-pointer`, and `data-gate` before paint), `#site-shell` (skip link, `EmberField`, `SiteNav`, `HudFrame`, `<main id="main" tabIndex={-1}>`), `LanternCursor`, `FocusStar`, `LoaderGate`. Providers (`SiteProviders`): store hydration and `<html>` attribute sync, `SmoothScrollProvider`, `TransitionProvider`, Radix `TooltipProvider`.

There is no site footer: every page ends with a `NextFooter`.

### Routes and the next chain

`/` → `/experience/` → `/story/` → `/character/` → `/collection/` → `/`. Character pages loop in queue order (`fanny` ... `selena` → `fanny`). The static export uses trailing slashes; write hrefs without them (`routes.story` is `"/story"`), Next adds them.

```ts
import { routes, characterRoute, navItems } from "@/lib/site";
import { CHARACTER_SLUGS, CHARACTER_NAMES, nextSlug, prevSlug, isCharacterSlug } from "@/lib/slugs";
```

## Components

Each export has a TS doc comment in its file. Paths are under `apps/web/src`.

### Layout and world

**`ThemeZone`** `@/components/theme-zone`: `{ theme: "storm" | "daybreak"; as?: tag; surface?: boolean (paint the bg, default true) } & HTML attributes`. Server rendered.

```tsx
<ThemeZone theme="daybreak" aria-labelledby="places-title" className="py-sp-2xl">
  <h2 id="places-title">Where you are</h2>
</ThemeZone>
```

**`PageTheme`** same file: `<PageTheme theme="daybreak" />` switches `<html>` for a whole page after hydration. Prefer `ThemeZone`.

**`PageIntro`** `@/components/page-intro`: stub hero (`code`, `title` as the h1, `lead`, `note`, `theme`). Replace it with your own hero.

### Navigation

**`TLink`** `@/components/transition/t-link`: every internal link. Renders Next `<Link>` (real `<a>`, prefetch, base path). Plain left click runs the hexagon transition; modifier keys, middle click, `target` and `download` behave natively. External URLs (`https://...`) open in a new tab. Props: Link props plus `href: Route | ExternalHref`, `transitionLabel?`, `transition?: boolean`, `blip?: boolean`.

```tsx
<TLink href={characterRoute("layla")} transitionLabel="Layla" className="link">
  Layla
</TLink>
```

**`useTransitionRouter()`** `@/components/transition/transition-provider`: `{ push(href, { origin?, label? }), prefetch(href), isTransitioning(), reveal({ tone }) }`. The iris covers, navigates, scrolls to top, reveals, then focuses `<main>`. Reduced motion: a 150 ms crossfade.

```tsx
const router = useTransitionRouter();
router.push(routes.collection, { label: "Collection", origin: { x: e.clientX, y: e.clientY } });
```

**`NextFooter`** `@/components/next-footer/next-footer`: `{ eyebrow?: string (default "Next destination"); label: string; sublabel?: string; href: Route; image?: string (public path, decorative); accent?: string }`. 140 vh region, sticky stage, ring fills with scroll, opens `href` at 98 percent (scroll back to cancel), Continue button, `N` key, polite live announcement. Reduced motion: no auto-advance. Exactly one per page, last in `<main>`.

```tsx
<NextFooter
  label="Layla"
  sublabel="Unit 02 of 10"
  href={characterRoute("layla")}
  image="/img/char/layla/splash.webp"
  accent="var(--cyan)"
/>
```

**`SiteNav`**, **`HudFrame`**, **`LoaderGate`**, **`LanternCursor`**, **`FocusStar`**, **`EmberField`** (fixed) are mounted once in the layout. Do not mount them again.

### Buttons

**`StarButton`** `@/components/ui/star-button`: the primary action. `{ variant?: "solid" | "ghost"; size?: "sm" | "md" | "lg"; emblem?: boolean (icon only, needs aria-label); pulse?: boolean; arrow?: boolean; href?: Route (renders a TLink); transitionLabel?; blip?: BlipKind | false } & button attributes`. One `pulse` per screen.

```tsx
<StarButton pulse onClick={start}>Enter the archive</StarButton>
<StarButton variant="ghost" href={routes.story}>Read the world</StarButton>
<StarButton emblem size="sm" aria-label="Play line 3" aria-pressed={playing} data-cursor="PLAY" />
```

**`SoundToggle`**, **`MotionToggle`** `@/components/hud/preference-toggles`: `{ labeled?: boolean; className? }`. `MotionToggle` is in the HUD and the menu. The nav has its own `SoundButton` (below); use these toggles in a page only for an in-context control.

### Text

All text effects keep the full text for assistive tech (a visually hidden copy) and put the split spans under `aria-hidden`. Under reduced motion they render static. Before hydration, text is visible (no-JS safe).

**`SplitText`** `@/components/text/split-text`: `{ text: string; as?: tag (default "span"); by?: "chars" | "words" | "lines" (default "words"); trigger?: "mount" | "inview"; delay? (s); stagger? (s); className? }`.

```tsx
<SplitText as="h2" by="chars" className="display text-step-6" text="The Aspirants" />
```

**`ScatterText`** `@/components/text/scatter-text`: letters scatter from the pointer or finger and spring back. `{ text; as?; radius? (90); strength? (1); className?; letterClassName? }`.

```tsx
<ScatterText as="h1" text="Selena" className="display text-step-8" />
```

**`LampText`** `@/components/text/lamp-text`: words light up as the block scrolls past, like a lamp moving over it (ScrollTrigger scrub). `{ text; as? ("p"); start? ("top 80%"); end? ("bottom 45%"); className? }`.

```tsx
<LampText
  className="max-w-[24ch] serif text-step-4"
  text="Aspirant is a story about ten Aspirants..."
/>
```

**`Typewriter`** `@/components/text/typewriter`: `{ text; as?; speed? (38 chars/s); startDelay? (s); trigger?; caret? (true); onDone?; className? }`.

```tsx
<Typewriter trigger="inview" className="mono" text="Resonance link established." />
```

### Panels and bits

**`HudPanel`** `@/components/ui/hud-panel`: chamfered panel with corner ticks and a mono header. `{ label?; code?; scan?: boolean; accent?; tone?: "solid" | "glass"; as?; className?; bodyClassName? }`. No hooks, usable in server components.

```tsx
<HudPanel label="Unit 07 / Twilight Star" code="SYNC 1.62" accent="var(--violet)">
  <p className="m-0 text-text-dim">Age 15. Daybreak.</p>
</HudPanel>
```

**`Tag`** `@/components/ui/tag`: `{ variant?: "outline" | "solid" | "warn"; accent? }`. Use `warn` for "Non-canon parody". With `solid`, pass a themed token (`var(--violet)`), not a `--light-*` colour.

**`Meter`** `@/components/ui/meter`: segmented coupling meter, `role="meter"`. `{ value; max? (1); segments? (20); label; showValue?; format?; orientation?: "horizontal" | "vertical"; accent? }`.

```tsx
<Meter label="Coupling" value={2.1} max={2.5} format={(v) => v.toFixed(2)} />
```

**`Marquee`** `@/components/ui/marquee`: `{ speed? (40 px/s); reverse?; pauseOnHover? (true); gap?; label? }`. Copies are `aria-hidden` and `inert`; stops off screen and under reduced motion.

**`Reveal`** `@/components/ui/reveal`: in-view reveal wrapper. `{ as?; variant?: "fade-up" | "fade" | "mask-up" | "scale" | "clip"; delay? (ms); once? (true) }`.

```tsx
<Reveal variant="mask-up">
  <h2 className="display text-step-5">The ten</h2>
</Reveal>
```

### Frames

**`Frame`** `@/components/frame/frame`: `{ shape?: "chamfer" | "hex" | "star" | "arch" | "parallelogram" | "rift" | "bite" | "ticket" | "circle" | "emblem"; tilt? (true); maxTilt? (8); glow? (true); accent?; label? (HUD caption); as?: "div" | "figure" | "li" | "article" | "section" | "span"; mediaClassName? }`. Size it from outside (width, aspect ratio). `circle`, `bite`, `emblem` and `hex` want a square box. For a linked frame, wrap the Frame in a TLink.

**`FrameImage`** `@/components/frame/frame-image`: `{ src; alt; width; height (all required); parallax?: boolean | number; priority?; sizes?; srcSet?; objectPosition? }`. Lazy by default; `src` goes through `asset()`.

```tsx
<Frame
  as="figure"
  shape="hex"
  accent="var(--magenta)"
  label="UNIT 08 / TWILIGHT STAR"
  className="aspect-square w-64"
>
  <FrameImage
    src="/img/char/vexana/splash-sm.webp"
    alt="Vexana"
    width={800}
    height={450}
    parallax
  />
</Frame>
```

Shape data (`@/components/frame/frame-shapes`): `FRAME_SHAPE_NAMES`, `FRAME_SHAPES` (vertices as `[x%, x px, y%, y px]`), `FRAME_CLIP_PATHS` (CSS `polygon()` strings), `framePoints(shape, w, h)`, `framePath(shape, w, h)` for your own SVG or canvas work.

### Overlays

**`HoverCard`** `@/components/ui/hover-card`: entity card for running text. `{ children (trigger text); card: ReactNode; accent?; label?; className? }`. Opens on hover (150 ms intent), focus and tap; Esc closes; portal with viewport-aware placement; `aria-describedby` while open. If the card holds a link, click or Enter pins it and moves focus inside.

```tsx
<p>
  In Tanner's Row, <HoverCard card={<EntityCard id="layla" />}>Layla</HoverCard> waits.
</p>
```

**`Lightbox`** `@/components/ui/lightbox`: `{ items: LightboxItem[] ({ type: "image" | "video"; src; alt; width; height; caption?; credit?: { name; href? }; poster? }); index: number | null; onIndexChange; label? }`. Focus trap, Esc, arrows, swipe, credits. Always credit fan art.

```tsx
const [i, setI] = useState<number | null>(null);
<Lightbox items={art} index={i} onIndexChange={setI} label="Hall of fame" />;
```

**`Dialog`** `@/components/ui/dialog`: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose` (Radix, themed). For bespoke modals use `Dialog` from `radix-ui` directly and pause scrolling with `useLenis().pause()`.

### Light, particles, WebGL

**`EmberField`** `@/components/ember-field`: `{ contained?: boolean; theme?: "storm" | "daybreak"; density? (1); className? }`. Fixed in the layout already. For one section: put it first inside a `relative isolate overflow-hidden` block.

```tsx
<ThemeZone theme="daybreak" className="isolate overflow-hidden">
  <EmberField contained />
  <div className="relative">...</div>
</ThemeZone>
```

**`LanternCursor`** (layout): pointer devices only. On any element: `data-cursor="PLAY"` shows a label on the ring, `data-cursor-theme="light" | "dark"` forces its colour. Lantern reveals: mark a block with `data-lantern` (it receives local `--mx/--my`) and put the `lantern-mask` utility on the layer to reveal. `<html>` also gets `--lx/--ly` (viewport px) and `data-lantern="on"`. Content revealed this way must also exist in readable form (touch has no lantern).

```tsx
<div data-lantern className="relative">
  <p className="text-text-faint">The window is dark.</p>
  <p aria-hidden className="absolute inset-0 text-gold lantern-mask">
    The lamp is on.
  </p>
</div>
```

**`GLStage`** `@/components/gl/gl-stage` (default export): R3F `<Canvas>` with DPR capped at 1.75, frame loop paused off screen and in hidden tabs, WebGL check and error boundary. `{ children; fallback?: ReactNode; camera?; dpr?; eventSource?; label?; className? }`. Always load it with `next/dynamic` and `ssr: false`.

**`PointerRig`** `@/components/gl/pointer-rig`: damped camera that follows the shared pointer. `{ strength? (0.35); rotate? (0.08); damping? (4); lookAt?; tilt? }`.

**`PostFX`** `@/components/gl/post-fx`: bloom plus optional chromatic aberration. `{ bloom?: boolean | { intensity?; threshold?; radius? }; chromatic?: boolean | number; enabled? }`. Off on weak devices and under reduced motion.

**`useGLReady()`**, **`hasWebGL()`** `@/components/gl/use-gl-ready`: `{ supported: boolean | null; tier; reduced; ready }`.

```tsx
const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
const Scene = dynamic(() => import("./portal-scene"), { ssr: false });
<GLStage camera={{ position: [0, 0, 5], fov: 40 }} fallback={<StaticArt />}>
  <Scene />
</GLStage>;
```

### Audio UI

**`Waveform`** `@/components/audio/waveform`: `{ url?: string; color?; bars? (48); className? }`. Draws the shared analyser while its voice line plays; decorative.

```tsx
<StarButton emblem aria-label="Play line 1" onClick={() => void audio.playVoice(src)} />
<Waveform url={src} className="h-10 w-48" />
```

## Hooks and lib

| Import                                                 | What                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset(path)` `@/lib/asset`                            | prefix any public file URL with the base path (idempotent, external URLs pass through). Never hardcode `/img/...` in `src`, `href` or `fetch`.                                                                                                                                     |
| `withBase(href)`                                       | base path plus trailing slash for a raw `<a>` or a share URL. `TLink` does not need it.                                                                                                                                                                                            |
| `useSiteStore` `@/lib/stores`                          | `{ entered, setEntered, muted, setMuted, toggleMute, motion: "auto" \| "reduced", setMotion, theme, setTheme, lastChapter, setLastChapter }`. `muted`, `motion`, `lastChapter` persist in localStorage (`aspirants:prefs`, validated with zod); `entered` lives in sessionStorage. |
| `useReducedMotion()` `@/lib/hooks`                     | OS setting or the in-app toggle. `prefersReducedMotion()` for handlers.                                                                                                                                                                                                            |
| `usePointer({ tilt? })`                                | `{ ref, subscribe }`: one shared, smoothed pointer for mouse, touch and pen (`x, y` in -1..1, `clientX/Y`, `speed`, `type`, `active`, `tiltX/Y`). Read `ref.current` in rAF; no re-renders. `requestTiltPermission()` from a tap on iOS.                                           |
| `useMediaQuery(q)`, `useIsTouch()`, `useViewport()`    | `useViewport` gives `{ w, h, aspect, orientation, isUltrawide (21:9+), isTall }`                                                                                                                                                                                                   |
| `useInView(ref, { rootMargin, threshold, once })`      | IntersectionObserver as state                                                                                                                                                                                                                                                      |
| `useRafLoop((dt, t) => ..., enabled)`                  | rAF loop, paused in hidden tabs, `dt` capped                                                                                                                                                                                                                                       |
| `usePageVisible()`, `useMounted()`                     | visibility; client-only gate without hydration mismatch                                                                                                                                                                                                                            |
| `useHotkey("n", handler)`                              | single-key shortcut, ignored while typing or with modifiers                                                                                                                                                                                                                        |
| `useScrollProgress(cb)`, `useThemeAt(point)`           | page progress 0..1; theme under a viewport point (for fixed UI)                                                                                                                                                                                                                    |
| `useVoiceState()`                                      | `{ url, playing }` of the current voice line                                                                                                                                                                                                                                       |
| `useLenis()` `@/components/smooth-scroll`              | `{ scrollTo(target, { offset, immediate, duration }), pause(), resume(), getLenis() }`                                                                                                                                                                                             |
| `useDeviceTier()`, `detectDeviceTier()` `@/lib/device` | `"low" \| "mid" \| "high"` from hardware hints and a short FPS probe                                                                                                                                                                                                               |
| `@/lib/math`                                           | `clamp`, `lerp`, `damp`, `map`, `smoothstep`, `wrap`, `mulberry32`                                                                                                                                                                                                                 |
| `cn` `@aspirant/ui/lib/utils`                          | class merge                                                                                                                                                                                                                                                                        |

GSAP: `ScrollTrigger` is registered once by `SmoothScrollProvider` (Lenis drives the GSAP ticker). Import `gsap` and `ScrollTrigger` normally and use `useGSAP` from `@gsap/react` for cleanup.

## Audio

`import { audio } from "@/lib/audio"`. One Web Audio graph; nothing throws.

| Call                                                                        | Notes                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `audio.unlock()`                                                            | call synchronously inside a click, tap or key handler. The loader's Enter and the sound toggle do it.                          |
| `audio.blip(kind)`                                                          | `"hover" \| "click" \| "confirm" \| "whoosh" \| "star" \| "error"`, synthesised, rate limited, silent when muted or locked     |
| `audio.playVoice(url, { onEnd, volume })`                                   | decodes and plays one line through the shared analyser, stops the previous line, ducks music. Resolves `true` when it started. |
| `audio.preloadVoice(url)`, `audio.stopVoice()`                              |                                                                                                                                |
| `audio.getAnalyser()`                                                       | `AnalyserNode` for waveforms (null before unlock)                                                                              |
| `audio.onVoiceChange(cb)`, `audio.getVoiceState()`                          | or `useVoiceState()`                                                                                                           |
| `audio.playMusic(url, { loop, volume, fadeMs })`, `audio.stopMusic(fadeMs)` | crossfades between two media elements                                                                                          |
| `audio.setMuted(bool)`                                                      | the store does this; use `useSiteStore().toggleMute` in UI                                                                     |

Always pass file URLs through `asset()`. Voice and music are AAC `.m4a`. `M` toggles sound everywhere.

## Motion rules

- Daybreak motion is springy (`--ease-spring`, `springs.soft`); Storm motion is slow and heavy (`--ease-heavy`, `springs.heavy`).
- Animate `transform` and `opacity` only. No layout properties in loops. Read layout, then write.
- Loops run on rAF, stop when settled, pause in hidden tabs (`useRafLoop`, `usePageVisible`) and off screen (`useInView`).
- Listeners are passive; clean up on unmount; GSAP through `useGSAP`.
- Reduced motion (OS or toggle, `html[data-motion="reduced"]`): no particles, no parallax, no pinning, no tilt, no auto-advance; crossfades only. CSS animations are already cut globally; check `useReducedMotion()` before any JS motion. Content and interaction stay.
- No scroll-jacking. Keep pinned sections short. Lenis smooths native scroll.
- Hover sound: `blip("hover")` on mouse pointerenter only, never on touch.

## Accessibility rules

Lighthouse accessibility 100 is a hard gate. axe runs on every route in e2e.

- One `h1` per page (the page's title). Sections use `h2` with `aria-labelledby`.
- Landmarks: the layout gives `header` (nav) and `main` (the HUD frame is decorative and hidden from assistive tech). Pages add `section`s. No content outside `main`.
- Every control has a name. Icon buttons get `aria-label`; toggles use `aria-pressed`; the visible label must be part of the accessible name.
- Focus: the global outline plus the `FocusStar`. Never remove outlines. Never clip a focusable element.
- Every hover effect has a focus and a tap equivalent. Touch targets at least 44 px.
- Modals (Radix) trap and restore focus. Nothing else traps focus. Duplicated decorative content is `aria-hidden` and `inert`.
- Contrast: body copy in `--text` or `--text-dim`; `--text-faint` only for micro labels; accents only from the themed tokens. Text over images needs a scrim.
- Images: `alt` describes the art ("Layla, official splash art"); decorative backdrops use `alt=""`. Fan art always shows the artist credit and link.
- Motion: respect `useReducedMotion()`; nothing flashes more than three times a second.

## Responsive rules

- Design at 360, 768, 1280, 1920 and 2560, check 320 and 3440, portrait and landscape, and 21:9 and 32:9 (`useViewport().isUltrawide`) and tall phones (`isTall`).
- Breakpoint for the shell is 900 px: above it the HUD lives in the side rails (inside `--gutter`); at 900 and below the HUD becomes a 2 px top progress bar. The nav is the same at every size (menu and sound left, logo centre on 768 px and up, logo right below that).
- Use `shell` (or `px-gutter`) for page content so nothing sits under the HUD rails. Full-bleed art is fine; text is not.
- Use `dvh`/`svh` for full-height blocks, `env(safe-area-inset-*)` at screen edges.
- No horizontal scroll at any size (e2e checks `scrollWidth <= innerWidth`). Long display words: `break-words` and fluid steps.
- Ultrawide: cap text at `--measure` and spread art, not text.

## How to build a page

1. Put the route in `app/<route>/page.tsx` (server component). Export `metadata` (`title` only: the template adds " | The Aspirants"; plus a plain `description`).
2. Put page code in `src/features/<page>/`. Client islands get `"use client"`; heavy scenes load with `next/dynamic` and `ssr: false`.
3. Start with your hero and exactly one `h1`. Use `ThemeZone` for each section's world. Keep text in `shell`.
4. Every public file through `asset()`. Every internal link through `TLink` or `StarButton href`. Content from `src/content` or `public/data`, never invented lore (see `canon-rules.md`).
5. Interactive things: hover, `focus-visible`, active and touch states, sound blips on mouse hover and click, `data-cursor` labels where useful.
6. Check reduced motion (toggle in the HUD) and keyboard only (Tab, Enter, Space, Esc, `N`, `M`).
7. End with one `NextFooter` pointing to the next stop in the chain.
8. Run `pnpm check`, `pnpm build`, `pnpm test:e2e` and `node scripts/qa/scan-text.mjs`. No em dashes, no en dashes, anywhere.

## Additions

Primitives that page engineers added to shared code. One line each.

- `audio.getMusicElement()`, `audio.getMusicAnalyser()`, `audio.pauseMusic()`, `audio.resumeMusic()`, `audio.setMusicVolume(v)` (`lib/audio.ts`, Collection): a music player needs time, seeking, pause and a level. The music analyser is separate from the voice analyser, so voice waveforms never draw the music.

## Navbar and menu

`components/nav/`. The bar is sticky and never hides. Left: the **Menu** plate button (opens the menu) and the **sound button**. Centre: the large vector logo (`AspirantLogo`, 52 px on desktop, 36 px on phones). Right: the current page ("03 Story"). `--nav-h` is 4 rem, 5 rem from 900 px.

**Sound button** (`sound-button.tsx`). Seven bars driven on the GSAP ticker. Sound on: the bars move like a waveform. Off: they ease into a flat line of dots. Hover lifts the wave and speeds it up, a press kicks it and sends a pink ring out, an orange keyline draws round the plate, and the ON / OFF read-out slides. `aria-pressed` means sound is on. The `M` key does the same.

**Menu** (`site-nav.tsx`, Radix Dialog). It covers the whole screen. Opening: an ink sheet sweeps down while the paper wipes in, then the five titles rise out of masks one by one. The titles are big, centred and slanted. Hover or keyboard focus on a title:

- The page colour blooms from the pointer behind the menu (tints in `menu-pairs.ts`).
- An ink plate wipes in behind the title and the text turns white.
- The other titles fade back.
- Two aspirants appear either side of the title, art only, no names. They drift a little with the pointer.

The pairs: Home is Fanny (left) and Layla (right), Experience is Angela and Ruby, Story is Chang'e and Lesley, Characters is Guinevere and Vexana, Collection is Selena and Obsidia. Left art faces right, right art faces left.

**Portrait art** (`scripts/menu/build.py`, output `public/img/menu/<slug>.webp`). The source busts differ in crop and scale, so the script scales each one until the eye-to-chin distance is the same and places the eye at the same height on a fixed canvas. All ten figures end up the same size and both eyes of a pair sit on one line, which is also the centre line of the title. The eye and chin points are measured by hand on the sources and stored in the script. In the source folder `vexana-left.png` is Selena. Rebuild with `python -I scripts/menu/build.py "<source folder>"`.

On narrow or tall screens nothing hovers and the title fills the width, so the pair of the current page stands at the bottom of the menu instead. The art is warmed after the site opens (it is not in the loading bar, because the menu is not first paint).

## Video player

`components/video-player/`. One custom player for the whole site. A `VideoCard` is the thumbnail: a chamfered plate with the poster, a crystal play button and a tag. A video never starts by itself. A click grows the player out of the thumbnail until it fills the page (not the display). The poster then melts into the first frame with a soft diagonal wipe (no snap), and the video plays. Closing does the same backwards: the poster wipes back over the picture, then the player shrinks into the thumbnail.

- **Picture.** The video is as wide as the window and never taller than it (width matched, no zoom). Any space left above and below is black.
- **Cursor.** The system cursor is replaced inside the player. It takes the shape of what a click will do. The middle half of the screen (25 to 75 percent of the width) is a white disc with Play or Pause. The outer quarter on each side is a pink rounded square with Leave, and a click closes the player. Near the timeline the cursor snaps onto the track, becomes a bigger orange diamond with a ring, follows the pointer along the track and shows the time above it; a click there seeks. Over buttons it is a small dot, and while the video buffers an ink disc with bouncing bars. The cursor glides to each position and morphs with a spring. When the controls hide while it plays, the cursor hides with them and comes back when the pointer moves. Touch screens have no cursor: a tap plays or pauses.
- **Controls.** Play and pause, back and forward 10 seconds, volume (the slider slides out on hover), time, quality, captions when there is a track (see Captions). The timeline has a buffered range, drag to scrub and arrow keys. A pulse in the middle confirms play and pause. Keys: Space or K, J and L (10 s), arrows (5 s and volume), M, C, 0 to 9, Home, End, Esc. There is no close button; Esc and the Leave zones close it.
- **Captions.** Captions are drawn by the player, not by the browser, so the viewer can change them like on YouTube (`caption-layer.tsx`, `caption-math.ts`). They start on. The Aa button opens a panel: size (Small, Medium, Large, Huge), background (None, Light, Dark, Solid) and position (arrow buttons and Reset). The captions can also be dragged anywhere on the picture, and moved with the arrow keys when focused. The place is a point as fractions of the picture (not the screen), kept inside the picture, so it stays on the same part of it at any size. The start is the middle of the picture, 80 percent down, with text about 4 percent of the picture's height on a dark plate. While the panel is open a sample line shows so the changes can be seen. The CC button (or the C key) turns them on or off. All of it is remembered in `localStorage` (`aspirants:captions`).
- **Quality.** Auto (the default), then each size the video exists in. Auto picks the smallest size that is sharp enough for the picture as it appears on this screen in device pixels, one step down under 1.5 Mbit/s. Changing size carries on from the same moment.
- **Loading.** A hexagon plate draws itself in the middle while the video buffers or seeks.
- **Sound.** The video's sound is on whenever the site sound is on, and follows the sound button and the M key. Only the volume is remembered. While the player is open nothing else makes a sound: the page's music and any voice line stop, and the music carries on when the player closes.
- **Use.** `<VideoCard video={{ sources: [{ label, height, src }], poster, title, captions? }} duration tag className />`. Colours come from `--card-edge-colour`, `--card-accent-colour` and `--card-play-colour`. Today it is used on Selena's page. The collection cinema still has its own player.

### Sound prompt

`lib/sound-prompt.ts` and `components/sound-prompt.tsx`. When the sound is off and a visitor presses something that is only sound (a voice line, a play button for a track), the site asks "The sound is off" with Turn sound on, Keep it off and Do not ask again, and does what was pressed after a yes. `withSound(name, play)` wraps the action. It is used on the explicit audio controls only (the voice cards, the voice wall, the collection archive and player, the Hear her cards, the character hero play). Hover blips and the page music never ask. "Do not ask again" is remembered in `localStorage` (`aspirants:soundPrompt`).

## Selena's page

`features/character/selena/`. The page is one picture that does not scroll. It has nothing from the other character pages (no profile, voice wall or gallery). The engine under it (the director, the video layers, the frame maths, the touch points, the wait screen and the wipe) is shared with Obsidia's page and lives in `features/character/stage/`: see "The stage engine" at the end of this file.

**The videos** come from the Live2D recordings in `C:/Users/muham/Videos/selena` (3840x1728, 60 fps). `scripts/selena/build.py` cuts and encodes them into `public/video/selena/<tier>/` in three sizes and writes `timeline.generated.ts` (frame numbers, phases and byte sizes). All tiers are H.264, so every browser plays them (H.265 gave no saving here). **None of the videos has sound.** The sound of her page is the music and the voice lines of the About page, which are separate files, so the music never has to step aside for a clip and a video can start at any time without the browser's autoplay rule (the videos are muted).

| Tier | Size               | Total  | For                                                           |
| ---- | ------------------ | ------ | ------------------------------------------------------------- |
| lite | 1280x576 at 30 fps | 40 MB  | devices that decode in software, or are slow, and data saving |
| 1080 | 1920x864           | 76 MB  | phones, tablets, small windows                                |
| 1440 | 2560x1152          | 105 MB | full HD and QHD screens                                       |

The page picks the tier from the display and the device (`pickTier` in `media.ts`): the picture covers the screen, so the video must be as wide as it appears in device pixels (82 percent is enough). Then the device holds it back: the performance level (`lite` is the light tier, `balanced` stops at 1080), touch devices stop at 1440 (1080 with little memory), and data saving and very little memory get the light tier. There is no 4K tier: it was 159 MB and only a device with hardware decoding, 8 cores and 8 GB could use it, so it was dropped to make room for the Gallery. The visitor loads one tier only. If the performance level steps down while she plays, the smaller tier loads in the background and is used from the next video on (the idle loop is swapped under the cover wipe when she idles). The light tier keeps every other frame of the 60 fps timeline, so its loops and seams, which are measured in time, work unchanged.

The cuts, in frames at 60 fps:

| Video     | Cut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome` | Frames 86 to 1034 of `welcome.mkv`. The recording opens on the game's hero-select screen, and the animation starts with a hard cut between 85 and 86. At frame 1034 the animation has settled into the idle pose and the game UI has not started to fade in (it does from about 1036). That frame matches idle frame 1470. The last 6 frames dissolve into idle frames 1465 to 1470, and 3 more idle frames follow.                                                                                                                                                                                                                                |
| `idle`    | Idle frames 1471 to 1956, 486 frames, 8.1 s. That is the shortest true cycle: the pose repeats every 162 frames, but only the 486 frame cycle also repeats the hair and the drifting debris (mse 14 against 50). The loop starts on the frame that follows the welcome cut. The last 20 frames dissolve into the 20 before the start, so the wrap is hidden.                                                                                                                                                                                                                                                                                       |
| Pages     | About, Skills and Gallery are three more poses, each cut in three. `in`: from 36 frames before the action to the frame where she is in the page's pose (`handFrame`, found by matching the clip against the loop) and 24 frames more. After that frame the recording is the loop itself, so the stage hands over there and the rest of the old cut (0.5 s for About, 1.7 s for Skills, 5.3 s for Gallery) is not kept. `loop`: one cycle of the page's own animation, 486 frames for Skills and Gallery and 240 for About, dissolved at the seam. `out`: from the last frame that still matches the loop to about a second after the idle resumes. |
| Shorts    | `short-1`, `short-2` and `short-3`: from 36 frames before the action to about a second after it ends.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Mapping: About is `phone-empty`, Skills is `horizontal`, Gallery is `vertical`. `startPhases` are the idle loop frames an entrance can start at (3, 162 frames apart). `endPhase` is the idle loop frame the idle resumes at. The About recording and `short-1`, `short-2` and `short-3` were made with the pointer elsewhere, so their idle pose differs a little from the idle loop. They dissolve over 420 ms, the others over 140 ms.

**The director** (`director.ts`, no React) puts one video on top at a time. Each hand-over is a dissolve between two pictures that are nearly the same, and the director takes care that nothing old is on show when one starts:

- It seeks to the exact time and waits for the seek, plays, and waits for the frame at that time before it dissolves. A frame left over from the last time the video played does not count (this was the flash of a wrong pose).
- welcome to idle: when the welcome is 6 frames from its end. Idle to entrance (or short): the idle loop reaches a frame the entrance was cut from (3 per cycle, 162 frames apart) and the entrance starts 3 frames early to cover the start delay. Entrance to page loop: when she is in the page's pose (`handFrame` of the entrance). The loop starts at the frame that matches (`loopOffset` gives it: the loop's phase is the entrance frame plus `loopOffset`, plus the frames the start takes), the two play together for the 160 ms of the dissolve, and the page (the drawers and Back) shows at that moment, not when the entrance has finished. Leaving: the page loop reaches the frame its exit was cut at.
- Exit (or short) to idle: the exit is cut to end with a stretch of 60 frames where she is back in her idle pose and the recording matches the idle loop frame for frame. The idle loop starts at the matching phase, both play together, and they dissolve over 560 ms while both move. Before, the exit froze on its last frame while the idle loop dissolved in, which showed as a cut.
- The recordings were made one by one and the camera sits a fraction of a percent closer in some (`scripts/selena/align.py` measures it: 0.5 percent for About and the start of the first short, 0.25 percent for two more). The idle picture eases by that fraction during the dissolve, so its edges do not jump. Without it the pictures differ at the edges and the seam shows.

Frame maths is in `phase.ts`. Everything is covered by unit tests with fake video elements. I measured the real seams by recording the page with a screencast and comparing frame to frame: no hand-over shows a jump, and the largest steps are the clips' own action.

**A press is answered at once.** Choosing a button changes the state in the same call. The chosen button answers with the jump, the stomp and the run (see The buttons), which lasts exactly as long as the wait for her matching frame (the director measures it: frames until the next start phase), and the rest of the panel steps out of the way, staggered. If the clip is still loading, the sheet closes at once and she hops in place. Pressing the button again takes the choice back. If she is still finishing another animation, the choice is kept (`next`) and starts when she is idle. Back is answered the same way: it lights and runs a bar, and the drawers slide away at that moment.

**Back is a button like the others.** Back (`MenuButton`, picture `btn/silverbolt.webp`, badge ESC, word "Heading back") has the same hover, press and run as About, Skills and Gallery. It shows with the page (the drawers), from the moment she is in the pose, and it goes when the exit starts: it only keeps the visitor company while the exit waits for the loop to reach its frame (`leaving`). From then on only the "Heading back" screen is left (`WaitFx`, `wait-fx.tsx`): a vignette, a scan band, streaks, corner brackets, a status chip and a progress rail along the bottom. It lasts until she is in her idle pose (`uiFrame` of the exit, the same moment the main panel comes back), and not until the exit has finished playing. The rail fills for the wait for the frame and then again for the exit up to the pose. The screen shows only while something is going on: choosing a page or a short (until the entrance starts) and the way back (until she is posed). They are compositor only. The press animation of the buttons runs on every performance level.

**A page chosen as she comes back.** The panel returns when she is in her idle pose, a second or more before the hand-over to the idle loop has finished, and a choice made then is kept (`after` in `director.ts`). Its first video is attached at once, so it loads while the exit plays, and the wait the button shows is worked out from the exit (`afterEstimate`): the rest of the hand-over, the dissolve, and the idle loop's wait for the frame the entrance starts on. The bar runs for exactly that. When she is handed back the same wait carries on, and the bar does not start again (it did, after it had filled and held, before). If the video is not loaded yet the button says so, and shows the wait as soon as it is.

**The panel comes back when she does.** After an exit or a short, the panel (trailer, buttons, Next) returns as soon as the action has ended and she is in her idle pose (`uiFrame` in the timeline, 6 frames before the action ends), a second or more before the hand-over to the idle loop finishes. It no longer waits for the dissolve.

**Loading.** Her page and its three pages share one list in `lib/route-preloads.ts`, so the first visit loads everything for all of them and the loading bar shows real progress: the videos of the chosen tier, the small and the full skill clips, the trailer (in the size the player would pick), the music, her 46 voice lines, the pictures of the About page, the Gallery (every thumbnail and picture in full, the two TikToks, the Day of Enders trailer in the size Auto would pick, the two halves of voice line 9), the button pictures and the posters. A first visit waits for all of it (items may take up to two minutes before the site goes on without them). Videos, the music and the trailer are fetched whole into memory (`lib/media-store.ts`: the bytes are counted in a stream and the browser builds the Blob, at most four big downloads run at once, the videos she starts with come first, and the bar is told ten times a second) and **saved in the browser** (Cache Storage, `aspirants-media-v1`), so the next visit reads them from disk and does not download them again. Voice lines and data files are saved the same way (`cachedFetch`). A saved copy of the wrong size is thrown away and fetched again. Change the cache name when a file is replaced under the same address. Saving is best effort: with no Cache Storage, or no room, it all still works from memory. Memory is freed when the page is left, and the saved copies stay. The stage starts only once the videos it starts with (the idle loop and the welcome) are in memory (`loadCore`), so it never streams a file that is loading. The background top-up for a return visit waits until she idles. The curtain also waits for the stage (`expectReady("selena-stage")`), and the welcome starts only after the page transition has finished.

**The buttons** (`menu-button.tsx`). Each of About, Skills and Gallery carries a picture of her (chibi art from `C:/Users/muham/Downloads`, converted to 384 px webp in `public/img/selena/btn/`, in the loading list). The picture is bigger than the plate and rises above it. On hover the plate turns deep violet and slides out, the picture wobbles and then bobs, a light sweeps across, and a gold line grows from the right edge under the name (it is its own element placed from the plate, so it never crosses the letters). A press plays this, timed to the wait:

1. She jumps at the camera: the picture grows to 2.5 times and rises, a ring leaves it.
2. She stomps: she drops, squashes on landing, the plate shakes and a shockwave and two chips spread along the ground.
3. She runs to the right for the rest of the wait, bobbing and leaning. A red sheet with moving stripes and a white and gold edge follows her and covers the plate, the number, the name and the gold line, and says "Loading…" with three moving dots.

A short wait squeezes the jump and the stomp. If the clip is still loading the sheet closes at once and she hops in place. The text is hidden from assistive tech (the button keeps its name, and a status line says "About is getting ready"). Reduced motion: no jump, stomp or hop, only the sheet.

**Touch points** (`hotspots.tsx`). Three faint white circles sit on the picture, and each plays one short: the Silverbolt (its head, bottom left) plays `short-1`, the badge on her chest plays `short-2`, and her right arm (the black-gloved hand, below the centred logo) plays `short-3`. Each circle breathes, sends out a ripple now and then and drifts a few pixels. On hover or focus it opens up and its name shows. Pressed, it pulls in around its dot. Chosen, a burst leaves it and a ring around it fills for the wait (or turns while the clip loads), while the rest of the panel steps away. Pressing it again takes the choice back. The circles follow the picture: the idle animation sways by tens of pixels, so `scripts/selena/track.py` follows each spot through the 486-frame loop and writes where it is every third frame (`hotspots.generated.ts`), and the page places the circles from the idle video's time. The same crop as the picture (`object-fit: cover` with `--focus`) places them on every screen. On a phone, which shows only the middle of the picture, a point outside the screen is held at the nearest edge with an arrow towards where it really is. The cursor (the site's lantern ring) snaps to a circle (`data-snap`) when it is over it, turns the accent colour, shrinks on press, and goes back to following the pointer on leave. `data-state` on the cursor says idle, hover, snap or pressed. Touch devices tap the circles, which are bigger there.

**Speed.** The page has a performance budget and a performance level for each device, and both are in [Performance](performance.md). In short:

- The level (`full`, `balanced`, `lite`, `lib/perf.ts`) is set from the device (hardware video decoding, cores, memory), remembered for five days, can be pinned with `?quality=`, and is lowered by a governor that watches the real frame rate while she plays. It picks the video size and the effects.
- A video is attached only when it is needed and let go when it is done (`detach`), the waiting entrance is drawn at 1 percent so its layer is ready, and the small loop beside the skill list is a separate silent 960 px loop at 60 fps.
- Everything that moves does it on the compositor (`transform`, `opacity`): the touch points follow the picture as Web Animations whose clock is set from the idle video, and a press has no layout in it. Nothing is written to `<html>` per frame.
- The drawers are built ahead of time, a side at a time and the story a few chapters at a time, are not rendered while they are not shown, and are drawn (off screen) in the middle of the entrance. Long blocks use `content-visibility: auto`. The fonts for the Japanese titles are warmed while she idles.
- Nothing blurs or blends over the live picture, and the video itself is unchanged: the same encodes at full size (the sound was removed by stream copy).

**The drawer tabs.** The fold tab sits on the inner edge of each drawer with its long side against the drawer, on both sides.

**The page.** The first visit opens on a black screen. The music starts at once, and the welcome video starts 0.4 seconds after it, under the black. When the video is ready the black fades out over 1.7 seconds and shows a video that is already playing, so a still frame is never on screen (`onBegin` and `welcomeDelayMs` in `director.ts`, `.blackout` in `selena.module.css`). A deep link to one of her pages, reduced motion and a video that cannot play skip the black. The welcome plays once, with a Skip button. Skip covers the whole screen with a slanted wipe (gold, then violet), jumps to the idle loop under it and uncovers. The three shorts are played from touch points on the picture (see Touch points), not from a button. Each short is only a clip, not a page: the panel steps aside while it plays and comes back when it ends. Esc leaves a short early under the same cover wipe. A page opened from the three buttons shows only Back, which plays its exit. Esc backs out one step. The Next button (bottom left, top right on phones) and the N key go to the next character. Reduced motion: no welcome, the idle loop stays on its first frame, pages show their first frame and no video loops. If a video cannot play (no codec) the still image stays and the buttons still work.

**Her addresses.** Her page and each of her pages has its own address: `/character/selena/`, `/character/selena/about/`, `/character/selena/skills/` and `/character/selena/gallery/`. The four share one layout (`app/character/selena/layout.tsx`), which holds the stage, the music and the drawers and stays mounted while the address changes, so no animation is cut. The pages below it only give each address its own title and social card. When a page opens (its entrance starts) its address is pushed with the history API (`use-selena-url.ts`, `withBase` for the deploy base path). Back (or Esc) takes the address back: one step in history if the page was opened here, her own address otherwise. The browser's back and forward buttons ask the stage for the exit or the page. An address that names a page plays that page's entrance on the idle loop and skips the welcome, because the page asked for is the point. The three pages are in the sitemap.

**The music.** `public/audio/music/silverbolt-raiko.m4a` plays and loops from the welcome until the page is left, through the audio engine, so the sound button silences it. It sits at 22 percent and fades in over 5 seconds and out over 3.5. Fades follow an S curve, so they have no audible start or end. Voice lines are lifted (the voice bus is 1.9 times) and the music falls to about a fifth under them, quickly, and comes back slowly after. The player pauses the music with a fade and brings it back with a longer one. The nav shows a record beside the sound button (`components/nav/now-playing.tsx`): a small vinyl with the album art on its label, spinning while the music plays, a tone arm that lowers onto it, the song "Silverbolt Raiko" and the artist "Mobile Legends: Bang Bang". A click pauses or resumes the music, with a fade. If the sound is off, a click turns the sound on and starts the record. The music steps back to a tenth of its level while a clip with its own sound plays, and stops while the video player is open. Any page can show a track with `startMusic` from `lib/now-playing.ts`.

**The look.** The buttons and the trailer card take their look from the picture: white armour plates, violet edges, gold trim, slanted type. The buttons sit in the empty top right of the picture and the trailer in the empty top left. On phones the picture is cropped to her and the three buttons sit side by side along the bottom.

### The About page

`features/character/selena/about/`. Pressing About plays the entrance, then two drawers slide in over the page loop: the profile from the left and the story from the right. She stays visible in the middle (each drawer is 28 percent of the width, 21 to 30 rem). Each drawer scrolls on its own, and a tab on its inner edge folds it away (the tab stays, flush with the screen edge). Back slides them away and plays the exit. On a narrow or tall screen they become one sheet at the bottom with Profile and Story tabs, so the top of the picture stays clear.

**Profile** (`profile-data.ts`), written like a resume: a picture with a Normal and Mecha switch (it changes the picture only, nothing else), name, Japanese name, aspirant title, a short summary, at a glance (age 19, birthday June 18, MBTI ENTP, species, occupation, side job, home, weapon), skills, experience, likes and dislikes, family and ties, projects, her two forms, personality and two voice lines: the normal form speaks line 1 and the Ender form line 19, each with the Japanese words and the English translation. The picture is a round portrait centred above the name, one for each form (`normal.jpg` and `mecha.jpg` from `C:/Users/muham/Downloads`, cropped square and converted by `scripts/selena/about-assets.py`, in `public/img/selena/profile-normal.webp` and `profile-mecha.webp`). The two sit on top of each other and cross-fade when the switch changes.

**Story** (`story-data.ts`), 21 sections from the storm at Hollin Reach to the lamp on the bell tower, in plain English and in time order. It is written from the novel text (each section links to the chapters it comes from) and the official trailers. Nothing is added, and how the duel with Obsidia ends is left open. Names in the text open a tooltip (`{{entity-id|words}}` markup, backed by the glossary in `content/entities.ts`, with a link to the character's page where there is one). A numbered index along the top jumps between sections. There are 15 pictures, each a frame from `selena.webm`, `trailer.webm` or `skin-showcase.webm` taken at the moment the text describes (`about-assets.py` lists the timestamps; a test checks that every picture is used and in the loading bar), and 34 voice lines placed where they fit the scene: quotes, dialogue and inner monologue. A voice card shows the Japanese words, the translation and a play button. One line plays at a time.

If a page video cannot play (no codec), the drawers still open over the still picture, and Back returns to the main panel.

### The Skills page

`features/character/selena/skills/`. Pressing Skills plays the entrance and then opens two drawers over the page loop, built on the same shell as About (`about/drawer-shell.tsx`: slide in from each side, fold tabs, one sheet with two tabs on narrow screens). She stays visible between them.

**Left: the skills** (`skills-data.ts`). The wording is ours and the numbers are from the Mobile Legends: Bang Bang wiki page for Selena. They are game rules, not story, and the page says so. A header with role (Assassin and Mage), specialty (Initiator and Finisher), lane, resource, damage type and the four ratings (durability 4, offense 7, control effects 10, difficulty 8). A switch between Elven Form and Abyssal Form. Each form lists its skills as cards with the icon from `media/others/skills-icon`, the slot, the name and tags. A card opens to the full text, a level table (cooldown, mana, damage, shield, speed and Magic Power bonus by level) and notes. The passive Symbiosis is in both forms. Under the list: how the forms work together (each ultimate resets the other form's skills).

| Form    | Skill 1      | Skill 2       | Ultimate                                |
| ------- | ------------ | ------------- | --------------------------------------- |
| Elven   | Abyssal Trap | Abyssal Arrow | Primal Darkness (to Abyssal)            |
| Abyssal | Soul Eater   | Garotte       | Blessing of the Moon Goddess (to Elven) |

**Right: the demonstration.** The clip of the chosen skill loops quietly at the top and stays there while the list under it scrolls. A button opens the same clip in the custom player, with sound, full page. Under it: the form switch and the skill icons of that form (pressing an icon picks the skill and its clip), then four more clips from the skin showcase (the skin opening, the fight scene from 11 to 16 s, the idle animation, the interactive animation).

**The clips** are cut from `skin-showcase.webm` by `scripts/selena/skills-assets.py`, which also copies the icons and writes `clips.generated.ts`. Only Selena is shown. The showcase has Obsidia's skin too, and its idle and interactive parts are split screen with Obsidia on the left, so those two are cropped to Selena's half (and the label bar is cropped off). The skill times came from reading the skill bar on screen, which lights the skill being cast, and from frame differences to find the cuts. All clips are 1080p H.264 with sound, 29 MB in all, loaded into memory by the loading bar like the rest of the page.

| Clip            | Time in the showcase | Shows                                |
| --------------- | -------------------- | ------------------------------------ |
| trap            | 56.5 to 63.6 s       | Elven Skill 1                        |
| soul-eater      | 63.7 to 67.3 s       | Abyssal Skill 1                      |
| arrow           | 67.4 to 73.9 s       | Elven Skill 2                        |
| garotte         | 73.9 to 76.65 s      | Abyssal Skill 2                      |
| primal-darkness | 76.7 to 79.9 s       | Elven ultimate                       |
| moon-goddess    | 81.6 to 83.45 s      | Abyssal ultimate                     |
| skin-intro      | 5.37 to 11.1 s       | The skin's opening cinematic         |
| skin-fight      | 11.2 to 16.45 s      | The fight scene                      |
| idle            | 84.1 to 101.9 s      | Idle animation, Selena's half        |
| interactive     | 102.0 to 108.4 s     | Interactive animation, Selena's half |

The showcase is edited, so the form changes between some demonstrations are cut and not shown. The passive has nothing to cast, so it shows the skin opening and says why.

### The Gallery page

`features/character/selena/gallery/`. Pressing Gallery plays the entrance and then opens two drawers on the same shell as About and Skills.

**Left: watch and listen** (`gallery-drawers.tsx`). Two trailers in the custom player (`VideoCard`): "The Pawn's Gambit" (her own, 69 s, the same file as the trailer on her main panel) and "Day of Enders" (3 minutes; its thumbnail is the official title card `aspirant.jpg`, and its captions start on and can be restyled and moved, see Captions). Day of Enders has two sizes in the quality menu: 810p (`trailer-day-of-enders-810.mp4`, 1920x810, 50 MB, made from `trailer.webm` by `scripts/selena/gallery-assets.py` at crf 30) and 540p (the collection's `trailer.mp4`). Under them is "Her voice", with a Normal and a Mecha switch. Each line shows the Japanese and the translation, and plays on its own. The mecha lines are 7, 9 (second part), 12, 19, 20, 21, 22, 27, 28, 29, 31, 33, 34, 38 and 46 (15). The normal list is the other 31 lines and the first part of line 9 (32). Line 9 holds two sentences with a pause between them, so its file is cut in two (`09-a.m4a`, `09-b.m4a`) and the first sentence belongs to the normal form and the second to the mecha form (`gallery-data.ts`).

**Right: art.** The official art first (three pieces, credited to Moonton), then the fan art. Each fan piece has the artist's name and a link to the post. jlen_ismyname has four posts under one heading: three single pictures and a carousel of seven pictures that shows the drawing process, shown as a stack with a count. The two TikToks (credited by the name in the file, `@bomboclau_` and `@hashirama1697`) play in the custom player. The pictures are converted by `gallery-assets.py` to a full size (longest edge 2560) and a thumbnail (720 by 960 at most). The HEIC photos from Instagram need `pip install pillow-heif`.

**The viewer** (`components/image-viewer/`). Pressing a picture opens it in a dialog. Zoom: the wheel or a trackpad pinch (around the pointer), two fingers, a double click or double tap, the plus and minus buttons and keys, `0` for the whole picture and `1` for its natural size (up to three times that). Move: drag, or the arrow keys. Change picture: the buttons, the arrow keys, Home and End, a swipe. A strip shows the other pictures of the same post (the carousel), and the card names the piece and links to its source. `i` shows or hides the card, `f` goes full screen (not on phones), Esc closes and focus goes back to the picture. The picture is moved with one `transform` written from the gesture, so only the compositor works while it moves, and the thumbnail shows under the full size until it arrives. The maths is in `image-viewer-math.ts` with unit tests. The older `components/ui/lightbox.tsx` has no zoom and is kept for the other pages.

## The stage engine

`features/character/stage/` runs the picture of a character page. Selena's and Obsidia's pages both use it, and each keeps only what is its own: the recordings and their numbers, the buttons, the music, the drawers.

- `director.ts` (`StageDirector`) is the state machine: welcome, idle loop, queued, intro, page loop, leaving, outro, short, returning. It takes the character's `Timeline` (`timeline.ts`, written into `timeline.generated.ts` by `scripts/<name>/build.py`: frames per second, frames in the idle loop, and for each page and short the clip, its start phases, the pose frame, the loop offset and the hand-back frames). Nothing in it knows a name.
- `phase.ts` is the frame maths. Every function takes the loop length, since the idle loop is 486 frames for Selena and 482 for Obsidia.
- `stage.tsx` (`CharacterStage`) draws the still picture and one `<video>` per piece, and gives each its source from the character's `StageMedia` when it is first needed.
- `media.ts` (`createStageMedia`) picks the size of video for the display and the device, makes the loading items, and loads the first videos. The sizes are named by their width: the smallest is the light one (half the frame rate), `1080` is where a device that has to go easy stops, `1440` is where a touch device stops. A character may have a `2160` tier above them.
- `hotspots.tsx` draws the touch points: circles that follow a tracked path through the idle loop (a Web Animation of `transform`, set from the idle video's clock). `wait-fx.tsx` is the screen that shows while she waits for a frame. `screen-cover.tsx` is the wipe (its colours are props). `use-stage-url.ts` keeps the address in step with the open page, with a character's own `routes`.
- Time skip (`skip` option of the director, `skipRate` in `phase.ts`): while the idle loop or a page loop waits for the frame a hand-over needs, the video runs faster (up to the page's `maxRate`, set per size), ramps up over 450 ms and eases back to normal over the last 90 frames, so the hand-over happens at normal speed. The waits the director reports (`wait.ms`) account for it, `state.fast` says when it runs, and the governor does not judge the frame rate while it does. Reduced motion turns it off. A wait of `minFrames` or less is left alone.
- Theming: the engine has no colours of its own. The wait screen reads `--fx-shade`, `--fx-chip`, `--violet` and `--gold` from the page, and the wipe takes `colors`.
- The frame numbers for Selena are in `scripts/selena/build.py`, those for Obsidia in `scripts/obsidia/build.py`. `stage/timeline.test.ts` checks both.

## Obsidia's page

`features/character/obsidia/`. Built on the stage engine (see above), and different from Selena's page in everything that is not the engine: her own picture, her own buttons, her own drawers, her own colours (dark crimson, rose and gold, taken from the idle recording).

**The videos** come from `C:/Users/muham/Videos/obsidia` (3840x1728, 60 fps). `scripts/obsidia/build.py` cuts them into four sizes (`lite` 1280 at 30 fps, `1080`, `1440` and `2160`, which is the source size, for 4K screens and sharp laptops) and writes `timeline.generated.ts`. `scripts/obsidia/proxy.py` decodes grey 320x144 copies for the analysis, `align.py` measures the camera of each clip, `track.py` tracks the touch points, `about-assets.py` cuts the About pictures. The encoding is tuned for the sharpest picture the budget allows: x264 `-preset slower -tune animation` with `aq-mode=3` and no deblocking offset, more bits for the loops (the idle loop is on screen most of the time) than for the clips (CRF 19 to 22 for the loops, 25 to 26 for the clips), and an explicit level per size. The sizes: lite 41 MB, 1080 99 MB, 1440 138 MB, 2160 269 MB, skill clips 32 MB, trailer 49 MB. A visitor loads one size. Only the welcome and the idle loop are waited for on the loading screen (and the clips of the page the visitor opened by its address); the other page clips, the shorts, the skill clips, the trailer, the voice lines and the pictures are `deferred` in `route-preloads.ts` and load in the background once the page is open (see `PreloadItem.deferred`), so the first load is about a fifth of the total (41 MB of 230 at 1440).

The cuts, in frames at 60 fps (the numbers are in `build.py`):

- `welcome`: frames 226 to 1176 of `welcome.mkv`. The recording opens on the game's hero-select screen and the animation starts with a hard cut between 225 and 226. At 1166 she is in the idle pose, and the game UI starts to fade in at the left edge from about 1182, so the cut ends at 1176, which matches idle frame 672.
- `idle`: the idle animation repeats every 482 frames (8.03 s), frames 673 to 1154 of `idle.mkv`, with the last 20 dissolved into the 20 before.
- Pages: About is `vertical.mkv`, Skills is `horizontal.mkv`, Gallery is `zoom.mkv`. Each is cut into an entrance (36 frames of idle pose, the action, and 24 frames past the pose frame), a loop of one cycle (182 frames for About and Skills, 180 for Gallery) and an exit (from a few frames before it leaves the loop to the end of the stretch where she is back in her idle pose).
- Shorts: `short-1` (her face), `short-2` (her feet), `short-3` (her weapon), each from the idle pose through the action and back.
- Her idle animation has no repeat inside its cycle (Selena's repeats three times), so every page and short has one start phase. This was checked again with the cuts: no shorter period exists in the idle loop (shifted by half a cycle the hair differs clearly, a mean squared error of 2500 where the still background is 33) and none in the page loops, and no other pose is close enough to start a clip from. The wait is therefore up to 8 seconds of her animation, and the time skip (see "The stage engine") runs it at 2 to 2.5 times the speed, so it lasts about 4 seconds at worst and 2 on average. The wait screen shows exactly that long. `short-3` was recorded with the camera 0.6 percent closer and a different render, which the stage eases while it dissolves.

**The look: "The Queen's Endgame".** Her page is built from one idea: she plays the game against the world, and the stage is a board. The eclipse (the black sun of her trailer) rings her portrait, the gold is the kintsugi of her cracked obsidian, and the thorns are the ones that grow from her wings. Type is Instrument Serif italic for names and titles and the site's mono, small and spaced, for labels. Colours: void `#06030a`, ink `#10050e`, velvet `#170813`, wine `#2a0b1d`, blood `#c4123c`, rose `#ff5c8a`, gold `#e8b85a`, deep gold `#a8782a`, pearl `#fbeadf`. Shapes: a blade cut at two corners of every plate, a gold hairline rim, squares of a chessboard as rules and rails, ten diamonds for ratings, Roman numerals for chapters. The art for the drawers (the eclipse, a thorn corner and an obsidian texture) was made with image generation (prompts in `scripts/obsidia/ui-assets.py`, which removes the backgrounds and writes `public/img/obsidia/ui/*.webp`). Nothing glows and nothing is blurred over the picture.

**The panel.** The buttons and the wait screen are Selena's, in her colours: a pearl plate with a gold edge that turns wine on hover (`stage/menu-button`, whose colours and hover nudge are custom properties that the page sets: `--armor`, `--violet` for the edge, `--btn-hover`, `--btn-ink`, `--btn-sheet`, `--nudge`), her sticker on each plate, the number 01, 02, 03, and the same press: the sticker jumps at the camera, stomps, and runs along the plate for exactly the length of the wait behind a blood and rose sheet that says "Loading". Three chibi stickers (`public/img/obsidia/btn/`, made by the owner and fitted by `scripts/obsidia/sticker-assets.py`) are About, Skills and Gallery, and her chain weapon is on Back, like Selena's Silverbolt. They are listed down the empty top left, where Selena's are down the top right. Back and Skip are bottom centre (on a phone the three buttons are along the bottom and the drawer is a sheet above Back). Next (to Selena) is bottom left. The wait screen is Selena's `wait-fx` (the edges darken, a light band, streaks, corner brackets, a chip that says what is happening and a rail that fills for the wait) with her `--fx-shade` and `--fx-chip`. The wipe between pictures (`ui/board-cover.tsx`) is a chessboard of velvet and gold squares that closes and opens. Three circles follow her weapon's head, a spot beside her face and her boot through the idle loop; the lantern cursor snaps to them (`data-snap`). They go at once when a page button is pressed. A short plays to its end: it has no Back button and Esc does nothing during it.

**The wait is only the queue.** The progress bar, the plate's sheet and the wait screen show only while the picture waits for the frame its animation starts on (an entrance, a short, or an exit). When the animation plays there is nothing to wait for, so the bar ends full and goes: Back shows "Heading back" while her page loop runs to the exit's frame and then the exit plays without a bar.

**The drawer** (`drawer/drawer.tsx`, `ObsidiaDrawer`). Like Selena's it floats: it does not touch the left or the bottom edge (a gap on the left, the bar above it and the Back button below it), at most 38 percent of the screen (`min(34rem, 38vw)`). Velvet black over the obsidian texture, a gold rim, a blade cut at two corners and thorns in the other two, serif tabs with a rose diamond on the open one, and a tab on its edge that folds it away. On a narrow or tall screen it is a floating sheet above the Back button, and the small thing in the corner moves to the top right. It is built while she idles (About first, then Skills, then Gallery) and drawn off screen in the middle of the entrance; what is not shown is `content-visibility: hidden`. The corner `dock` holds one small thing that plays. Two options change its shape: `right` adds a second drawer on the right, a mirror of the first (on a narrow screen it becomes one more tab of the sheet), and `size="half"` keeps only the top half of the height, so the picture below it stays in view.

**The About page** (`about/`). Tabs: Details and Story. Details is her profile like a resume. Its top is centred in the drawer: a round picture (`ob.jpg`), her name (Obsidia, アイーダ Aida), her title and a short description. Then age, birthday, MBTI, aspirant title, species, occupation, home and weapon, what she likes and dislikes, family and ties, her two forms, appearance, personality, flaws and three voice lines. (Eyes, voice, skills, experience, projects and fighting were taken out on request.) **Two forms** has a photo and a silent clip for each, each opening in the custom player in her colours. The Ender form is her transformation in the Pawn's Gambit trailer (`trailer.webm`, 154.5 s to 165.3 s, from just after the flash to the cut to Selena's mecha, with the subtitles cropped off). The normal form is cut from her own trailer (`obsidia.webm`, 28.2 s to 44.1 s, from her eye opening to the cut after the red lines, subtitles cropped). `scripts/obsidia/forms-assets.py` cuts them (60 fps, no sound, 4 MB and 8 MB) and the photos. Story is her story told by her, in the first person, in 23 sections that follow the novel (each links to its chapters in the Experience), with tooltips on names and places, 14 stills from the official videos where the context fits, and all 41 of her voice lines, each once, with the Japanese and the English. The trailer ("The Queen's Endgame", 1:20, 60 fps) sits small in the bottom right with its thumbnail (`obthumb.jpg`) and never starts by itself. It opens in the custom player in her colours (`skin` in `PlayerVideo`: ink, keyline, accent), which grows out of the thumbnail and dissolves the poster into the first frame.

**The Skills page** (`skills/`). Two drawers with her between them, like Selena's, narrower (`min(27rem, 25vw)` each) so her hand shows. The left one is "How Obsidia hunts": her overview (role, specialty, lane, damage, resource, title), the four ratings, and the passive and three skills (Return to Bone, Abyssal Bone Needle, Phantom Shadowmeld, Hunt of Bone) each opening to its text, its table by skill level and its notes, then how they work together and her base stats. The numbers are from the Mobile Legends: Bang Bang wiki and are the game's, not the story's. The icons are in `public/img/obsidia/skills/` (the ultimate has a cast icon and a cancel icon). The right one is "Demo", like Selena's: the clip of the chosen skill plays silent (a 60 fps loop), with a pause button and a button that opens the same clip with sound in the custom player in her colours, four icons under it that pick a skill, and "More from the skin showcase" with the clips that are not a skill: in a fight, the skin intro, the skin burst, the idle animation and the interactive animation. Pressing a skill on the left shows its clip on the right. `scripts/obsidia/skills-assets.py` cuts all of them from `skin-showcase.webm`, using only her parts (her cinematics and gameplay from 16.5 to 40 seconds, found by scene detection and by reading the skill bar, and the left half of the split-screen idle and interactive animation, which is hers; Selena is on the right and is cropped away).

**The Gallery page** (`gallery/`). Tabs: Art, Watch and Voice. Its drawer is half the usual height, anchored top left, so her feet and the rest of the picture stay in view. Art shows the official art first (three pieces, credited to Moonton) and then the fan art (seven pieces and one TikTok). Each fan piece names the artist and links to where it was posted (an Instagram account or post, a Reddit post, a TikTok), and the posts whose artist is not named say so. A picture opens in the image viewer (`components/image-viewer/`), in her colours (`skin`: ground, keyline, accent), with zoom, move, swipe, the details card and fullscreen. Watch has her trailer ("The Queen's Endgame", the file of her About page) and "Day of Enders" with its captions (the files of Selena's Gallery, so a visitor who has seen one page has the other). Voice has all 41 lines in six groups (her doctrine, orders to the fleet, at the board, her questions, to those who stand against her, to Selena), each with the Japanese and the translation, and one plays at a time. `scripts/obsidia/gallery-assets.py` converts the art (the Instagram photos are HEIC).

## The roster wall

`/character` (`features/character/roster/`). Drawn from the owner's reference strip, not from a grid: one full-screen row of slanted panels of splash art on a silver and blue world, where each pair has its own layout. The page does not scroll up and down (Lenis is paused and `<html>` is `overflow: hidden`, like her page). The row is a native `overflow-x` box, so touch swipes, Tab, find-in-page and the keyboard keep working; the wheel is turned into sideways easing on top of it, a mouse drags with a throw. The splash art (`/img/char/<slug>/splash.webp`) is the only picture on the page, and the ten of them are in the loading bar for `/character`.

- **The board** (`layout.ts`). Every panel is a parallelogram with the same lean, placed by its four corners on a board 404 units high. One unit is `--u` (the height of the screen divided by 404), so the whole composition scales with the screen. The order is the newest pair first, as asked: Selena and Obsidia, Guinevere and Vexana, Lesley and Chang'e, Ruby and Angela, Layla and Fanny. Each pair is laid out its own way: Guinevere under Vexana, Lesley tall with Chang'e under the next pair, Angela over Ruby, Layla narrow over a tall Fanny. Each panel names the part of its picture to show (a face), so the crops are chosen, not centred.
- **The front pair.** Obsidia and Selena are the biggest panels, with the red plate that carries the logo, "Meet the ten" and a readout (a pink trim along its slant), a jagged red tear between the two with embers rising from it (the reference's red crack), a "Newest pair" tag, and a yellow "Aspirants met" ribbon with ten slots that light in the colour of each Aspirant. Obsidia is always lit.
- **The end.** A blue plate with two lines along its slant leads on to the collection.
- **State.** The pair in the middle of the screen is lit: its blue haze goes, its rims take the Aspirants' colours, the pictures drift slowly and a band of light crosses them, and the Aspirant name, Japanese name and line come in. The tall panels keep their yellow "Open" ribbon all the time, the others show it when lit. Scrolling settles on a pair.
- **Hover** (mouse): the panel lifts, its pair lights, the picture follows the pointer a little and a band of light crosses it. **Nothing plays on hover** (the voice lines were taken out on request). Focus from the keyboard lights the pair too.
- **Click:** the other panels and the HUD step away (about a third of a second) and the page opens through the logo transition.
- **Idle:** the tear flickers, embers rise from it, diamonds drift up the world (full level only), a huge ghost word moves slower than the panels, the met ribbon is crossed by light, and the hint chevrons run until the first move. While scrolling, the pictures lean with the speed of the scroll (full level only).
- **Parallax.** The picture in each panel moves against the scroll. This is the only per-frame work: one `transform` write for each panel near the screen, one for the ghost word and one for the progress line. The panels are memoised, so a scroll does not redraw them.
- **HUD.** Top left: the pair in front. Bottom centre: a rail of five slanted ticks, one for each pair (a click jumps), with a line that fills as you scroll. Bottom right: previous, next, and the way on to the collection (N does the same). "Aspirants met" is kept in the browser (`aspirants:met`): staying on a pair, or hovering a panel, meets it.
- **Phones and tall screens:** the same board, smaller, with the HUD in two rows at the bottom.
- **Performance.** On a fast machine a scroll is a 6 ms frame. The governor (`lib/perf.ts`) runs here too and drops the lean, the drift, the light bands and the sparks on a device that lags. Reduced motion removes the entrance and all of these and makes the wheel move directly.
