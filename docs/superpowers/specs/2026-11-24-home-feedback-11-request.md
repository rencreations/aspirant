# The owner's eleventh message of feedback, 24 Nov 2026 (word for word)

It follows `2026-11-24-home-feedback-10-request.md`. The owner said: do not run any test or CI, do not push, change only what was asked, and make sure `localhost:3000` has the latest version (it is the built site, so it is rebuilt after a change). A second message in the same turn added the last item of the list below.

> I wanted you to fix some things in homepage,
>
> In "Official animations for The Aspirants", there's a dot in center of the screen that's visible and stick to the screen then disappear on next section, remove or don't show it visually.
>
> After that, there's a section where drone are like falling down with two drone joining after, in this section, I wanted you to make the normal drone interactable and can follow user cursor, but make it smooth and seamless and the animation will blend to current animation to the cursor position animation projectile, so it will be smooth and always blend.
>
> In character section in homepage, in selena preview, I wanted it to be the 3d model also. So preview here is the content that shows when it's not focused on selena yet, so for example still in previous content in the list, then the selena content can be seen as the next in list, in it I wanted it to be the 3d model preview. Also I wanted you to preload the selena 3d model, silverbolt model, animations, etc in the first loading to make sure that this section adn the 3d model and animations can really shown when get into this section because some case user scroll too fast that it didn't loaded yet, but make sure the first loading are not too long.
>
> Still in selena character page, I wanted you to add maximum scroll speed here, so that user can't scroll too fast so that the animations will just finish. Add some threshold where it's the maximum scroll speed so that user can't scroll too fast. First apply it in the first transition when still in preview, and scroll to expand the frame to full one. Then the transition out to next section.
>
> Also in the first transition when still in preview, and scroll to expand the frame to full, I wanted you to fill in the character selena section, I wanted you to put the drone into most front in z index value so it will be most front and it will survive the frame expand and not get hide by it.
>
> I will give you more things to change, so do not run any test or CI and only fix or change the things I've told you, and do not push and only make sure you only change or fix the things. Make sure it's localhost:3000 is updated with latest version and I will see it there first.
>
> also in selena section where it expand, remove the automatic scroll or snap when idle and make sure it's scroll based, do the same for exit transition animation

## What it asks for, by part

**The dot.** In the strip's "Official animations" part a dot stays fixed at the middle of the screen until the next section. It is not shown any more (the line's two end dots meet at the middle when the line goes; they fade out before they meet).

**The descent.** The normal drone (with the doll) follows the cursor, smoothly, blended into the flight it already has (the dance and the guests go on), and returns to its route when the cursor goes.

**The list's Selena.** Selena's small picture beside the frame (the next one in the strip while the visitor is still on an earlier character) is her 3D model too. Her model, the dragon's model and their clips, and the code of the two sections, are loaded in the first loading (waited for), and the list is mounted earlier, so a fast scroll never meets a frame without her. The first loading stays short (about 2.5 MB more).

**Scroll speed and snap.** The scene has a top speed through Selena's growth to the whole screen and through her way out to the next section, so the animation always plays whole. Neither zone is finished by itself when the visitor stops (no idle snap): they are the scroll's only.

**The drone in front.** While Selena's frame grows into the screen the drone is drawn in front of everything, so the frame never hides it.
