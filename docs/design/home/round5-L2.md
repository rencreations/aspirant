# Home round five, L2: list, Selena and the light only plumbing

The owner's fifth message (`docs/superpowers/specs/2026-11-20-home-feedback-5-request.md`): the home page is light only. No section changes from the light ground to a dark one, and no section is dark. This note covers the list, Selena's section and the kernel plumbing. The other sections (wall, rows, strip, bolt, fall, hand) were made light by their own helpers.

## 1. What changed

**List** (`sections/list/`). `bg` and `nav.theme` are `daybreak`. The live backdrop is the same silk, now on `daybreak` with four pastel stops per frame (`palettes.ts`: the frame's own hues lightened toward the paper, a pale tint, the main hue, a deeper hue, a pale edge), `amount` 0.62 (was 0.6 on dark). The dashed chrome of the window is dark ink at 38 percent. The sky of Selena's frame (`SKY` in `selena-frame.ts`, also the panel inside the 4:5 window and the sky at the end of the list) is a pastel dawn: lavender at the top, pale rose at the foot, a white bloom behind her. The viewer (`viewer.ts`, `viewer.module.css`) is a pale plate: 94 percent paper scrim, white picture ground, a light round close button that turns to ink on hover. Its root carries `data-theme="daybreak"` so the cursor and the focus ring follow the light ground (it stands on `<body>`, outside the home's slots). Names and the small title use the theme tokens, so they are ink now without a rule.

**Selena** (`sections/selena/`). `bg` and `nav.theme` are `daybreak`. The drawer is a pale frosted panel (white to a faint lilac, pastel lights inside it, a dark grain at 6 percent, a hairline edge in blue grey and a soft shade 22 px wide where it ends, in a phone sheet on its top edge). The aurora is the same shader on `daybreak` with her colours lightened (`#8fe3ff`, `#b7a4ff`, `#ffa6d6`, `#ffd89a`), `amount` 1, `intensity` 1.8 (was 1.6 on dark), and 22 percent of the pastel sky stays over it as a haze (`SKY_LEFT`, was 6 percent) so the room is never the bare paper. The stars are soft blue violet specks at 60 percent. The four point star is cream with a coral edge and a peach glow. The film's white and the white over the canvas are still the paper itself (`#f4f6f9` with its dots), so the dragon sweeps over a white screen, the screen ends on the paper and the voices open on the same paper: no joint. Nothing in the timeline changed.

**Plumbing** (`kernel/`).

- `types.ts`: `HomeTheme` is `"daybreak"` only (exported, the cursor uses it). `GroundName` is `"daybreak"` or a plain colour `#rrggbb`. A section cannot ask for storm any more (the type refuses it).
- `background.ts`: two layers, the paper and a colour layer (kept for a section that wants a plain light colour, none does now). The storm layer, `STORM_HEX` and the ground cue (`setGroundCue`, `groundNow`, nobody used it after the rows were made light) are gone. The engine calls `groundAt`.
- `home-stage.tsx` and `home.module.css`: the storm ground element and its rule are gone.
- `cursor.ts`: theme type is `HomeTheme`.
- `sections/voices/index.ts`: the `nav.early: 0.3` that turned the bar's ink before the white is gone (nothing turns now). The kernel keeps the `early` field (it is a general mechanism, tested with a fake).
- `sections/strip/index.ts`: two lines, `bg` and `nav.theme` to `daybreak` (the strip helper has since rewritten the file; the values are theirs now).
- `fx/backdrop/palettes.ts`: a note that the home asks for `daybreak` only. The storm palettes stay in the table, unused and harmless (only the home uses this module; `registry.test.ts` still reads both).

The bar, the cursor and the HUD follow `data-theme` of the slot under them, so with every slot on `daybreak` they are light everywhere. Checked on all 16 sections with a real mouse (`cursor.cjs`): cursor, bar and HUD all say `daybreak` in every section.

## 2. Tests I changed on purpose

`kernel/background.test.ts` (rewritten for two layers, 11 tests, run, passing), `kernel/cursor.test.ts` (light theme), `kernel/snap.test.ts` (a plain colour stands for "a different ground"), `kernel/layout.test.ts` (the voices bar test deleted, the `early` test uses a fake light theme), `sections/list/backdrop-plan.test.ts` (palettes are pastel, not "dark to light"). Only `background.test.ts` was run. The others were edited by reading and are for the cleanup pass.

## 3. Looked at (real Chrome, dev server, 1440x900 and 390x844)

- Baseline (dark) and new frames of the list at 0.3, 1.3, 3.5, 5.5, 8.0, 9.8, 10.7 screens, and of Selena at 0.0, 0.3, 0.9, 1.5, 2.0 to 3.6: every frame read. The list is legible and calm on the pastel silk (the names, "Characters", the dashed window, the doll on the edge). Selena, the dragon and the doll read on the light ground: her toon outline is dark ink and reads, the dragon is white with blue and gold and holds on the paper because of its outline. No change to the shared toon was needed.
- The viewer: opened on a frame by a real click, a light plate with the whole picture and a round close button, Escape closes it, no console error.
- Phone: the list (name, window), the Selena drawer as a sheet at the foot with the dark title and the pill, the film frame.
- All 16 joints, a frame 0.3 screens before and after each start (`shots.cjs` with `SPEC=joints`, 32 frames, two sheets): no dark ground, no dark bar and no flash at any joint. The white pause between Selena and the voices (0.3 screens of paper) is the designed rest.
- All 30 backdrop kinds on daybreak at 1440x900 (`kinds.cjs`, one sheet): each has a good light palette. The heavy ones (liquid chrome, dark veil, water) are not asked for by any section.

## 4. Not done, not verified

- The production build, a weak machine, Firefox and Safari, a real touch, the loading bar. Nothing here changes a loading list.
- The `ink-field` kind's own doc (`fx/backdrop/glsl-ink.ts`) still speaks of the storm ground: the strip helper's file.
- Comments that name the storm ground in `actors/hand/material.ts` and `fx/comic-marks/palette.ts` were left (other helpers' areas, harmless).
- The comic marks' palette says the ink carries on daybreak and the fill on storm: not looked at on the bite of the film (flash and spark at the dragon's mouth) frame by frame.
- The list's silk is looked at at rest on every frame only through seven frames of the strip, not on all ten.

## 5. Looking at it

Scripts, outside the repo, in `D:\ren\aspirant-work\home\L2\`: `shots.cjs` (`SPEC="list:0.5,selena:1.2,abs:12.5"` or `SPEC=joints`, `SIZE=390x844`, `TAG`, `OUT`), `viewer.cjs` (opens a frame of the list), `cursor.cjs` (the theme of the cursor, the bar and the HUD in all 16 sections), `pastel.py` (makes the list palettes from the dark ones).
