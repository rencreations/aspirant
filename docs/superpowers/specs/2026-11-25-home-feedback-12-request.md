# The owner's twelfth message of feedback, 25 Nov 2026 (word for word)

It follows `2026-11-24-home-feedback-11-request.md`. The owner's rules for the turn were the same as before: do not run any test or CI, do not push, change only what was asked, and make sure `localhost:3000` has the latest version (it is the built site, so it is rebuilt after a change).

> I wanted you to fix some things in homepage,
>
> In voiceline section, I wanted it to be trigger based for when it appear. So when the animation have transition and white canvas have covered the screen, it will appear automatically and make sure to test all cases whether user scroll fast and skip it, scroll up, etc.
>
> In section below music where tetra chasing silverbolt, remove the angela visual reaction cues that's floating like comic effects. Add also a maximum scroll, so user can't scroll too fast and missed the entire animations and section.
>
> Below it, or in story section in homepage, when user scroll too fast, the 3d model and text just vanishes suddenly, fix it and make sure it vanishes smoothly.
>
> In section below story section in homepage, where it show Tetra chasing silverbolt that chased obsidia doll, change this things. First is the obsidia doll running animations. I wanted it to look like teta while running, so it's like cartoonish fast run, currently it's just normal walking and not running, and I want the doll to run for her life and also add a lots of facial animations, expression, and so much more to make the doll really fear being chased. Add also a maximum scroll, so user can't scroll too fast and missed the entire animations and section. Also when user change scroll direction mid animations, instead of Tetra suddenly turned, it will stop first at the current position exhausted, wait for the silverbolt and obsidia doll to pass her first, then chased them, make sure it didn't vanishes again.
>
> I will give you more things to change, so do not run any test or CI and only fix or change the things I've told you, and do not push and only make sure you only change or fix the things. Make sure it's localhost:3000 is updated with latest version and I will see it there first.

## How it was read

The owner's speech to text writes "Angela" for Tetra (round ten: "Angela will have idle animation dancing"), so "the angela visual reaction cues" are the floating "!" burst over Tetra's head when she is startled by the dragon. Her start stays in her body and her face. "The section below music where tetra chasing silverbolt" is the funny section, "the story section" is its second half (the two drones, "What's going on?", "Read The Story"), and "the section below the story section" is the chase.

## What was done, by part

**The voices' way in.** It is a trigger now (a clock play, `ENTER_SECONDS` 1.9 s), fired by the first threshold after the white of Selena's way out has covered the screen. The page is held while it runs and nothing is skipped by a hard flick (see "Top speed and a held scene" in `docs/design/home/kernel-snap.md`). The way out is still a scroll zone. The section is 1.75 screens long (it was 2.4: the old way in was 0.7 screens of scroll), so every section after it starts 0.65 screens earlier.

**The funny section.** No "!" over Tetra. A top scene speed through the arrival, the crossing and the question (1.1 screens a second) and through the ride out of the two drones and their words (0.9). The words went from 1 to 0 in a frame and the drones were hidden on a hard scroll because the scene followed the scroll at any speed; now it cannot.

**The chase.** A top scene speed through the run (1.0) and the comic (1.2), no idle snap in either zone. The doll runs a cartoon sprint (`addSprint` in `actors/doll/pose/layers.ts`, `DollActor.sprint`): high knees, arms thrown up, a lean into it, a hop and a squash with every stride, her head turning back at the jaws behind her, and a face that changes every quarter of a second (scared, scream, wide eyed, crying, begging). Tetra does not turn with the pair when the scroll turns back: she brakes in a short skid, pants where she stands (a step toward the camera, watching the doll go by), and runs after the pair when the tail has passed (`chase/tetra-path.ts`).

**Later (25 Nov 2026, round fifteen).** The top speeds of this round were folded into one rule for the whole page, and the flick limiter, the held lead and the gates are gone: see `2026-11-25-home-about-feedback-15-request.md` and `docs/design/home/kernel-snap.md`, "The scene's top speed".
