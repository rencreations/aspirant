# The Comic room, redesigned (13 Nov 2026)

Request: `2026-11-13-comic-room-request.md` (word for word). The owner asked for the whole look to be thought through, so the calls below are mine and each can be reversed. This is a large piece of work, so it is done in phases. Each phase is committed and checked on its own.

## Status

- **Phase 1, done:** every comic is a page of its own, and the reader has the new chrome. See "Phase 1".
- **Phase 2, done (14 Nov 2026):** the first screen (the big animated COMIC), the two full-screen official sections, the fan gallery and the new foot. See "Phase 2".
- **Phase 3, done (14 Nov 2026):** the transitions between the room and a comic. See "Phase 3".

## Intent

A room that feels like opening a comic shop window: a loud, lively first screen, one whole screen for each of the two official comics, then a calm gallery of what fans made. Reading is immersive: nothing sits over the pages unless the reader asks for it.

## Phase 1: the pages and the reader (done)

- **An address for every comic.** `/collection/comic/<slug>/` (`app/collection/comic/[comic]/page.tsx`, one static page each, 23 of them). The slug is written by `scripts/library/comic/build.py` from the title (`the-aspirant`, `guinevere-and-vexana`, `art-class`, ...). The room (`/collection/comic/`) is only the shelf. The pages are real pages, not a window over the room (the owner asked for the comic page to be its own endpoint with its own transitions, which a window cannot have). An old `/collection/comic/?i=<id>&p=<page>` goes to the page. The search sheet opens a comic at its page. Each page is in the sitemap.
- **The reader** (`features/library/comic/reader.tsx`, hosted by `reader-page.tsx`). It is dark, and the top bar is dark with it (the bug: the bar took the colour of the room behind the old overlay; it is now locked, `useNavLock`, to `storm`).
- **The bars show at the very top only.** The top bar and a control bar (the way back, the page, the title and the text switch) are there when the strip is at scroll 0, and the page does not sit under them (a spacer the height of both). The moment the strip moves more than 16 px they fold: the control bar shrinks toward the top left and fades, the top bar does the same (`useNavLock` gains `away`, `.nav[data-away]`), and one small button grows in where the menu button was. They unfold again at the very top (under 4 px, so a small bounce does not flicker them). Transform and opacity only, 560 ms.
- **The button's list** (Radix `Popover`): the title, the way back, the page to go to (type a number and press Enter; it goes to the nearest page the comic has), the text switch (off by default) and, for a fan comic, the takedown link.
- **Removed:** fit width and fit height (the pages always fit the width), the previous and next page arrows (the arrow keys still step), the previous and next comic arrows, and the full size button of the bar (each page still has a small "Full size" chip, shown only while the pointer or the focus is on the page).
- **The end of a comic** has the comic before and after it, each a link with its cover and its name. **A zoom** (60 to 240 percent in steps of 20, `+` and `-` keys) is a small pill in the bottom right corner. A page wider than the screen is panned. The progress is one hairline along the top of the screen.
- **The first page is scroll 0**, so a comic opens with the bars showing. A saved place, or `?p=`, opens the reader on that page with the bars already folded.

### Calls in phase 1

- The zoom pill stays in the corner at all times, small. The owner said the bottom of the page has the comic links and "also" the zoom; a corner pill keeps the zoom reachable without a bar.
- The takedown link of a fan comic is in the list and at the end of the comic, not in the bar.
- Shelf cards are links now (`TLink`), so a middle click opens a comic in a new tab.

## Phase 2: the room (done)

What was asked, and how it was made. (The first sketch said the letters were "SVG shapes with a panel drifting inside". That is how they are: a thick round stroke for each of C, O, M, I, C, masked over a panel of a comic.)

- **First screen.** The word COMIC fills the screen. Each letter is its own SVG shape (a custom lettering made for the site, not a font file), drawn thick with an offset shadow, each filled with a cropped panel of the comics that drifts slowly inside the letter. Idle: the letters float on their own rhythm and a halftone field breathes. Hover: the letter under the pointer squashes and springs, and the panel in it speeds up. Press: an ink burst and stars from the pointer, the letter pops. The pointer moves the layers a little (parallax). Over it: the top bar (bare), the one button back to the shelf (sticky), one small line ("2 official, 21 by fans"), and a cue to scroll (a pill with a chevron that bobs; on hover it leans in; on press it scrolls to the next section with Lenis). Nothing else.
- **One screen for each official comic** (the order: The Aspirant, then Guinevere and Vexana). The design is built from live parts: a card with a thick edge and a second card behind it, panels cut from the pages of the comic (cut by a script into the library, with their own keys) at set angles, a ribbon with the title in the custom lettering, confetti and sparkles, a mascot. Every part moves: idle (a slow drift, a shimmer), hover (the part lifts and the others lean away), press (a small pop, a sound blip). The composition scales with the screen and re-flows for a phone (fewer panels, taller card). Under it, one big button, "Read the comics", in the colours of that section.
- **Guinevere and Vexana** copies the banner the owner attached one to one: orange ribbon "TWIN STARS OF ASPIRATION", the small purple "THE ASPIRANTS COMICS" line, seven panels at the angles of the banner, the chibi pair with the heart bubble, the cat mascot and the confetti. Not the picture itself: every piece is live.
- **The Aspirant** is mine to design: Layla and Fanny, warm (pink red and orange), a split card with the two of them facing each other, panels between them, and the chibi stickers of `media/_all/layla/chibi` and `.../fanny/chibi` (with a transparent ground, checked on the file, not by eye) floating and bobbing. The chibi folders hold few files (Layla 2, Fanny 4), so some are re-used at different sizes.
- **The middle panel** of each composition is the first panel of the comic. It is what the transition (phase 3) zooms into.
- **The fan gallery** under the two: a calm wall (21 covers, grouped by who is in them, a filter by character), each card a link to its page.
- **The foot:** the "next room" link is replaced by a button back to the collection.

### What was made in phase 2

- `room/hero.tsx`: the word, a field of dots and slow speed lines behind it, one line ("2 official comics, 21 made by fans"), a button "Scroll to read" that scrolls to the first comic (Lenis), and the one button back (fixed, on every screen). Under 58 rem the word stands in two rows (COM over IC). Idle, hover and press are in the spec above; a press also sends sparks from the pointer.
- `room/stage.tsx`: the engine of a composition. `room/vg-stage.tsx` copies the banner (ribbon with the coloured S, A, A, T, the subtitle, the card with a yellow edge over a purple one, the seven panels at the banner's angles, the chibi pair with the heart bubble, the cat mascot, the shards, the confetti). `room/as-stage.tsx` is The Aspirant: a cream card with an ink edge and a coral shadow, a black slab for the title and the line under it, seven panels with the first page in the middle, speed lines that turn behind it, a "KA-POW!" starburst, and three chibi stickers of Layla and Fanny floating over the edge.
- `room/official.tsx`: one whole screen, the stage a little above the middle, one big button ("Read the comics": a pill with a hard shadow and a ball with an arrow; coral and ink for The Aspirant, purple and gold for Guinevere and Vexana; it moves up under the pointer and presses in).
- `room/gallery.tsx`: a pinboard, the covers as tilted prints with a strip of tape under the pair they are about (the same `FanCard` as before), the character choice kept in the address.
- `stage.py`: 14 panels cut from the original pages (the boxes were chosen by looking at the pages with a ruler; no word or frame is added) and 8 chibi stickers (a file with no transparent pixel is refused; the ones with a white edge have it baked into the file). Layla's own chibi files are opaque screenshots, so the stickers of Layla are the ones she shares with Fanny.

### Calls in phase 2

- The ribbon words use the site's display face with a stroke and a hard shadow, not a font made from nothing; only the five letters of COMIC are drawn. A full alphabet of custom letters would be a font project of its own.
- Under 58 rem the stage stands taller (4 by 5) and some parts are left out, so a tablet in portrait gets the taller one too.
- Tablets and phones have no pointer, so the depth follows nothing there; the idle drift, the pop and the sparks are the same.
- The nav stays bare over the first three screens. It takes its plate at the fan wall, because the wall would slide under the menu buttons.

## Phase 3: the transitions (done)

- **Official: a dive.** A press on "Read the comics" starts a parallax zoom on the live stage (Web Animations, transform and opacity). One pivot, one camera scale: the first panel is brought to the middle of the screen covering it, every other part is scaled by `k ** exponent(depth)` (the ones in front rush past and fade out between 34 and 78 percent of the dive, the ones behind hang back), the button and its line let go first. The stage is held still when the dive starts (`[data-diving]`: the drift paused, the pointer ignored, the parts snapped to rest), and the first panel is turned upright on the way in, because the drift may have tilted it a little where it stopped. The dive takes 1.5 s.
- **Seamless.** When the panel fills the screen, an opaque layer in the reader's own ground fades in over it (260 ms). It holds the comic's own first page, laid out so that the page's pixels sit exactly under the panel's picture (the panel's cut position on its page is in `comic.json` as `stage.panels[].at`, written by `stage.py`; the arithmetic is `pageAfterZoom`). The route changes under it. When the reader is open, the first page's rect is measured on the reader itself (`[data-comic-scroller] [data-n]`) and the layer's page moves and scales to it (650 to 1250 ms, by the distance), then the layer fades out over an identical picture. The Aspirant's first panel is the top of its first page, so the settle is a short pull back; Guinevere and Vexana's is a cut from the middle of a long first page, so the camera rises up the page to its start. Measured at the end of the dive, the two pictures agree to within a pixel or two.
- **Fan comics: a halftone wipe.** From the press, two grids of round dots (ink, then the loud colour of the cover: its hue, saturation raised) swell until they cover the screen, the page changes, and they shrink away from the middle. About twenty dots across the longer side, one element per dot, transform only.
- **Safety.** The layer claims the transition router, holds the scroll (wheel, touch, keys), and removes itself on any failure; the page then opens the plain way. A modified press (new tab) is left to the browser. The comic's page, its reader and its first pages are warmed when the section is on screen or the card is hovered; if they are not there when the cover is closed, the real percentage is shown over it and the change waits.
- **Left as it was:** the way back from a comic to the room, the previous and next cards at the end of a comic and the search sheet keep the logo curtain.

## Anti-goals

- No reduced or lite version of any of it (the one-version rule).
- Nothing that animates anything but transform and opacity. No blur or filter over a moving picture.
- No font file and no copy of the owner's banner: the letters are shapes, and the pictures are the comics' own pages.
- Nothing that gives the story away on the first screens: the pictures are official art and official comic panels, as in the rest of the library.

## Left to check

Firefox, Safari, a real phone; the Cloudflare cache of `comic.json` after deploy (the data files are not versioned).
