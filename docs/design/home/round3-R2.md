# Home round three: R2 (selena, voices, music, funny)

Brief: `docs/superpowers/specs/2026-11-20-home-feedback-3-request.md`. Zones and the idle snap: `kernel-scrub.md`. This note adds to `round2-R-C.md` and `round2-R-F.md`: the beats, the composition, the backdrops and the v stations are unchanged (`update` gets the same numbers at the same stations). Only what drives them changed: the clock plays are now scroll zones, and the page finishes a zone the visitor leaves half way. No clock play remains in these four sections.

## 1. The tables (screens)

`sections/zone-table.ts` (new, pure) turns a row of segments written in screens into the plays table the kernel wants (`at` and `span` as shares of the section). Each section's `stations.ts` has `LENGTHS`, the row, and exports `<SECTION>_SCREENS`, `_PLAYS`, `_ZONES` (in screens from the section's start). `index.ts` reads the length from there.

| section | segments, in order (zone = scroll drives, rest = the page is free)                                                             | screens (was) | v stations         | focus   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------ | ------- |
| selena  | zone 0.7 (drawer, words, dragon, aurora), rest 0.8 (interactive room), zone 1.5 (the film), rest 0.3 white                     | 3.3 (1.5)     | 0, REST_V 0.253, 1 | 0.333   |
| voices  | zone 0.7 (in), rest 1.0 (chooser and lines), zone 0.7 (out)                                                                    | 2.4 (1.5)     | 0, 0.3, 1          | default |
| music   | zone 1.2 (zip off, gramophone, crate), rest 0.8 (pick, disc, needle, song), zone 0.9 (props out)                               | 2.9 (1.7)     | 0, STAND 0.5, 1    | default |
| funny   | zone 0.6 (Tetra), rest 0.3, zone 1.1 (dragon, cut, run), rest 0.25, zone 0.9 (pair to the middle), rest 0.9 (words and button) | 4.05 (2.0)    | 0, 0.12, 0.5, 1    | 0.889   |

Zones are linear (`ease` default), so the story's seconds map to the scroll in a straight line (Selena: 3.95 s of story over 2.2 screens of zones). The idle snap takes `seconds = 0.55 * length`, between 0.35 and 0.9 s (`snapSeconds`). The film is a zone of 1.5 screens, as the owner said. Rests are longer where there is text and information (voices 1.0, Selena 0.8, funny's last 0.9) and short for an animated scene (funny's two short rests, music's stand 0.8 because a record is picked there).

## 2. What else changed

- **Selena.** `stepWhite` (the white layer leaving by a clock in the tail) is gone: the white leaves with the scroll, `AT.whiteOut` 0.04 to 0.45 screens past the end, both ways, as the voices' entrance zone comes in. A white rest of 0.3 screens ends the section, so the film zone is over before the bar's ink turns. The first `plays` test block of `timeline.test.ts` was rewritten for zones.
- **Voices.** `nav.early` went from 0.45 to 0.3 (the bar turns at the start of Selena's white rest). `kernel/layout.test.ts` "makes the voices take the top bar..." now pins 0.31 and 0.29.
- **Music.** `EXIT_RESET` 0.156 (`choreo.ts`): the song, the disc and the crank are reset only once the exit curve is 0.156 along, which is a quarter of the exit zone and the place where the idle snap starts to carry a stop forward (`ZONE_FORWARD_DOWN` 0.25), not at the first pixel. The intent: a stop that snaps back to the stand never reset it, so a wheel notch that wanders into the exit and back leaves the song playing; a stop that carries on has reset it. This was not run with a real pick and sound (see section 5). Nothing holds the page, so nobody is trapped.
- **Funny.** The lift of the duo and the words in the tail is still the real scroll (`frame.S - sectionEnd`), so it needed nothing.
- **Tests changed on purpose** (a cleanup pass can fold them): `selena/timeline.test.ts`, `voices/stations.test.ts`, `music/choreo.test.ts`, `funny/timeline.test.ts` (the plays blocks became zone blocks), `kernel/layout.test.ts` (one number), `sections/zone-table.test.ts` (new). `sections/pair.test.ts` fails on rows and strip, which are not in this range.

- **Deliberate call: first zones inside the previous section's tail.** `kernel-scrub.md` advises zones keep out of a neighbour's lead and tail. The voices', music's and funny's first zones start where the section before it ends, so they run inside its tail on purpose: Selena's white leaves with the scroll as the voices' entrance comes in (looked at, no dark wash), the voices' and music's tails draw nothing the next zone needs, and the duo's corner and top left stations are the same by construction. The zone snap wins there and the joint snap defers, as the doc says.
- **Total length.** The four sections went from 6.7 screens (round two) to 12.65 (3.3 + 2.4 + 2.9 + 4.05), so the lead can weigh it against the owner's "short". The long parts are rests (2.6 + 3.0 of text and interactions) and the funny pair's last rest.
- **Shared edits.** `kernel/layout.test.ts`, one hunk (the voices bar numbers 0.46 and 0.44 became 0.31 and 0.29). `zone-table.ts` repeats `playsOf` and `zoneLength` of `kernel/beat.ts` in a form that takes lengths in screens for rests as well; a cleanup pass can fold one into the other.

## 3. Numbers to tune

`LENGTHS` in each `stations.ts`; `AT.whiteOut` in `selena/timeline.ts`; `nav.early` in `voices/index.ts`; `EXIT_RESET` in `music/choreo.ts` (keep it at the exit curve of 0.25); `snapSeconds` in `zone-table.ts`. The kernel's `ZONE_IDLE_MS`, `ZONE_FORWARD_DOWN`, `ZONE_BACK_UP` are K7's.

## 4. Looked at (real Chrome, dev server on 3000, 1440x900)

- Frame sheets by seek, read: Selena (entrance, rest, the film from the swing to the white, the white rest, the hand-over to the voices at four tail positions with no dark wash), voices (white, entrance, rest, leave, the pair in the corners), music (zip off, gramophone, crate, stand, exit), funny (Tetra arrives, rest, the dragon and the cut, the confused pair, the pair to the middle, words, the ride out in the tail).
- Real wheel, then stand still, reading `S`, `v` and `snap().scrub`: Selena film (stopped at p 0.67 down: snapped forward to the zone's end, v 1.0, about 0.5 s; from the end up 0.6 screen: snapped back to the start), voices entrance and the white rest above it, music arrival, funny cross zone. All finished to the end the visitor was heading to, and the page stood in a rest afterwards. A hard flick of 6 screens through Selena, the voices and the music: no stuck state, the snap finished the zone it ended in.
- **Backward, by the real wheel, then the frame the page settled on** (`legs.cjs`): funny from the confused rest up to a stop in the cross zone settled at the start of the zone (Tetra standing, the kite back on its rope, no dragon, no doll), and down again settled at its end with the rope cut and Tetra gone; Selena from the white rest up into the film settled at the start of the film zone (pixel camera, Selena in the idle, the doll hanging, the dragon at the foot, the drawer, words and button back) and down again settled at the film's end in white; music from the stand up through the whole arrival into the voices' rest, then down to the stand (both props in, "Pick a record", the drones at their posts, nothing stuck on a haul).
- `tsc --noEmit` has nothing in these paths. Vitest on the four section folders and `zone-table.test.ts`: 128 passed.

## 5. Found, not fixed (kernel, K7's area)

- **Music's first zone starts on a joint, and the page does not stay at its start.** Repro (`snap.cjs music 1440x900 1.2 1.0 -1`): from the stand wheel up one screen and stop inside the arrival zone. The zone snap carries the page back to the zone's start, which is the voices' end (a joint, 0 screens from the boundary, `p` 0). The log then shows the page drifting forward by itself (off 0.03 to 0.31) and a forward zone snap running to the stand (1.2). A visitor who stops on the way up inside the music's arrival is returned to the stand, so they must go on past the boundary in one push. Funny's first zone (it starts at the music's end) and the voices' entrance have the same shape and the up run to their starts was not tried; the funny cross zone and the Selena film zone, which are not on a joint, settled and stayed. Likely the zone snap landing exactly on `p` 0 inside a joint: the joint snap or the next zone snap takes it. A fix would be to treat a zone end as a rest for the joint snap (`ZoneSnap.inside` with a margin of `ZONE_EDGE`). Not changed here because it is the kernel's.

## 6. Not verified

- Zones are not gated by `ready()` (the gate is for clock plays): a seek or a very fast scroll into Selena's film before the actors are built shows the aurora and the star alone until they arrive (seen in the sheet at the film's first two positions on a fresh load). A visitor who scrolls normally has them (`mountAhead` 3.5).
- A phone (390x844) and a touch swipe: not run. 1706x950 not run. Keyboard focus into the Selena button and funny's link with the new `focus` values: not run. The music press, pick and song with the new exit deadband: not run (the arrival, stand and exit frames were looked at; the song needs a press and sound). Safari, Firefox, the production build, a real touch device.
- The film's first second of the clip plays at 3.4x in story time (the stand up). On the scroll it is fast for 0.15 screens. Left.
- Selena's room still starts the entrance zone at her section's first pixel, so the list's last frame and the entrance are one continuous scroll (no rest between). The list's own tail sets the joint.
