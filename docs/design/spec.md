# The Aspirants: design spec

Status: approved by standing instruction (the owner asked for continuous, unattended work). Open questions and the defaults chosen live in `docs/OPEN-QUESTIONS.md`. Content rules live in `docs/design/canon-rules.md`. Every contributor reads both.

## 1. Purpose

"The Aspirants" is a static, immersive website for **Aspirant**, a story series set in an alternate universe of Mobile Legends: Bang Bang. It explains the series, tells the whole story through scrolling, and archives every piece of media. It must make a visitor feel the story matters and want to follow it to the end.

Success looks like this:

- A visitor who knows nothing understands who the ten Aspirants are, what the Enders want and what the Cycle is, and what the story leaves open.
- The first ten seconds are memorable: a loader that turns into an interactive title.
- Every surface reacts: hover, click, tap, idle, scroll and pointer movement.
- It works from a 320 px phone to a 3440 px ultrawide, in portrait and landscape, with touch, mouse and keyboard.

Audience: fans and newcomers. Tone: warm, personal, direct. See the writing rules below.

## 2. Creative concept

**The site is the Selrick Academy Resonance Terminal.** The visitor is a newcomer logging in to the Archive, and the Archive talks to them.

**The thread: someone is always waiting.** The same image runs through the whole story: Layla's thousand lit windows in Tanner's Row, Chang'e's lamp in the third-floor window, Karina's lantern on the bell tower, the girl in red boots walking home toward a lit window, Guinevere's Emblem that says "I'm here". The site turns it into mechanics:

- The cursor is a **lantern**: a soft light with a lagging ring. Dark text and dark panels are revealed by it.
- Idle states **breathe**: windows flicker, stars twinkle, HUD ticks drift.
- Closing moments of pages say "The lamp is on."

**Two worlds in contrast.** The whole site plays one visual argument:

|         | Daybreak (Academy)                                                   | Storm (Ender)          |
| ------- | -------------------------------------------------------------------- | ---------------------- |
| Surface | white ceramic, pale glass                                            | void black, graphite   |
| Light   | cyan resonance, gold daybreak                                        | amber, violet, crimson |
| Shape   | hexagon (the Defence Sphere), four-pointed star (the Emblem of Hope) | shards, rifts, nets    |
| Motion  | springy, warm                                                        | slow, heavy, glitching |

Sections flip between the two, and a pointer can tear a portal from one to the other (see Home).

**Mecha HUD, Arknights: Endfield and Honkai Impact 3rd as the reference.** Panels have chamfered corners, corner brackets, tick marks, mono micro-labels, hex grids, scan bands, parts-list captions ("UNIT 07 / TWILIGHT STAR"), live readouts (coupling score, resonance, local time in Terrinia). The HUD never hides content: it frames it.

**Frames.** Images never sit in plain rectangles. A shared set of custom frame shapes (clip-path and SVG masks): chamfered panel, hexagon, four-pointed star notch, arch, parallelogram, torn rift edge, circle with bite, ticket stub. Each frame tilts toward the pointer and has a hover state.

## 3. Information architecture

| Route               | Job                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                 | Loader, interactive title, Home: portal-face hero, what Aspirant is, versus stage, roster, hall of fame (fanart), doors to the rest, "next" footer   |
| `/experience`       | The story, told by scrolling. Narrator, pinned scenes, the whole of `short-v2.md` as a web novel with hover cards                                    |
| `/story`            | The world explained: places, the Cycle, the Enders hierarchy, before and after contrast, coupling lab, time-order timeline, open questions, glossary |
| `/character`        | Roster of the ten                                                                                                                                    |
| `/character/[slug]` | One page per Aspirant (10 static pages). Footer shows the next in queue                                                                              |
| `/collection`       | Archive of films, music, comics, art, fan art, voice lines                                                                                           |

Character order (the queue, looping): fanny, layla, ruby, angela, lesley, change, guinevere, vexana, obsidia, selena. Slugs: `fanny`, `layla`, `ruby`, `angela`, `lesley`, `change`, `guinevere`, `vexana`, `obsidia`, `selena`. (The `characters.md` roster order.)

Global elements on every page: HUD frame, the sticky nav (menu button, sound button, large logo, current page), the full-screen menu with the aspirant pairs, lantern cursor, scroll "coupling" meter, footer with the next destination. See `design-system.md`, "Navbar and menu".

## 4. Page design

### 4.1 Loader and page transition (reference: lusion.co)

Both are drawn by one component, the **logo curtain** (`components/curtain/`). The logo is a vector (`components/logo/`, traced from the bitmap by `scripts/logo/build.py`). Its twelve letters are cut out of the plate, so they are windows: with the white fill removed, the page shows through them.

- **First load.** A light screen. The logo is centred and large and idles in a loop: the letters ripple in a wave, a band of light sweeps across them, a spark runs round the outline, the mascot bobs, blinks and twitches its antennae. Below it a loading bar reports real work (fonts, lazy code chunks, the images and data the landing page needs, from `lib/route-preloads.ts`) with a label for what is still loading. A few hairlines and corner brackets echo the plate. When loading is done there is nothing to click: the white drains from the letters, then the logo zooms into a letter until the page fills the screen.
- **Page transition.** Click a link and the logo zooms out of the page you are leaving (its letters show that page), the route changes, then the logo zooms in again through a letter onto the new page. If the new page is not ready 500 ms after the click, the letters fill white and a quieter loading state shows (the letters flicker like a scanner, the mascot looks around, a short label and a scanning line). Pages can hold the reveal with `expectReady` (`lib/page-ready.ts`).
- Reduced motion: no logo movement. A short light fade for transitions and for the first load.
- Audio starts on the first touch, click or key press anywhere.

### 4.2 Home (references: landonorris.com, kprverse.com)

1. **Portal hero.** A full-viewport WebGL scene. A character cutout is lifted into pseudo-3D with a depth map. The camera follows the pointer so the face turns in space. Moving the pointer across the face opens a circular **portal** with a warped, glowing rim that reveals the other form underneath. The portal radius follows pointer speed and relaxes when idle. Pairs, cycled by a control: Vexana (Aspirant / Ender form), Selena and Obsidia, Guinevere and Vexana. On touch: drag opens the portal; device tilt is optional. Reduced motion: static art, tap to toggle forms.
2. **What is Aspirant.** Scroll-scrubbed manifesto: words light up as you scroll, as if lit by a lamp. Plain, warm copy: the series, the ten Aspirants, Selrick Academy, aspirant power ("a heart that holds on to one thing").
3. **Versus stage** (Off Track / On Track). Two halves split by a diagonal rift. Left: Daybreak (blue). Right: Storm (crimson). Hovering or focusing a side widens it and plays its voice line. Three pairings behind a pinned scroll: Selena and Obsidia (good and evil, blue and red), Vexana and Vexana (Aspirant and Ender form), Layla and Fanny (rivalry).
4. **Before and after strip.** Two lines, one struck through: "A peaceful world." and "A world that was weighed." Interaction: hover or tap flips them. Links to the full contrast in `/story`.
5. **The ten.** A horizontal, draggable rail of ten custom frames. Hover tilts and plays a voice line. Link to each page.
6. **Hall of fame.** Fan art in varied frames, floating with parallax. Click opens a lightbox with artist credit and link. Always credit.
7. **Two doors.** Experience and Collection as big portals.
8. **Next footer.** "Next: Experience". Keep scrolling and a ring fills, then the page transitions. Also a visible button and the `N` key.

### 4.3 Experience (references: santionispirits.com, oryzo.ai, 2019.makemepulse.com)

The story told by scrolling. It works like Santioni: you scroll, the narrator continues, scenes change behind the words, and you understand the story without reading anything else.

- **Structure:** 12 Parts (Part One to Part Twelve) from `short-v2.md`, in the book's order (it is deliberately not in time order; flashbacks announce themselves). 60 chapters and 3 interludes.
- **The whole text is here.** Every paragraph of `short-v2.md` is present, typeset as a web novel. Parts load lazily as you approach them. Chapter navigation (a 60-tick timeline) and "resume where you left off".
- **Pinned scene layer.** A fixed full-bleed 3D or art layer sits behind the text. It changes as chapters pass, each with its own palette, particle behaviour and sound bed. The camera follows the pointer.
- **Narrator rhythm.** The active paragraph is lit; the others dim. Key lines are set large and reveal word by word (the narrator's voice). Dialogue is lighter and offset.
- **Hover cards.** Names, places and terms are underlined with a dotted line. Hover, focus or tap shows a card: portrait, Aspirant name, one line, link. The glossary comes from `src/content/entities.ts`. No invented lore in cards.
- **Set pieces** (3D or canvas, interactive, one per key beat; at least these):
  - Ch 1: the gantry at dawn with a thousand windows. Click windows to light them.
  - Ch 10: the two Emblem stars. Drag them together and they hum one note.
  - Ch 12 and 18: the sky breaks; the Base falls to white silence.
  - Ch 21: Gantry Square, aspirant energy as threads of light.
  - Ch 24 and 25: the Orb breaks; the Matrix web; the first Ender wakes.
  - Ch 33: Oro's artificial sun versus the real one (contrast).
  - Ch 47 and 48: the corridor and the void.
  - Ch 57: twin streams of light.
  - Ch 60: 117 lighthouses; click each to hear its note.
- **Sound.** One ambient bed per Part and character voice lines at marked beats, from the supplied audio. Off until the visitor enters; toggle always visible.
- **No scroll-jacking.** Native scroll with Lenis smoothing. Pinned sections are short. Reduced motion: simple fades, no pinning.

### 4.4 Story (reference: why.zero.university)

The world explained, in contrast and diagrams. Sections:

1. **Where you are.** Dawnbreak, Terrinia, Selrick Academy, the Defence Sphere. A places index of hex cards (Gantry, Tanner's Row, Crown Heights, Harbour Front, Bell Tower, Underhill, Valemont, Hollin Reach, Dorado). No invented map geography.
2. **Before and after.** The zero.university move. "Dawnbreak, 978: a peaceful world" with lanterns on the water, then the line is crossed out: "That was before." Same for Oro: "The Planet of Gold" then "The Cleansing of Oro". Scroll-driven strike, colour drain, rebuild.
3. **The Cycle.** An interactive loop: a world grows, a catastrophe comes, embers are spared, survivors rebuild. Click each stage.
4. **The hierarchy.** Layered diagram: the Will (the mind), the Mother Matrix (the body), Obsidia (the awakened commander), Enders by kind, the Core (a device). Click to expand.
5. **Aspirant power lab.** Drag two crystals together to raise coupling. Real scores from the story: 1.62 (Guinevere and Vexana), 2.1 (Layla and Fanny). The Emblem lights when they sync.
6. **The story in time order.** A horizontal timeline from the back matter of `short-v2.md`. Each stop links to its chapter in `/experience`.
7. **What the story leaves open.** Three sealed cards (Matrix invasion, the Core, Selena and Obsidia). Hover or tap to unseal; they never resolve.
8. **Words to know** (searchable glossary) and **who's who**.

### 4.5 Characters

`/character`: the roster wall, after the owner's reference strip. One full-screen row of slanted panels of splash art (the only pictures on it), each pair laid out its own way, the newest pair first and big on a crimson plate with a red tear, a blue plate at the end. It scrolls sideways (wheel, drag, swipe, arrow keys, the rail). The pair in the middle is lit. Hover lifts a panel and lights its pair, and plays nothing. A click closes the others and opens the character. See "The roster wall" in `design-system.md`.

`/character/[slug]`:

- Hero: splash art with parallax; cutout floats over it; huge name, Aspirant name, Japanese name.
- HUD stat block: age, birthday, MBTI, role, weapon, partner (values from `CANON-NOTES.md`, "Not specified" where unknown).
- Sections from `characters.md`: personality, appearance, fighting style, motivation, flaws, relationships. Spoiler-light.
- **Voice wall:** every voice line, playable, with the Japanese audio's title, the English translation and a live waveform. Keyboard and touch work.
- Media: art, relevant fan art and videos.
- "In the story": chapter links into `/experience`.
- **Next footer** (reference: landonorris.com footer): next character in queue, large; scrolling past the end fills a loading ring and transitions into their page. Visible button and the `N` key for access.

### 4.6 Collection

An archive terminal. Filters: Films, Music, Comics, Art, Fan art, Voice. Items sit in varied frames. Behaviours:

- Films open in a cinema modal (poster-first loading, captions where `.srt` exists, keyboard control).
- Music in a persistent mini player.
- Comics open a vertical reader (the two comics are webtoon strips). Page-by-page descriptions are not shown.
- Fan art in the hall-of-fame style with credits.
- Voice archive: all lines, search by character or text.
- The live-action video is a **non-canon parody**; if included, it carries a clear badge. See OPEN-QUESTIONS.

## 5. Interaction catalogue (every thing is interactive)

- Pointer lantern, magnetic buttons, tilting frames, text that scatters and re-forms on hover, links with directional underline, idle breathing, ember background that the pointer pushes.
- Touch parity for each pointer effect (tap, drag, long press). Keyboard parity (focus ring is a star; Enter and Space work; `N` next; `M` mute).
- Background: a shared canvas of drifting embers (Daybreak: cyan and gold motes; Storm: amber and violet shards) that reacts to the pointer and scroll velocity.
- Sound design: small synthesised blips for hover, click and transitions (Web Audio, no files), plus real audio for voice and music. Muted until entry; mute persists.

## 6. Technology

- Next.js 16, App Router, `output: "export"`, `trailingSlash: true`. React 19. TypeScript.
- Tailwind v4 tokens plus hand-written CSS modules for the HUD and frames. shadcn components only where useful (tooltip, dialog).
- Three.js via React Three Fiber and drei; postprocessing for bloom and distortion. GSAP and ScrollTrigger; Lenis; Motion for UI. Zustand for global state (audio, cursor, entry state).
- Fonts: self-hosted through `@fontsource` packages (no network at build). Display: Big Shoulders Display. Narration: Instrument Serif. HUD labels: JetBrains Mono. Body: Hanken Grotesk. Japanese text uses the system CJK fallback.
- **Base path.** The repo is a GitHub project page, so production is served under `/aspirant`. Every URL that is not a Next route (video, audio, image, JSON, GLB, texture) MUST go through the `asset()` helper in `src/lib/asset.ts`, which prefixes `NEXT_PUBLIC_BASE_PATH`. Never hardcode `/media/...`.
- Dev runs on `http://localhost:3000` with no base path.
- Heavy scenes load with `next/dynamic` (`ssr: false`), pause when off screen, cap device pixel ratio at 1.75, and drop particle counts on small screens and `prefers-reduced-motion`.
- All story and character content lives in typed local data under `src/content` and `public/data`. No network calls at runtime.

### Repository layout

```
apps/web/src/app/                  routes
apps/web/src/components/           shared UI (hud, frames, cursor, audio, transitions, text)
apps/web/src/features/<name>/      per-page code (home, experience, story, character, collection, loader)
apps/web/src/content/              typed content (characters, entities, collection manifest)
apps/web/src/lib/                  asset(), math, hooks, stores
apps/web/public/{img,video,audio,models,data}/   processed assets (committed)
scripts/assets/                    asset pipeline (ffmpeg, sharp)
scripts/content/                   markdown to JSON builders
docs/                              specs, canon rules, open questions
```

Originals (`D:\ren\aspirant`) are never copied into the repo. The pipeline reads them and writes optimised outputs.

## 7. Asset pipeline and budgets

- Limits: every committed file under 40 MB; whole `public/` under about 450 MB; no Git LFS.
- Images: WebP (and AVIF where it helps), responsive widths. Splash art 2048 wide, thumbs 640. Comic strips 1000 to 1200 wide.
- Video: H.264 MP4 only (plays everywhere), 540p to 720p, capped bitrate, `faststart`. Wide trailers are scaled down from 2560. A poster frame for each.
- Audio: AAC `.m4a`, mono, about 32 kbps for voice lines; music about 96 kbps. ASCII file names.
- Depth maps for Home portal pairs: generate with a depth model in a throwaway venv if it can be done quickly; otherwise a hand-built alpha-and-luminance pseudo-depth. Do not spend hours on it.
- Excluded: the live-action parody (unless badged, see OPEN-QUESTIONS), both `_backup*` folders, `audio/source`, the two multi-hour livestream recordings.
- A manifest (`public/data/manifest.json`) lists every processed asset with type, character, source and credit.

## 8. Accessibility, performance, devices

- WCAG 2.2 AA. Semantic landmarks, one `h1` per page, skip link, visible focus (star ring), correct names for icon buttons.
- Every hover effect has tap and keyboard equivalents. No focus traps. Modals trap and restore focus correctly.
- `prefers-reduced-motion`: no particles, no pinning, no parallax; crossfades only. A visible "Reduce motion" toggle also exists.
- Contrast: body text on dark at least 7:1; HUD micro-labels at least 4.5:1.
- Responsive: designed at 360, 768, 1280, 1920 and 2560 widths and checked in portrait and landscape; wide aspect ratios (21:9, 32:9) and tall (9:19.5) get their own composition rules. Use `dvh` units. Safe-area insets respected.
- Budgets: Lighthouse accessibility 100 (CI hard gate); performance best effort. First load JS per route under about 250 KB excluding lazy 3D chunks.
- Touch targets at least 44 px.

## 9. Writing rules

- Formal English, written like to a friend but business. Short sentences. Concise.
- Warm and personal toward the visitor: "you", "we", "your". Never gushing.
- **No em-dashes anywhere**, including in quoted story text (rewrite with a comma, colon or period). No en-dash ranges. No AI-sounding filler ("delve", "tapestry", "journey", "in a world where", "unleash").
- Story text is canon: keep it intact apart from the dash fix. Our own copy, tooltips and captions may not add lore.

## 10. Deploy and workflow

- Static export, GitHub Actions to GitHub Pages (`.github/workflows/pages.yml`). The workflow defaults `BASE_PATH` to `/aspirant` and asks `configure-pages` to enable Pages.
- Conventional commits. No AI or tool named as author or co-author in commits, PRs, docs or file headers.
- Commit and push to `main` at each milestone. The first push proves the deploy path with a thin slice (loader, Home skeleton, one character page).
- `pnpm check` must pass before each push where feasible (format, typecheck, lint, tests, knip).
- Playwright covers each route at phone, tablet and desktop sizes, axe accessibility, and a text scan of the export for em-dashes and banned words.
- `pnpm dev` is left running on port 3000.

## 11. Build phases

0. Spec, canon rules, scaffold cleanup, deploy path.
1. In parallel: asset pipeline; content data; design system and shell.
2. Thin slice: loader, Home skeleton, one character page, pushed and verified live.
3. In parallel: Home, Experience, Story, Characters, Collection.
4. QA across viewports, accessibility, canon scan, performance. Fix. Final push.
