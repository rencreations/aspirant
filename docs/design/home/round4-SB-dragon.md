# Round four: SB-dragon (Silverbolt)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-4-request.md`. The API for the other helpers is in `actor-silverbolt.md`, section "Round four: rider sockets and shake". Code: `apps/web/src/features/home/actors/silverbolt/`. Probes (outside the repo): `D:\ren\aspirant-work\home\SB4\` (`lib.cjs`, `look1.cjs` side views by heading, `head.cjs` the head at 720, 300 and 130 px, `socks.cjs` sockets as dots, `shake.cjs` the shake at eight ages, `inter.cjs` the pointer test, `run.sh` retries after a hot reload). Reference frames: `SB4\ref\` (in-game stills of short-1.mkv at 5 to 12 s).

## What the target looks like (from the recordings)

Silver armour is white lilac, smooth, with a gentle lilac shade and a fine dark outline (about 1 to 2 px at a 1500 px head). The gold is saturated yellow orange with bright warm edges. The eyes are pale blue diamond crystals. The crest spikes are violet to pink gradients. The body is a translucent flame ribbon, cyan to blue to violet, with soft streaks. Nothing is mottled. In the entrance clip (`city_action`) the body is a rigid straight line with a trailing tail while the root travels (scale 0.105 to 1); only the first 2 s and the last second curl the tail. So the target is a long straight body with a gentle travelling wave in the tail, not a bending spine. I did not bake the entrance: the shipped `silverbolt.glb` already holds `city_action`, and the long straight look comes from levelling the tail (below).

## What changed

1. **Side view and a long body.** The default pose is yaw -PI/2, pitch 0.5 (nose upper left). `place({ heading })` gives the exact side view for any heading (`facing(hx, hy, 0)`, never upside down). The cause of the "seahorse" that remained after round two was the tail: the rest tail leaves the neck at 26 degrees down and bends again. `measureTailLevel` (actor, once, at rest) computes a pitch for each tail joint that lays every segment on the body's axis (the line from the head joint to the first tail joint, the one the head is straightened to), with 4 degrees of droop at the tip (`TAIL_DROOP`). It is applied only to procedural poses (`!want.clip`), so Selena's film clips keep their own tail. Nothing is stretched: the group scale only breathes by 1.2 percent (`BREATH_SCALE`). The old 14 percent puff, 4 percent hover swell and 5 percent anger swell are gone. `LENGTH_M` is 3.6 m.
2. **Locked head, body only.** The head has no turn of its own (no follow, no lag, no dip, no tilt, no hover or press reaction, no eye slide). The pointer drives `lean.ts` (pure, tested): pitch 0.12 rad, bank 0.07 rad, shift 0.09 m and a tail wave boost, all by slow critical springs (omega 3 to 5). Hit targets: the head and jaw capsules are folded into the body target (label POKE). FLAP and DRAG stay. A press on the body is a small jolt (the `puff` reaction at 5 percent of a radian) and a little annoyance. The annoyed state keeps its face, tail lash and marks and needs no head motion.
3. **Shake.** `shake(strength)`, `shake.ts` (pure, tested): 0.8 to 1.2 s, a decaying 6.5 Hz rattle along the body (0.12 m at strength 1), a 9.3 Hz shudder (3.5 cm), a roll of 0.35 rad that dies faster, a 0.11 rad nod, wings and cheek blades flare, a whip travels down the tail. Exposed as `shakeAmount`, `shakeOsc` and `motion`.
4. **Rider sockets.** `seat` (on the neck bone), `gripL` and `gripR` (head bone, at the crest bases, 0.14 m to each side), `headPoint` (between the eyes and the cheek blades). Checked as dots on a side view at 1000 px (`SB4\shots\socks0.png`): `seat` sits on the top of the neck just behind the crest spike, the grips at the crest base 0.11 m ahead of it, `headPoint` on the eye. `motion.seatVel` and `seatAcc` (smoothed, stage px per second), `tilt` (the body axis on the screen).
5. **Rendering.** The cause of the ugly head: the painted atlas is 512 px with the light baked in, and the old step cut (`BODY_STEPS` 6, by tone) turned its airbrushed gradients into mottled cream and lilac patches. The metal look's deep band (0.3) and the 1.4 ink weight then drew heavy navy shapes and a thick rim round every panel. Now `flattenGlsl` (materials.ts) pulls the lightness of silver toward 0.86 and of gold toward 0.68 (gamma space, 60 percent), keeps hue and panel edges, makes the gold 95 percent more saturated and leaves the blue crystals alone. The body takes a softer metal tune (shade 0.72/0.72/0.93, deep 0.52/0.54/0.82, rim 0.45, glint 0.8) and an ink weight of 0.85. The ribbon steps went from 6 to 10 (the chunky flame patches). No shared toon file was edited: the tune is in the pick, so the shared looks are as they were (R-T: nothing to merge).
6. **Other users.** Chase and funny place the dragon with their own yaw (1.1 and -1.1, three quarters) every frame, so the new default does not touch them. They get the locked head, the level tail and the new colours. Selena's film uses clips (`keep` root): the tail level is off, the head follow does nothing now, the lean does not apply (no body placement in world mode). A heading change of more than half a radian in one frame counts as a jump (the tail snaps instead of kinking).

## Numbers to tune

`lean.ts` (`LEAN_*`), `shake.ts` (`SHAKE_*`), `actor.ts` (`TAIL_DROOP`, `DEFAULT_PITCH`, `BREATH_SCALE`, the socket points in `SOCKET_AT`), `materials.ts` (`flattenGlsl` constants 0.86, 0.68, 0.6, 0.95, the body `tune`, `RIBBON_STEPS`).

## Looked at, and how

Real Chrome, the dev server on 3000, the lab (`window.__home.lab("silverbolt")`):

- side views at headings 20, 135, 144 and 180 degrees, rest and fly (a straight long body);
- the head at 720, 300 and 130 px on a light and a dark ground, before and after;
- sockets as dots at 1000 px;
- the shake at ages 0 to 1.05 s (envelope 0.88 to 0.06, the oscillation changes sign, the wings flare, the head nods with the body);
- a scripted pointer: the three targets are found by a grid scan, the head quaternion is identical before and during a press, the lean springs move by the pointer's side;
- the real bolt section at 30 and 70 percent (the new look draws on the dark and on the white ground; it still uses the old journey values, the integrator is rewriting them).

Tests: `round4.test.ts` (7, new) and `materials.test.ts` (15) pass. `tsc` has no error in `actors/silverbolt`.

## Not done, not verified

- The lean is calm on purpose: with `follow(0.5)` the shift measured 5 px at 300 px per metre. The bolt section should call `follow(1)`. If the owner wants it livelier, raise `LEAN_SHIFT_M` and `LEAN_PITCH`.
- The shake was seen as a frame sheet at the dev server's frame times, not as motion on a screen. The whip on the tail and the roll are judged from the numbers and stills. The doll's reaction is the doll helper's.
- The grips and the seat were placed by eye on side views. The doll helper may need to move them a few centimetres (`SOCKET_AT`). At a heading of 144 degrees the seat tilts with the body (36 degrees): the rider must lean to stay upright, and `motion.tilt` says by how much.
- The look was compared with the in-game frames by eye, side by side only on the head. Not matched: the in-game panel lines (the game's `n5x5` normal map and `line` mask are not used) and the violet to pink gradient of the crest. Baking the normal map into the shader is the next step if the owner wants the panel bevels.
- `look()` and `follow()` still exist (chase, funny and Selena call them) and now steer only the body lean. Funny, chase and Selena's film were not looked at after the change. The jaw stays open at the model's own angle (0.23) by default: close it with `sb.jaw(0.1)` for a calmer head.
- Not looked at: a phone, other browsers, GPU time. The old tests of `hit`, `mood`, `pose`, `straight`, `facts` and `face` were not run.
