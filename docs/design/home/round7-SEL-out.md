# Round seven, SEL-out: the out animation and the white sheet (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md` (the last paragraph of the owner's message). Code: `sections/selena/out.ts` (pure beats), `sections/selena/scene.ts` and `runtime.ts` (the wiring), `fx/sheet/` (the white sheet), `actors/selena/pull.ts` (the pulling arm, pure) with two small hooks in `actors/selena/actor.ts`. Work files: `D:\ren\aspirant-work\home\SEL-out\`.

## API (what the other helpers use)

Written first, filled in as the work goes on.

```ts
// The out zone (sections/selena/out.ts). `o` is the progress of the scroll zone, 0 to 1, both ways.
outBeats(o: number, out: OutBeats): OutBeats   // clip time, pull, sheet cover, the pair's exit, the whites

// The sheet (fx/sheet): an actor "sheet" in the cast pass, so it shares the depth buffer with her.
const sheet = await ensureSheet(ctx);
sheet.drive({ sl, camera, cover, pull, w, h });  // every frame the out zone shows it; `sheet.visible = true`

// Selena (actors/selena/actor.ts), two additions:
sl.pin(bone: string, along?: number): Object3D   // a socket on any bone of hers, kept on it every frame (her own space)
sl.pull(p: PullInput | null)                      // the arm pulls: a hand target in view space, the fingers close. null = off
```

- The out clip is scrubbed by the zone (`sl.clip("city_intercation02", t)`), so the state machine of SEL-anim is `free` while the zone runs; `sl.drive(1)` takes her back at the top of the zone (going up).
- The pair (drone and doll) stay docked at the bottom right through the room (the section calls `pair.mode("dock")` every frame) and fly off as the sheet starts to cover. The old J8 handover (the doll hanging from the top edge) is gone from `list/pair.ts` and from the room.
- The old film (`city_intercation03`: the doll falls, Silverbolt eats her, the dragon passes the lens) is gone from the Selena section.

(The rest of this note is written at the end of the work.)
