# Vexana's character page: design

Date: 2026-10-24. Source: the owner's brief (pasted into the session) and the notes below.

## Intent

Each character gets a page of her own. Vexana's is a long scroll, one design per section, built on the
motion language of landonorris.com (hero, scroll hand-over, signature, On Track and Off Track, cover-up)
with original sections between. The brief says "Obsidia" once at the start. Every file and name in it is
Vexana's, and the current Vexana page is the generic template, so this replaces the generic Vexana page.
Obsidia's and Selena's pages are not touched.

## Goals

- The hero, the hand-over to the signature, the signature, the On Track and Off Track pair and the cover-up
  behave like the reference (cursor reveal, 3D tilt, idle reveals, shrink and colour change on scroll).
- Everything else is original and specific to Vexana.
- Real work in the loading bar, big media deferred and prioritised, 60 fps on an ordinary laptop, lighter on a weak one.

## Non-goals and anti-goals

- Do not copy OFF+BRAND's minified code, shaders or assets, and do not copy the lab website's repo wholesale.
  Re-implement the behaviour, in this repo's style. The owner's own lab repo (MGM-Laboratory/mgm-website,
  `apps/web/src/components/reel/`) may be read and ported: it is theirs, and they asked for it 1:1.
- No MLBB lore. The wiki is a reference for the names and kinds of skills only. Canon is `docs/design/canon-rules.md`
  and `apps/web/src/content/characters/vexana.ts`.
- No Lando Norris branding, copy, store, sponsors or header. The site's own navbar and menu stay.
- Never fake progress. No timers that pretend to load.

## Page order (top to bottom)

1. **Opening** (`opening/`). Light page with a switchable animated background. Vexana, normal form, large and
   cut out. Her Ender form shows through where the cursor is, and by itself at random in several shapes. The
   figure tilts in 3D with the cursor, with an overlay so it is not flat. Scroll: the frame shrinks into a
   card, the colours go dark, then the signature: a short portrait video card (`splash-short`), the Japanese
   name サナ written stroke by stroke like a signature, and a message from Vexana around it.
2. **About** (`about/`). Original. English name, Japanese name (romaji), about, voice lines, facts. No long story.
3. **Reel** (`reel/`). A small video that grows into the large one with animation around it (port of the lab repo's
   reel section), playing `final`. Uses the site's player (`VideoCard`, `PlayerOverlay`).
4. **Skills** (`skills/`). Original and creative. Passive and three skills (the third with its cancel), with the
   icons. Skin showcase with `skin-showcase`, cropped to Vexana only and fitted into the layout.
5. **Faces** (`faces/`). The On Track and Off Track pair: normal on the left ("Human"), Ender on the right
   ("Ender"), face to face, entrance animations, a button each to a story page.
6. **Story pages** (`story/`, routes `/character/vexana/story/academic/` and `/ender/`; the first route keeps its old slug, its label is "Human"). Human: from her birth
   to the taking. Ender: from there on. Told in a creative way, different for each.
7. **Cover** (`cover/`). A section that slides over the previous one (not a normal scroll), revealing `final2`, which
   plays muted by itself, with a play button that opens the full player with sound.
8. **Comics** (`comics/`). Asks: watch or read. Watch plays `comic-jp`. Read is a web comic reader of the panels.
9. **Life** (`life/`). Vexana's daily life (`live-vexana`, `sleeping`), then all the other videos.
10. **Art** (`art/`). The five illustrations as a showcase with a viewer.

Then the site's NextFooter to the next character.

## Music

`vexana-theme.m4a` (from `C:\Users\muham\Downloads\vexana.m4a`) is the page's music through `startMusic`
(`lib/now-playing.ts`), started once the page is open. The site's sound button mutes it; there is no other
control for it ("be able to turn off music only").

## Palette and type

Character palette from `content/characters/vexana.ts`: primary `#7A4FD6`, secondary `#E040A0`, glow `#D9D5F5`,
ink `#140E26`. Daybreak off-white for the opening, ink for the dark sections. Fonts already installed: Big Shoulders
Display (the heavy condensed capitals of the reference), Instrument Serif (its serif), Hanken Grotesk (text).
Where the reference uses lime, Vexana uses violet and magenta.

## Constraints (the repo's rules)

- `CLAUDE.md` is the law: first paint in `lib/route-preloads.ts`, videos deferred with priorities, no per-frame
  writes to `<html>` or `<body>`, animate `transform` and `opacity` only, no `filter` or `mix-blend-mode` over live
  video, effects gated on the perf level (`lib/perf.ts`), reduced motion respected, `content-visibility: auto` for
  long lists.
- Smooth scrolling is the site's Lenis plus GSAP ScrollTrigger (`components/smooth-scroll.tsx`). Use `useLenis`.
- Writing: short sentences, no em or en dashes, Terrinia, Selrick, Storm Citadel, "Aspirant power". Run
  `node scripts/qa/scan-text.mjs`.
- The videos are muted and never start by themselves, with one exception requested by the owner: `final2` (in the
  cover) and the hero and signature short play muted by themselves. Update `CLAUDE.md` and `docs/design/design-system.md`.
- Videos: the files in `/video/vexana/` are made by `scripts/vexana/build.py`. Size budget: under 500 MB for all.

## Owner decisions

All of the above. Left to the builder: the background set, the exact reveal shapes, the story's telling, the skills layout.
