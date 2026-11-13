# The Design room, redesigned (13 Nov 2026)

Request: `2026-11-13-design-room-request.md` (word for word). How it works now: `docs/design/collection-rooms.md`, "Design". The owner asked for the whole look to be thought through ("think of everything"), so the calls below are mine. Each can be reversed.

## Intent

A first screen that feels simple and modern and carries the design team's own film. A join to the wall that is smooth in motion and in colour. A bar that is easy to use. Posts that have their own addresses. A room that holds designs, not videos. No detail a visitor does not need on the first screen.

## Goals

- The film loops behind the title and the top bar is bare over it.
- The wall rises over the film. The bar docks under the top bar and the top bar takes its plate with a fade.
- Filters are a search and a few choices. A choice closes on a press outside, on Escape and on choosing.
- Every post is at `/collection/design/<slug>/`, not a state of the page.
- The six listed reels are out of Design. If a copy is already in Video, Others or Fanart, the Design copy is simply dropped.
- The first screen has one figure ("N contents") and one button, back to the shelf.

## Non-goals and anti-goals

- No lite or reduced version of the film or the join (the one-version rule). A phone gets the same film cut smaller.
- Nothing that moves other than transform and opacity. No blur or filter over the film.
- No scroll cue of any kind inside the join.
- No change to the wall itself ("the gallery is already okay").
- No second source of truth for the six reels: Video, Others must not change.

## Approaches

**Where a post lives.** (a) A separate page per post, with the curtain on every move. (b) A window over the room with its own address, as the Lore codex already does. (c) Keep `?i=` and add pages that redirect. I took (b): the wall keeps its scroll, filters and loaded pictures, Back closes the window, and a link works from a cold start. The cost is that the static page of a post draws nothing visible (only a hidden article for readers without scripts and for search engines).

**The join.** (a) The page slides over a pinned film, as the story landing does, with a bar resting at the foot. (b) The film fades to the page colour with a gradient. (c) A scene that plays and jumps. I took (a): it is the site's own pattern, needs no timer, and the bar at the foot of the first screen is the cue to scroll, so no scroll indicator is needed. The film dims and comes closer and the title lifts away as the page rises.

**The dropdowns.** (a) Write a list by hand. (b) Radix `Popover`, which the project already ships (`radix-ui`). I took (b) for focus return, Escape, collision and one-open-at-a-time. The one thing it does not do is stop the click that follows an outside press, so the room does that itself.

**The six reels.** (a) Delete them and let Video, Others lose them on the next build. (b) Keep them in Design's build and write them elsewhere. I took (b): `design/build.py` still builds them exactly as before and writes them to `moved-reels.json`, which `films/reuse.py` reads. Video, Others came out byte for byte the same.

## Calls I made

- **Crop.** The subtitles are cut off (y 900 and below; they start at 915 in one scene). I also cropped the top 90 px: the game's logo is burned in there, the film fills the screen so most displays would have cut it in half, and it lay under the menu button. If the owner wants the logo back, set `CROP` in `hero.py` to `(0, 0, 1920, 900)` and make `v2`.
- **Size.** 20.1 MB (large) and 11.3 MB (under 700 px of display width). The loading screen waits for the whole film, as the rules require.
- **Filters kept:** Characters (the five pairs), Year, Type, and the order. **Dropped:** a single Character (ten choices), Canon, Topic and the page-level Details view. Topics still match in the search, because the tags are searched.
- **No Details view on the wall.** The window still has Details. The view was the part of the bar that overlapped most with the window.
- **Dd0tPihiEpW in Fanart** is labelled non-canon, credited to the official account that posted it, with the note "A short chibi animation posted by the official account. It is not part of the story." No maker is named, because the file does not say. This is how the official edits there are labelled.
- **The foot** of the room keeps the takedown line and the next-room link of the shell. The request names the button of the first screen; if the foot should lose the next-room link as well, `LibraryFooter` takes it out in one place.
- **A hidden article** on each post page carries its title and caption for search engines and readers without scripts.
- **The search sheet** lists Design posts only (the 18 campaigns were being listed as items).

## Left to check

Firefox, Safari, a real phone, and the Cloudflare cache of `design.json` after deploy (the data files are not versioned).
