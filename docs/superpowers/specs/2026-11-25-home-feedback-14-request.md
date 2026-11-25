# The owner's fourteenth message of feedback, 25 Nov 2026 (word for word)

It follows `2026-11-25-home-feedback-13-request.md`. The rules for the turn were the same: do not run any test or CI, do not push, change only what was asked, and make sure `localhost:3000` has the latest version (it is the built site, so it is rebuilt after a change).

> I wanted you to fix some things in about page,
>
> There's a bug in character section, in selena content.
>
> First, when user comes from previous section, then scroll down really really fast, it will ended up in selena out animations suddenly, and lots of animations are skipped by being too fast in scrolling. Also the text content are show without ant animations or can't seen the appearing animations because it's too fast and appear suddenly. I wanted you to fix it and make sure how fast user scroll, the selena animations starting from the start animation, the frame expanding, exit animation, and so much more will be smooth and seamless, think of every way and best way to fix this without disturbing the normal scroll experience (so scroll not too heavy). This problem also appear when user is in selena or immersive section where selena 3d are full screen, then user scroll up really really fast. Instead of ending in the selena character list, it's ended up in other character list and suddenly, make sure everything is smooth.
>
> I will give you more things to change, so do not run any test or CI and only fix or change the things I've told you, and do not push and only make sure you only change or fix the things. Make sure it's localhost:3000 is updated with latest version and I will see it there first.

## How it was read

The owner wrote "about page" but means the home page: the character section (the list) and Selena's content (the frame that grows into the whole screen, then her room and her film).

## What went wrong

A hard scroll left the page up to two screens ahead of the scene. The scene had a top speed only inside Selena's growth and her film, so it ran at a screen a frame through every rest between zones, and when the visitor let go it leapt over the rest to catch up with the page: past the words that come in with the scroll, into the film (the "out animation") or, going up, into another character's frame.

## What was done

- **The whole passage has a top speed**, the rests between the zones too (`PASSAGE_SPEED`, 2 screens a second, `kernel/speed.ts`): the character list, Selena's section (her room comes in at 1 screen a second) and the first screens of the voices. A brisk scroll is about one screen a second and meets none of it.
- **The page does not run ahead of a held scene** (`HELD_LEAD`, 0.8 screens). The rest of a hard scroll is dropped: the page is put back beside the scene, so the visitor lands beside the animation that was playing.
- **Gates** (`HomeSection.gates`, `gateBetween`): a hard scroll stops at Selena's frame at rest in the list, at the frame grown to the whole screen, and at the two ends of her film, and waits there until the visitor pauses (`GATE_GAP_MS`, 0.22 s) and pushes again. Going up from the full screen it lands on her card in the list, not on another character. A scroll that is not a flick (the page less than `GATE_LEAD` ahead of the scene), a key, a drag or a script's move never meets a gate.
- The joint snap takes the direction of the visitor's last wheel or touch (`pushDir`), not of the page: the engine's own move of the page (putting it back to a gate) once made the page run on to the voices' way in.
- The page is put back beside a held scene only in the passage (`TopSpeed.hold`), and a gate lets go after 0.8 s at most, whatever the wheel does.
- Not done: a flick that starts within 0.3 screens of a gate passes it (the gate holds a flick, not a slow scroll); a finger on a phone went through the gate without a catch (nothing jittered, nothing stuck).
