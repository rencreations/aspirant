# Actor: the buddies, the drone that carries the Obsidia doll (BUDDY-actor, round six, 20 Nov 2026)

The owner (`docs/superpowers/specs/2026-11-20-home-feedback-6-request.md`): the normal drone carries the Obsidia doll, she sits on its head, they dance and play while they descend, they dock at the bottom right, they follow the cursor and react to hover and click, and the doll plays with the drone. Code: `apps/web/src/features/home/actors/buddies/`. The contract with the descent section and the list is `round6-DESC-descent.md`. Notes on how it was built and looked at: `round6-BUDDY-actor.md`.

## 1. What a section does

```ts
import { ensureBuddies } from "../../actors/buddies"; // lazy, in the runtime
import { buddiesItems } from "../../actors/buddies/preload"; // the loading list (deferred by default)

const pair = await ensureBuddies(ctx); // the drone and the doll are built, the seat is made

// EVERY frame the pair is shown (the kernel hides it first):
pair.visible = true; // shows the drone and the doll (not the doll in "apart")
pair.place({ x, y, height }); // the DRONE's place: stage px, origin middle, y UP. height = the drone's on-screen height
pair.mode("dock"); // "carry" | "dance" | "dock" | "apart", sticky (blends over about 0.6 s)
pair.dance("show", t, { energy, bpm }); // this frame only: the routine `name` at `t` seconds (see 3)
pair.descent(amount); // 0 to 1: how much they are flying DOWN (nose down, wings busy, legs and hair stream up)
pair.look({ x, y } | null); // both look at a stage point; null: the cursor when it is near, otherwise at each other
pair.update(frame); // OPTIONAL: the kernel calls it once a frame for a shown pair
```

- The kernel hides every actor before the sections run, so a pair no section sets is not shown. `pair.visible = true` sets the drone's and the doll's `visible` the same frame (the kernel copies them to the objects after the sections run). While the pair is shown it STEPS the drone and the doll itself, in the right order (drone, seat, doll); their own kernel calls become no-ops (`external`). A section that also uses the drone or the doll alone (the hero, the list's frame) simply does not set the pair that frame.
- `place` is sticky like the drone's. A step of more than 0.9 screen diagonals snaps (the drone's own rule), so a scrollbar drag leaves nothing flying. The doll comes with the drone: she is on its head (`seat`), 0.5 of its height tall as drawn (`DOLL_RATIO`, tune by eye).
- Modes. `carry`: she holds on and reacts physically to every movement the section gives the drone. `dock`: the pair hover and live (section 4). `dance`: a routine drives them (a `dance()` call in a frame is the same as `mode("dance")` for that frame). `apart`: the doll is NOT on the drone: she is released where she is (world kept) and is free for the section (Selena's hang); the drone goes on alone, and `pair.doll` is a normal doll. `pair.mode("carry")` after `apart` sits her back on the head (she pops up onto the seat from where the drone is).
- `pair.drone` and `pair.doll` are the actors, for a section that needs them.
- `pair.react(name)`: a one-shot cue from a section: `"cheer" | "giggle" | "hug" | "wave" | "startle" | "hop" | "wiggle" | "spin" | "dizzy" | "laugh"`. Each always finishes.
- `pair.setInteractive(on)`: the hit targets (the drone's body and the doll's body) answer or not (default on). `pair.reset()`: face, look, mode back to carry, interaction on, one-shots gone.
- `pair.state()`: `{ mode, drone: {x, y, height}, doll: {x, y, drawnHeight}, hover: "drone" | "doll" | null, life: string }` in the stage frame, for a probe or a section that stands something beside them. Valid after `update`.
- `buddiesItems({ deferred = true, priority = 10 })`: the drone's list plus the doll's (the script chunk of the pair, the model files, the faces, the doll's fall clip).

## 2. The seat and the layering

The pair is two actors in two passes. The drone has its own lens (20 degrees, 8 m, `actors/drone/scene.ts`) and draws in its pass `drone` (order 25, "back"); the doll draws in the cast pass (30), so she is drawn over the whole drone: her legs and hands are in front of the helmet whatever the roll. Her place is exact because the seat is computed, not drawn: `headFrame(drone.drawn, stage.height, out)` (`buddies/seat.ts`, stage px, y up) gives the head's frame for this frame's draw (the top of the helmet between the fins, at the model's `(0, 0.158, 0.02)` m, scaled by `height / 0.44748` px a metre, turned by the drawn yaw, pitch and roll). The pair writes it into an `Object3D` in the cast scene (the SEAT) and calls `doll.rideOn(seat, ...)`. The doll is the seat's child: she keeps her place exactly, and the rider physics measure the seat's world motion (the drone's flight, floating, tricks) and move her trunk, head, legs and arms.

## 3. The dances

`pair.dance(name, t, opts)` writes a routine's offsets for time `t` (seconds, any real number: the section may take it from the scroll, so a reverse scroll plays it backwards). `opts.energy` 0 to 1 (default 0.6) scales the amplitude and a little of the tempo (livelier when the visitor scrolls fast), `opts.bpm` (default 100) sets the beat. Routines (`buddies/choreo.ts`, pure and tested, each loops on its own length): `sway`, `bob`, `spin` (the drone turns slowly about its vertical axis with her on top), `eight` (a figure of eight drift), `twirl`, `hop2` (a double hop), `shimmy`, `wave` (she waves, the drone tilts toward her), `clap`, `cheer` (arms up), `lean` (she leans out, the drone catches her balance), `spiral` (a slow descending spiral), and `show`: the designed sequence of all of them (about 40 s) with a cross-fade between; use it for a long scroll. `DANCE_NAMES`, `DANCES[name].seconds` and `showAt(t)` are exported by `choreo.ts`. A routine only moves the drone around the `place` the section gives (offsets in drone heights, a roll, a pitch, a yaw) and the doll's gestures; the descent itself (the route) is the section's.

## 4. The dock

`mode("dock")` after the section has placed the pair at the corner: the drone floats and breathes, the doll sits and lives. A seeded scheduler (`buddies/life.ts`, pure) draws a moment from a bag that is shuffled and never repeats a moment until all have run (so nothing repeats within a minute): look around, swing the legs, hum and sway, pat the drone's head, lean on it, whisper (the drone tilts toward her), yawn, wave at the visitor, adjust her seat, nearly slip and the drone steadies her, the drone blinks and looks up at her, a high five with the drone's fin, a happy wiggle. They react to each other (the drone looks up at her when she waves; she looks down at it when it blinks).

## 5. The interaction

The drone and the doll each have a hit target in the pointer hub while the pair is shown (the drone's `drone` and the doll's `doll` are used; the pair turns their own reactions off and answers for both). Cursor words: the drone "HELLO", the doll "POKE" (as before). Hover on the drone: it hops, wears a happy face and the doll waves at the cursor; hover on the doll: she smiles and waves, the drone looks at her. Press the drone: a trick (a spin about its vertical axis, or a rock from side to side) while she holds on and cheers. Press the doll: she giggles, hugs the drone's head, and the drone wiggles happily. A double press: a big dance move together. Press and hold: both lean toward the cursor. Spam: dizzy (spirals, sweat bead), then they laugh it off. Touch: a tap is a press, there is no hover. The eyes and heads follow the cursor when it is near (a mouse); touch has no cursor, so they look at each other and ahead. Comic marks are used sparingly: a heart or sparkle for affection, a bead of sweat for dizzy, the drone's shock mark for a startle. Never a speech bubble.

## 6. Where the code is

| file                                         | what                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actors/buddies/pair.ts`                     | `BuddyPair`: the modes, the seat, the per frame drive, the hit targets                                                                                                                                      |
| `actors/buddies/choreo.ts`                   | pure: the dance routines (tested)                                                                                                                                                                           |
| `actors/buddies/life.ts`                     | pure: the docked life scheduler (tested)                                                                                                                                                                    |
| `actors/buddies/touch.ts`                    | pure: the interaction state machine (tested)                                                                                                                                                                |
| `actors/buddies/seat.ts`                     | pure: the head frame arithmetic (tested)                                                                                                                                                                    |
| `actors/buddies/preload.ts`, `index.ts`      | the loading list, `ensureBuddies`                                                                                                                                                                           |
| `actors/buddies/hands.ts`                    | pure: the hand targets for her poses (rest, up, wave, clap, pat, hug) in the seat's frame                                                                                                                   |
| `actors/drone/actor.ts`                      | additions: `external`, `drive(frame)`, `drawn`, `hooks`, `hitDepth`, `carrying` (a roll or a flip becomes a rock), `spin(angle)`, `flutter(amount)`                                                         |
| `actors/doll/ride.ts`, `idle.ts`, `actor.ts` | additions: `RideOptions.seatOffset / upright / free`, `RideGesture` (per hand weights, trunk, head, legs, slide, look), `RideBehaviour.noSlip`, `external`, `drive(frame)`, `hooks`, `gesture`, `isHovered` |
