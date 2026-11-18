# Home page: the logo wave morph (recon digest, logo-wave-morph)

Scope: how the big hero logo can morph, with a wave, into the nav bar logo and stay there. Read-only recon. Everything below marked VERIFIED was measured or run on this machine (production site on :3000, Chrome via Playwright, a throwaway three.js prototype on :3199, now stopped). The prototype lives outside the repo:
`C:\Users\muham\AppData\Local\Temp\claude\ebb19c894ab4059a\fd0c2cef-a780-4648-9a84-d597a6e52568\scratchpad\recon\logo-wave-morph\` (`proto\proto.html` is the shader, `frames\` the captured frames, `reel\` frames of the Vexana film, `logo-big.png` the logo rendered flat and with windows).

## 0. Decision in one paragraph

Build the hero logo as a WebGL object: one flat, finely subdivided quad (192 x 56 segments, 11,001 vertices, 21,504 triangles) textured with the logo rasterised from the existing vector paths (`LOGO` in `components/logo/logo-data.generated.ts`) by `Path2D` on a 2D canvas. A vertex shader moves each vertex from the hero rect to the nav rect with the **Vexana reel's corner-stagger weights generalised per vertex** (top right leads, bottom left trails, plus the reel's lateral bump and turn) and adds a **travelling sine wave** whose amplitude is an envelope peaking mid-morph. The progress is the scroll (scrubbed, reversible). The last frames sample a second texture rastered at the bar's exact pixel size, so the canvas logo equals the DOM nav logo, and a 120 to 160 ms opacity crossfade hands over to the real `AspirantLogo` in the bar. The prototype of this ran and looks right (see section 4). It lives naturally in the one hero canvas with the splash images and the drones (section 6).

## 1. How Vexana "02 - The Film" morphs (read, run, captured)

Files, all in `apps/web/src/features/character/vexana/reel/`: `reel.tsx` (markup, `Reel`), `reel-controller.ts` (1492 lines, the brain), `reel-math.ts` (easing, `pinOffset`, `stepSpring`), `reel-line.ts` (the purple ribbon), `reel.module.css`, `reel-copy.ts` (`chapter: {number:"02", label:"The film"}`). `reel.tsx` line 128 says "a port of the lab website's reel, without its WebGL layer"; the controller comment at line 1080 says the weights are "the same as the WebGL plane's vertices", so the origin was a WebGL plane and this is its DOM version.

**It is NOT a sine wave and not a shader.** It is a DOM `matrix3d` on one element (`[data-reel=visual]`), written every frame by `renderPicture()` (`reel-controller.ts:1045-1132`) from the scroll. The "wave" feel comes from four corners moving on staggered timelines (a cloth being pulled into place), a lateral bump and a rotation that swings through zero. Frames I captured show a parallelogram / trapezoid that leans, tilts one way then the other and settles, with the violet ribbon stroke looping behind it (the ribbon, `reel-line.ts`, is a separate SVG path drawn by `stroke-dasharray`, which adds much of the "wave" read).

Driver (all from `window.scrollY`, ticked by `gsap.ticker`, Lenis scrolls the native window so `scrollY` is right):

- `sync()` lines 421-467: `p = thumbDoc - (vh - thumbH)/2` (thumbnail centred on screen), `g = frameDoc + frameH/2 - marginTop/2`; `w = fit(scrollY, p, g, 0, 1)` is the morph progress (linear in scroll). At 1440x900 measured: section top 7339 (it moves, remeasure), thumb 580.8 x 326.7 at x 72, frame 1296 x 648 at x 72 (2:1), so the morph spans about `secTop+225` to `secTop+996`, 771 px = 0.86 vh.
- `from` = thumbnail rect (held at screen centre once it gets there), `to` = frame rect plus the pin offset `pinOffset(e, vh)` (the film lags the page, eases in over 0.75 vh, holds 0.5 vh, eases out, velocity 1 to 0 to 1).
- Snap: `snap()` lines 918-956, after input stops it keeps scrolling the last direction at up to 1 vh/s ramped over 1 s and stops exactly on an end (fine pointers only, off on mobile). Generic version for the home page: `useScrollSnap(id, getRange, { idleMs })` in `seams/snap.ts` (default idleMs 1500, CLAUDE.md wants one second so pass `idleMs: 1000`; `snapSeconds` default 0.9).

The exact formula (`reel-controller.ts:1081-1100`):

```
corner(cx, cy)   // cx, cy in {0,1}: TL (0,1) TR (1,1) BR (1,0) BL (0,0); cy = 1 is the top
  weight = 1 - (pow(cx*cx, .75) + pow(cy, 1.5)) / 2      // TR 0, TL .5, BR .5, BL 1
  v      = smoothstep(weight*0.3, 0.7 + weight*0.3, w)   // TR v from w 0.00..0.70, TL/BR 0.15..0.85, BL 0.30..1.00
  x,y,cw,ch = mix(from, to, v)                           // position and size of the interpolated rect
  bump   = cw * 0.1 * sin(PI*v)^2                        // lateral lean, 0 at the ends, 10% of width at v = .5
  angle  = -(smoothstep(0,1,v) - v)                      // radians
  b = (cx*cw - to.w/2, (1-cy)*ch - to.h/2)               // corner relative to a pivot at to.w/2, to.h/2
  out = (b.x*cos - b.y*sin + to.w/2 + x + bump - to.x,  b.x*sin + b.y*cos + to.h/2 + y - to.y)
transform = quadMatrix(W, H, TL, TR, BR, BL)             // projective quad (lines 176-213), a matrix3d
clip-path = inset(0 round r/sx px / r/sy px)             // radius compensated for the stretch
```

Tabulated (computed): angle(v) in degrees for v = 0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1 is 0, 4.13, 5.50, 4.81, 2.75, 0, -2.75, -4.81, -5.50, -4.13, 0; bump as % of current width is 0, .95, 3.45, 6.55, 9.05, 10, 9.05, 6.55, 3.45, .95, 0. Violet wash `tint` fades `(1 - smoothstep(.05,.92,w)) * .62`. Captured matrix at mid morph: `matrix3d(0.683872, 0.037169, 0, -6.3e-05, -0.087159, 0.764151, 0, 0.000447, ...)`, bounding box 1027 x 455 at x 72 growing to 1296 x 648.

Rules check: the reel animates `transform` (fine) **and rewrites `clip-path` every frame plus toggles `display`** on the tint, so it bends the letter of "transform and opacity only" for its rounded corner. Our logo needs no clip, and in a canvas the DOM rule does not apply. Other morphs in the repo are not waves: `features/about/film-geometry.ts` / `opening/geometry.ts` (`placementOf`, a translate, uniform scale and a tilt of at most a few degrees on one element), `features/story/morph/morph-math.ts` (nested translate-only clips), `features/library/comic/zoom/` (dive and dot wipe). `vexana/seams/liquid-math.ts` is a join, not a morph. So the reel is the only reference and its recipe is the corner stagger above.

## 2. The logo (exact data)

Code: `apps/web/src/components/logo/`: `aspirant-logo.tsx` (`AspirantLogo({className, variant: "static"|"interactive", decorative})`, svg `viewBox="0 0 3018 897"`, `role="img" aria-label="The Aspirants"`), `logo-art.tsx` (`LogoLayers`, `LOGO_COLORS` is a non-exported const), `logo-geometry.ts` (`LOGO_W=3018`, `LOGO_H=897`, `PIVOT={x:1455,y:565,r:52.4}`, `layoutFor`, `cameraAt`, `outsideRectPath`), `logo-motion.ts` (`queryLogoParts`, `ambientLoop`, `idleLoop`, `waitingLoop`, `hoverIn`, `hoverOut`, `clickPop`), `logo-data.generated.ts` (99,607 bytes, `LOGO`, written by `scripts/logo/build.py`, which traces the bitmap with potrace at 0.5 scale; never edit).

`LOGO` keys: `viewBox [0,0,3018,897]`, `outline` (21,868 chars, 21 subpaths), `silhouette` (2,224 chars, 1 subpath), `plate` (26,541, 25 subpaths), `holes`, `bevel` (4,025, 13 subpaths), `letters` (12 items `{i, d}`: T H E A S P I R A N T S), `mascot {disc, ring, pods[2], antL, antR, accent}`, `mascotGeo {eyes:[1775,267,1904,344], cx:1840.5, cy:306, r:95, antLPivot:[1751,217], antRPivot:[1930,217]}`, `zoom {x:1455, y:565, r:52.4}`. Path commands are only absolute `M L C Z` (easy to parse or feed to `Path2D`).

**The artwork does not fill the viewBox** (gotcha for every rect calculation). Measured bounding boxes in logo units (Bezier sampled):

- outline / silhouette: x 136 to 2844.21, y 94.02 to 768.85 so **art box = 2708.21 x 674.83**, aspect 4.013 (viewBox aspect is 3.364). Margins: left 136, right 173.8, top 94, bottom 128.
- plate x 136.3 to 2844.21, y 93.91 to 768.93. holes x 219 to 2759.8, y 163 to 700. bevel x 314 to 2649, y 165 to 698.
- letters (x0..x1, y0..y1): T 219..563 / 410..699.5; H 335..921 / 410..700; E 540..847 / 164..474; A 756..1065 / 164..385; S 784..1202 / 410..699; P 975..1280 / 163..385; I 1080..1312 / 411..699; R 1188..1767 / 411..699; A2 1535..1820 / 412..597; N 1778..2198 / 412..697.5; T2 2163..2495 / 410..699; S2 2255..2760 / 411..699.3.
- mascot disc 1755..1926 / 212..401; ring 1728..1952 / 183..358; pods 1734..1804 / 367..446 and 1877..1946 / 367..446; antL 1685..1758 / 141..229; antR 1922..1996 / 138..225; accent (grey triangle) 1563..1635 / 410..513. Whole mascot about x 1685..1996, y 138..446.

Colours, identical in daybreak and storm (`LOGO_COLORS`): outline `#f2b04c`, plate `#0b0b0e`, mascot pink `#ff2e90`, accent `#6f6f6f`, bevel `#8d8d8d`, letters `#ffffff`. Layer order bottom to top: outline, plate, accent, (energy stroke, shine), mascot (head group: antL, antR, ring, pods, disc, lid rect scaleY 0 to 1), letters group (white letters, bevel, shine clipped to letters). I rendered it (`logo-big.png`): a slanted display wordmark "THE ASPIRANTS" on a black plate with an orange keyline, white letters, and the pink X-eyed helmet mascot sitting above the "RA" of ASPIRANTS.

**Windows**: `outline` and `plate` are traced from `opaque & ~holes`, so they have the 12 letters (plus bevel bits) cut out as holes. The letters are a separate group on top. In `components/curtain/logo-curtain.tsx` `render()` the group `[data-part=letters]` gets `style.opacity = f` (0 = windows, whatever is behind shows through the holes); `bgRef` paints `outsideRectPath()` (a viewport rect joined to `LOGO.silhouette`, even-odd) in `--c-bg #f4f6f9` so only the logo silhouette is clear; `cameraTransform()` zooms about `PIVOT` (inside the letter N, widest point) with `kEnd = max(k0*2, halfDiag*1.06/PIVOT.r)` until one letter window fills the screen. I verified the holes: leaving the letters out of an SVG over a gradient shows the gradient through every letter. The home hero logo keeps white letters ("like in the navbar"), so windows are optional (section 5).

**Nav logo, live DOM (VERIFIED, `getBoundingClientRect` on `[data-logo-host] svg`, production build)**

- Markup: `components/nav/site-nav.tsx:~177`, `<TLink href={routes.home} className={styles.brand} aria-label="The Aspirants, home" data-logo-host><AspirantLogo variant="interactive" className={styles.logo} decorative /></TLink>` in the middle column of `.inner` (grid `1fr auto 1fr`). `.logo` is `display:block; width:auto; height:2.25rem; overflow:visible`, and `3.25rem` from `min-width:56.3125em`. Header `.nav` is `position:fixed; inset:0 0 auto 0; z-index:var(--z-nav)=50; height:var(--nav-h)` (4rem below the breakpoint, 5rem, 80 px, above it).
- 1440x900 and 1024x768 and 1920x1080: svg box 174.953 x 52 at y 14, x 632.516 (1440), 424.516 (1024), 872.516 (1920). Scale `k = 0.057970 px per unit`. **Art rect: x 640.40, y 19.45, w 156.99, h 39.12, centre (718.90, 39.01)** at 1440 (add 240 to x at 1920). The art centre sits 1.1 px left of the viewport centre because the art is off-centre in the viewBox (art centre x 1490.1 vs 1509 box centre).
- 390x844 (phone): svg box 121.109 x 36 at x 251.11, y 14 (`.brand {justify-self:end}` under 48em, so right aligned), k 0.040129, art rect x 256.57 y 17.77 w 108.68 h 27.08, centre (310.91, 31.31). Nav height 64 px. The home page has to take its end rect from a live measurement, not constants.
- Page background daybreak `rgb(244,246,249)` = `#f4f6f9`, `data-theme` on `<html>` is `daybreak`.
- Hover and click on the nav logo run `hoverIn/clickPop` (letters hop, antennae, head, `audio.blip("star")`), `ambientLoop` blinks every few seconds.

Nav states that matter: `barShown = lock.theme ? !lock.bare : scrolled` (`site-nav.tsx`), the plate is `.nav::before` (88% bg, blur 10px) and fades in after `scrollY > 12`. `lib/nav-lock.ts` `useNavLock` store has `{theme, bare, fade, away}`. **There is no way to hide just the nav logo today**: add one (a `logo` flag in the store, `data-logo="off"` on the header, `.nav[data-logo="off"] .brand{opacity:0;pointer-events:none}`), because the owner wants the bar empty until the hero logo lands. Use `useNavLock.setState({theme:"daybreak", bare:true})` on the home page so no plate ever sits over the travelling logo (as `/about` does); otherwise the canvas logo would pass under a 12% translucent blurred plate.

## 3. Options and the pick

A. **Textured, subdivided plane in WebGL (PICK, prototyped).** Rules: canvas, so DOM rules do not apply; no filter on DOM. Sharp if rastered at the real on-screen size. Supports real waves, perspective, chromatic split, hover ripples, drones grabbing corners, sag while carried, all through one `warp()` in the vertex shader. Costs: a 2D raster of the paths at mount (about 10 to 30 ms), 2 textures.
B. **Tessellated vector mesh.** Triangulating `LOGO.*` paths with earcut then splitting long edges (three's `TessellateModifier`) is exact at any scale (MSAA edges) and would show real holes for windows. VERIFIED feasibility with `THREE.ShapeUtils.triangulateShape` (three r186): triangle area / even-odd area is 1.0000 for outline, silhouette, letters, bevel, mascot disc and ring; the `plate` is 1.0274 (its subpaths touch or overlap, so it needs a visual check). Triangle counts before subdividing: outline 4,616, plate 5,567, letters 4,072, silhouette 458; after splitting edges to at most 48 units: plate 25,807, to 24: 69,170, to 12: 197,256 (outline at 24: 60,030; letters 30,617). Higher risk, no visible gain over A at 4096 texture width; keep as the fallback if 4K softness is ever reported.
C. **DOM only (no WebGL fallback and a no-risk base).** Put the big `AspirantLogo` in a wrapper and write the reel's four-corner `matrix3d` with `quadMatrix` (copy it out of `reel-controller.ts:176`, it is not exported) using the reel's exact `corner()` formula. Obeys transform only, but a 4-corner projective warp gives a leaning trapezoid, not a ripple. Strip variant: N copies of the svg clipped to vertical bands each translated by a sine of its index: transform only and genuinely wavy, but N full path rasters (the logo is about 100 KB of path data), so keep N at or below 16.
D. SVG path morph (SMIL, per-frame attribute writes): rejected, per-frame SVG attribute writes are banned in CLAUDE.md and the shapes do not correspond.

## 4. The shader (VERIFIED in `proto\proto.html`, Chrome headless, WebGL2, three r186)

Geometry: `PlaneGeometry(REG.w, REG.h, 192, 56)` with `REG` = art box padded 24 units each side = x 112, y 70, w 2756.21, h 722.83. Positions are rewritten to **logo units relative to the art centre, y down** (`x = px + (regCx - artCx)`, `y = -py + (regCy - artCy)`, art centre (1490.107, 431.43)); keep the plane's own `uv` (v = 1 at the top) with `CanvasTexture.flipY = true`.

Texture A (hero LOD): 2D canvas of width `texW = min(4096, ceil(heroArtW * dpr * 1.25 * (REG.w / ART.w)))`, height `round(REG.h * texW / REG.w)`; `g.scale(s,s); g.translate(-REG.x, -REG.y)`; then `g.fill(new Path2D(d), "evenodd")` in the `LogoLayers` order and colours. At 1440 wide: 1283 x 336 px at dpr 1, 2565 x 673 at dpr 2 (about 7 MB with mips). Settings that matter: `colorSpace = NoColorSpace` (see below), `generateMipmaps = true`, `LinearMipmapLinearFilter`, `anisotropy = 8`, `premultiplyAlpha = true`.

Material: `ShaderMaterial`, `transparent`, `depthTest:false`, `depthWrite:false`, `CustomBlending` with `blendSrc = OneFactor`, `blendDst = OneMinusSrcAlphaFactor` (premultiplied), `renderer.setClearColor(0, 0)`. **VERIFIED: a ShaderMaterial's output is not colour converted by the renderer** (identical pixels with `outputColorSpace` Linear or sRGB), so the logo shader works inside the drone scene that uses `SRGBColorSpace` as long as the textures are `NoColorSpace` and no `colorspace_fragment` chunk is included.

Vertex (pixel space, y down; camera irrelevant, clip position is computed directly; use `uVp = vec2(innerWidth, innerHeight)` instead of baked numbers):

```glsl
uniform float uP, uPhase, uWaveOn, uAmp, uCycles;   // progress 0..1, wave phase, 0/1, 0.36, 1.15
uniform vec2  uFromC, uToC, uArt, uSnap, uVp;       // art centres in css px, art size in units, end snap, viewport
uniform float uFromK, uToK;                         // css px per logo unit at the hero and at the bar
varying vec2 vUv; varying vec3 vPos; varying float vSlope, vEnv;
float sstep(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
void main(){
  vUv = uv;
  vec2 l = position.xy;                                   // logo units from the art centre
  vec2 a = clamp(l/uArt + .5, 0., 1.);                    // 0..1 across the art, (0,0) top left
  float wgt = 1. - (pow(a.x,1.5) + pow(1.-a.y,1.5)) * .5; // the reel's corner weights, per vertex
  float v = sstep(wgt*.3, .7 + wgt*.3, uP);               // top right leads, bottom left trails
  float k = mix(uFromK, uToK, v);
  vec2  c = mix(uFromC, uToC, v);
  float ang = -(sstep(0.,1.,v) - v);                      // the reel's turn, +-5.5 degrees
  vec2 off = k*l; off = vec2(off.x*cos(ang)-off.y*sin(ang), off.x*sin(ang)+off.y*cos(ang));
  float bump = k*uArt.x * .1 * pow(sin(3.14159265*v), 2.); // the reel's lean, 10% of width
  vec2 p = c + off + vec2(bump, 0.);
  float env  = pow(max(0., sin(3.14159265*clamp(uP,0.,1.))), 1.5) * uWaveOn;   // 0 at both ends
  float prof = .35 + .65*(1.-a.x);                         // the trailing end whips more
  float ph   = 6.2831853*(uCycles*a.x - uPhase);           // uPhase = P * 2.2 (a crest travels 2.2 wavelengths)
  float H    = k*uArt.y;                                   // current logo height: the wave shrinks with the logo
  float dy = uAmp*env*H*prof*sin(ph), dx = .2*uAmp*env*H*prof*cos(ph);
  p += vec2(dx, dy);
  p += uSnap * sstep(.9, 1., uP);                          // lands on a whole device pixel (section 5)
  vSlope = cos(ph)*prof*env; vEnv = env; vPos = vec3(p, .6*dy);
  gl_Position = vec4(p.x/uVp.x*2.-1., 1.-p.y/uVp.y*2., 0., 1.);
}
```

Fragment (chromatic split along the wave slope, faint fold shading, nav LOD blend):

```glsl
uniform sampler2D uTex, uTexNav; uniform float uCA, uNavMix; uniform vec2 uTexel, uUvScale;
void main(){
  vec2 o = vec2(uCA * vSlope * 6.0 * uTexel.x, 0.);       // uCA 0.8; uTexel = 1/texW
  vec4 cr = texture2D(uTex, vUv + o), cg = texture2D(uTex, vUv), cb = texture2D(uTex, vUv - o);
  vec4 c = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));     // premultiplied, stays valid
  vec4 cn = texture2D(uTexNav, vec2(vUv.x*uUvScale.x, 1. - (1.-vUv.y)*uUvScale.y));
  c = mix(c, cn, uNavMix);                                         // 0 until the scale nears the bar, 1 at the end
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  c.rgb *= 1. + .16 * vEnv * (-n.y);
  gl_FragColor = c;
}
```

Hero rect used in the test: art width `min(0.70*vw, 0.42*vh*4.013)`, centre (vw/2, 0.47*vh). Wave parameters that looked right: `uAmp 0.36`, `uCycles 1.15`, `run 2.2` (phase = P*2.2). I started at amp 0.55, cycles 1.35, run 2.6 and it twisted too far (near vertical at P .5 to .6); 0.36 keeps the words readable. Frames (`frames-sheet2.png`, P = .12 to .92) show: a gentle ribbon first, the right end lifting and leading while the left end trails, a crest running left to right, the whole logo shrinking up and the wave dying out; the DPR 2 frame at P .38 (`frames\p-038.png`) is sharp, with a thin red/blue fringe on the crests only.

Per frame cost: 11k vertices, 3 texture taps, one draw: negligible. Render on demand (only while P changes, the pointer ripples or an intro plays) and set `mesh.visible = false` once handed off.

## 5. Hand-off: canvas logo to DOM logo (measured)

Order of events at the end of the morph (scroll up reverses it): P reaches 1 so wave amplitude is 0 (`env` is zero at P = 1 and the turn and bump are zero), rect equals the nav art rect, the plane samples the nav LOD texture, then the bar's logo appears and the canvas logo hides.

1. Read the target live: `const r = document.querySelector("[data-logo-host] svg").getBoundingClientRect(); k = r.width / 3018; artRect = {x: r.left + 136*k, y: r.top + 94.017*k, w: 2708.213*k, h: 674.833*k}`. Do it on resize and when fonts or layout move the bar (`ResizeObserver` on the header). Do not use constants (the box is right aligned on phones, 44 px min-height brand).
2. Texture B (nav LOD): rasterise the same paths at the bar's pixel scale (`k * dpr` px per unit, about 0.116 at dpr 2, so the region is about 320 x 84 px), no mips, `LinearFilter`, and blend `uNavMix = smoothstep(.55, .95, (kFrom - k) / (kFrom - kTo))`. Both textures are the same artwork in the same geometry, so the blend is invisible. This is needed: texture A minified 6.4x to 8.5x by mip filtering is soft.
3. Measured (VERIFIED, 1440 wide, crop 200 x 64 around the logo, GL final frame against the DOM svg at the same rect): with texture A only the mean absolute difference is 6.9 of 255 and 6.9% of pixels differ by more than 48 (edges, all of it AA and mip softness, no shape differences). With texture B and the quad on a whole device pixel at dpr 2 the best-alignment error is **0.46 of 255** after a one device pixel shift to the right: the DOM ink sits about 0.9 device px right of what plain math predicts (svg left 632.516 css). Chrome pixel-snaps the svg box and I could not reproduce its rule exactly: at dpr 1 the DOM art spans x 21 to 177 in the crop and the canvas 21 to 176, and the best mean error stayed near 4.2. So: do not promise pixel identity from math. Calibrate with a probe (render the DOM logo and the canvas logo, shift by cross correlation, as I did with `shift.py` in the scratchpad) and add the measured offset, and in any case **crossfade 120 to 160 ms** (canvas logo opacity 1 to 0, nav logo opacity 0 to 1) while amplitude is 0 and nothing is moving: a one pixel edge difference cannot be seen then.
4. The swap itself: write the nav logo's opacity by touching that one element's style (or a `data-logo` attribute through the store) in the same rAF as the last canvas draw. Never write a CSS custom property or style on `<html>`/`<body>` per frame (CLAUDE.md).
5. Reverse: when the visitor scrolls back up and P drops below 1, hide the nav logo at once and start drawing the canvas logo at the same rect (same crossfade). Reload part way down: P is 1, show only the nav logo, never build the hero logo.
6. Mascot: the head blinks and the antennae sway (`ambientLoop`, pivots in `LOGO.mascotGeo`). If it is baked into texture A (as in the prototype) it is static during the morph. Better: draw the mascot as 3 or 4 small textured quads (head disc+ring+pods, antL, antR, lid rect) in the same `warp()`, animated in logo space before the warp; the bob is -4 (ambient) to -9 units (idle), antennae +-6 to 14 degrees about their pivots, lid scaleY 0 to 1 from y 267. Then the base texture is rastered without those parts.
7. Windows, if wanted (for example a hero beat where the page shows through the letters): raster the letters and bevel into a separate texture/mesh sharing `warp()`, rastering the plate and outline with letter holes (they already have them), and drive the letter layer with `uFill` (1 white, 0 windows). The pivot for a zoom into a window is `PIVOT {1455, 565, r 52.4}`.

## 6. Where the logo sits in the hero stack

One persistent, fixed, full viewport canvas ("home stage") owns the splash image planes, the logo, and the drones; do not make a canvas per layer (the repo's budget is at most three WebGL contexts on a page, `features/about` keeps to it; the about drone scene is `features/about/drone/drone-scene.ts`, `new WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:"high-performance"})`, `renderer.autoClear=false`, `PIXEL_BUDGET = 8e6`, `pixelRatio = min(dpr, 2, sqrt(8e6/(w*h)))`, copy that rule).

- Draw order back to front: (0) floating splash images (premotio style: RGB split plus cursor wave), (1) the logo planes (base, mascot parts, optional letters layer), (2) the Guinevere drones and the normal drone, (3) comic effects (bubbles, "!" marks) or DOM. Set `renderOrder` per object with `depthTest:false` on the logo and images (painter's order), keep depth only inside a drone model. The images that move down before the morph must not cross the logo: make them pass behind it (they are below in the order) along side paths, and the logo stays the highlight.
- Camera: pixel units, `OrthographicCamera(0, vw, 0, vh)` as `drone-scene` does for its flat layer, or a perspective camera calibrated so z = 0 maps 1:1 to css pixels (`dist = (vh/2)/tan(fov/2)`); the logo shader writes clip space itself, so it stays correct either way. Keep the logo at z = 0 and let drones and the carry/pull effects use z.
- DOM around it: canvas `position:fixed; inset:0; pointer-events:none`, low page z-index (the about page uses `LAYER = {text:1, drone:2, film:3}` in `features/about/layout.ts`), below the nav (`--z-nav` 50). Tokens in `styles/tokens.css`: nav 50, consent 60, menu 70, popover 75, modal 80, transition 90, cursor 95, gate 100. With a bare nav the canvas logo needs no z above 50. Interaction goes through DOM hit areas on top (like the about page's round button that follows the drone).
- SEO and first paint: the server HTML carries `<h1>` with the logo for the home page (the plain `AspirantLogo` svg with `role="img" aria-label="The Aspirants"` inside the h1, or a visually hidden h1 text); `AspirantLogo` is a client component but renders its svg on the server. Hide it visually once the canvas logo is drawing (opacity 0, not `display:none`, keep it in the accessibility tree), and show it as the real logo whenever WebGL fails (a failure fallback, not a version; the DOM path C above handles its morph). Call `expectReady("home-logo")` (`lib/page-ready.ts`) until the first canvas draw, and add the three/home-stage chunk, the model and the textures to the route list in `lib/route-preloads.ts` as `PreloadItem`s (the logo needs no file: both rasters are made from `LOGO` in JS, do them during loading).

Hero sizing (art box, not viewBox; "about 70% of the screen" read as width): `artW = min(0.70*vw, 0.42*vh*4.013)` on wide screens, `0.86*vw` under 700 px (the curtain uses `vw*0.62` or `0.86` and `vh*0.34*3.364` of the viewBox, `layoutFor` in `logo-geometry.ts`). 1440x900: 1008 x 251 (28% of the height), scale 0.3722, 6.4x the bar's 157 px. 1920x1080: 1344 x 335, 8.6x. 390x844: 335 x 83, 3.1x the bar's 108.7 px. Hero centre about `(vw/2, 0.47 vh)`.

## 7. Driving and tuning

- Progress: `P = clamp((scrollY - S0) / (S1 - S0), 0, 1)` with the span about 0.9 screens (`MORPH_SCREENS = 0.9` in `features/about/layout.ts`, the reel's span is 0.86 vh) and `S0` after the images have started down (the owner: the images move first, so `S0` about 0.2 vh). Scrub linearly like the reel: all easing is inside the per vertex `smoothstep`, so scrolling back plays the same frames in reverse (nothing time based may decide the shape).
- The living part: add `uVel` (low-passed `|dP/dt|`) and let a small time term `0.6*t` add to `uPhase` scaled by `env * min(1, uVel*k)` so a stopped scroll holds a calm shape and a fast scroll whips. After the visitor stops, snap to the nearer end after one second idle (`useScrollSnap("home-logo", getRange, {idleMs:1000})`, `seams/snap.ts`), and release a scroll lock only when the logo is at rest.
- Hover on the hero logo (the owner wants it interactive): `uPointer` (logo units) and `uRip` spring; add a radial ripple `r = distance(l, uPointer)`, `dy += uRip * 38 * exp(-r/320) * sin(r/46 - 9*t)` before the morph weights; this is the same cursor wave idea as the premotio images.
- Carried by the two Guinevere drones: pass two grab points (logo units) and strengths to the same `warp()` (`p += pull*(grab - l)*exp(-dist/s)`), a sag term `y += sag * (1 - (2*a.x - 1)^2)` and a swing rotation before the morph; the 70% "pull to grow" is then `uFromK` animating from small to full while the grab corners lead (TR and BL, the same two corners the reel leads and trails with).
- Resize: recompute `from`, `to`, `uVp`, both rasters (only if dpr or hero width changed enough: more than 10%), and call `renderer.setSize(..., false)`.
- Gotchas found: (1) `PlaneGeometry` is y up, flip to y down and keep `uv`; (2) the art is off centre in the box, always use the art centre (1490.107, 431.43 units) and art size (2708.213 x 674.833); (3) transparent padding of at least 24 units around the art in the texture, or mip bleed shows a rim; (4) clear colour must be alpha 0 and the material premultiplied, otherwise the page colour shows as a fringe; (5) `texture.premultiplyAlpha` with `flipY` both true; (6) `PlaneGeometry` with 192 x 56 is enough for the 1.15 cycle wave (a vertex every 14 units); drop to 128 x 40 if the drones add load; (7) the reel's per corner `v` uses the corner's own weight, the per vertex version in the shader makes a curved sheet instead of a straight quad, which is the point; (8) CA with premultiplied alpha stays valid only if alpha is the max of the three taps, as written; (9) never `?quality` or a lite variant: a no-WebGL visit gets the DOM logo with the reel's matrix3d morph (option C), which is a failure path, not a version.

## 8. Files to touch (for the implementer)

- New: `features/home/hero/logo-morph/` with `logo-raster.ts` (Path2D to canvas, hero LOD and nav LOD, colours exported from one place: export `LOGO_COLORS` from `components/logo/logo-art.tsx`), `logo-mesh.ts` (geometry, uniforms, ShaderMaterial), `logo-warp.glsl.ts` (the chunk above, importable by drone and image shaders), `logo-math.ts` (pure: hero rect, nav rect from a DOMRect, `progressAt(scrollY, vh)`, weights, a CPU copy of the vertex math for tests: unit test that `warp(P=0)` equals the hero rect, `warp(P=1)` equals the nav rect to 0.01 px, and wave is 0 at both ends).
- Edit: `lib/nav-lock.ts` and `components/nav/site-nav.tsx` and `nav.module.css` (logo hide flag, `data-logo`), `lib/route-preloads.ts` (the `/` list), `scripts/qa/probes/` new probe `home-logo.cjs` (frames at P steps plus the DOM/canvas diff).
- Never edit `logo-data.generated.ts`.
- Test for the hand-off: the probe in section 5, dpr 1 and 2, 1440 and 1920 and 390.
